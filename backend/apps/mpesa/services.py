"""
M-Pesa Daraja API Service
Handles STK Push, C2B, authentication, and callback processing
"""

import base64
import logging
import requests
from datetime import datetime
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger("apps.mpesa")

SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke"
PRODUCTION_BASE_URL = "https://api.safaricom.co.ke"


class DarajaService:
    """Safaricom Daraja API integration service"""

    def __init__(self):
        self.consumer_key = settings.MPESA_CONSUMER_KEY
        self.consumer_secret = settings.MPESA_CONSUMER_SECRET
        self.shortcode = settings.MPESA_SHORTCODE
        self.passkey = settings.MPESA_PASSKEY
        self.callback_url = settings.MPESA_CALLBACK_URL
        self.environment = settings.MPESA_ENVIRONMENT
        self.base_url = SANDBOX_BASE_URL if self.environment == "sandbox" else PRODUCTION_BASE_URL
        self._access_token = None
        self._token_expiry = None

    def _get_access_token(self) -> str:
        """Get OAuth2 access token, cached for 50 minutes"""
        now = timezone.now()

        # Return cached token if still valid
        if self._access_token and self._token_expiry and now < self._token_expiry:
            return self._access_token

        credentials = base64.b64encode(
            f"{self.consumer_key}:{self.consumer_secret}".encode()
        ).decode("utf-8")

        try:
            response = requests.get(
                f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials",
                headers={"Authorization": f"Basic {credentials}"},
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            self._access_token = data["access_token"]
            # Cache for 50 min (token valid for 60 min)
            from datetime import timedelta
            self._token_expiry = now + timedelta(minutes=50)
            logger.info("M-Pesa access token refreshed successfully")
            return self._access_token

        except requests.RequestException as e:
            logger.error(f"Failed to get M-Pesa access token: {e}")
            raise MpesaAuthError(f"Could not authenticate with Daraja API: {e}")

    def _get_password(self) -> tuple[str, str]:
        """Generate STK Push password and timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        raw = f"{self.shortcode}{self.passkey}{timestamp}"
        password = base64.b64encode(raw.encode()).decode("utf-8")
        return password, timestamp

    def initiate_stk_push(
        self,
        phone_number: str,
        amount: int,
        account_reference: str,
        transaction_desc: str = "Fuel Purchase - Cahayo",
    ) -> dict:
        """
        Initiate Lipa Na M-Pesa Online (STK Push)
        
        Args:
            phone_number: Customer phone in format 254XXXXXXXXX
            amount: Amount in KES (whole number)
            account_reference: Reference shown to customer
            transaction_desc: Description of transaction
            
        Returns:
            dict with MerchantRequestID, CheckoutRequestID, CustomerMessage
        """
        phone_number = self._normalize_phone(phone_number)
        amount = int(amount)  # M-Pesa requires integer amounts

        if amount < 1:
            raise ValueError("M-Pesa amount must be at least KES 1")

        password, timestamp = self._get_password()
        token = self._get_access_token()

        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone_number,
            "PartyB": self.shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": self.callback_url,
            "AccountReference": account_reference[:12],  # Max 12 chars
            "TransactionDesc": transaction_desc[:13],  # Max 13 chars
        }

        logger.info(f"Initiating STK Push: {phone_number} KES {amount} ref:{account_reference}")

        try:
            response = requests.post(
                f"{self.base_url}/mpesa/stkpush/v1/processrequest",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()

            if data.get("ResponseCode") == "0":
                logger.info(f"STK Push initiated: CheckoutRequestID={data.get('CheckoutRequestID')}")
                return {
                    "success": True,
                    "merchant_request_id": data.get("MerchantRequestID"),
                    "checkout_request_id": data.get("CheckoutRequestID"),
                    "customer_message": data.get("CustomerMessage"),
                    "raw": data,
                }
            else:
                logger.warning(f"STK Push failed: {data}")
                return {"success": False, "error": data.get("errorMessage", "STK Push failed"), "raw": data}

        except requests.RequestException as e:
            logger.error(f"STK Push request error: {e}")
            raise MpesaRequestError(f"STK Push failed: {e}")

    def query_stk_status(self, checkout_request_id: str) -> dict:
        """Query the status of an STK Push transaction"""
        password, timestamp = self._get_password()
        token = self._get_access_token()

        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id,
        }

        try:
            response = requests.post(
                f"{self.base_url}/mpesa/stkpushquery/v1/query",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"STK status query error: {e}")
            raise MpesaRequestError(f"Status query failed: {e}")

    def process_stk_callback(self, payload: dict) -> dict:
        """
        Process STK Push callback from Safaricom
        Returns parsed transaction data
        """
        logger.info(f"Processing STK callback: {payload}")

        try:
            stk_callback = payload["Body"]["stkCallback"]
            merchant_request_id = stk_callback["MerchantRequestID"]
            checkout_request_id = stk_callback["CheckoutRequestID"]
            result_code = stk_callback["ResultCode"]
            result_desc = stk_callback.get("ResultDesc", "")

            if result_code == 0:
                # Payment successful
                metadata = {
                    item["Name"]: item.get("Value")
                    for item in stk_callback.get("CallbackMetadata", {}).get("Item", [])
                }
                return {
                    "success": True,
                    "merchant_request_id": merchant_request_id,
                    "checkout_request_id": checkout_request_id,
                    "mpesa_receipt_number": metadata.get("MpesaReceiptNumber"),
                    "amount": metadata.get("Amount"),
                    "phone_number": str(metadata.get("PhoneNumber", "")),
                    "transaction_date": metadata.get("TransactionDate"),
                    "result_code": str(result_code),
                    "result_desc": result_desc,
                }
            else:
                return {
                    "success": False,
                    "merchant_request_id": merchant_request_id,
                    "checkout_request_id": checkout_request_id,
                    "result_code": str(result_code),
                    "result_desc": result_desc,
                }

        except (KeyError, TypeError) as e:
            logger.error(f"Malformed STK callback payload: {e}\nPayload: {payload}")
            raise MpesaCallbackError(f"Invalid callback payload: {e}")

    def process_c2b_payment(self, payload: dict) -> dict:
        """Process C2B (paybill/till) payment notification"""
        return {
            "transaction_type": payload.get("TransactionType"),
            "mpesa_receipt_number": payload.get("TransID"),
            "amount": payload.get("TransAmount"),
            "business_shortcode": payload.get("BusinessShortCode"),
            "bill_ref_number": payload.get("BillRefNumber"),
            "org_account_balance": payload.get("OrgAccountBalance"),
            "phone_number": payload.get("MSISDN"),
            "first_name": payload.get("FirstName", ""),
            "last_name": payload.get("LastName", ""),
            "transaction_time": payload.get("TransTime"),
        }

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Normalize phone to 254XXXXXXXXX format"""
        phone = phone.strip().replace(" ", "").replace("-", "")
        if phone.startswith("0"):
            phone = "254" + phone[1:]
        elif phone.startswith("+"):
            phone = phone[1:]
        elif not phone.startswith("254"):
            phone = "254" + phone
        return phone


class MpesaAuthError(Exception):
    pass

class MpesaRequestError(Exception):
    pass

class MpesaCallbackError(Exception):
    pass


# Singleton service instance
daraja_service = DarajaService()
