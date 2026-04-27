"""
M-Pesa Views
STK Push initiation and secure callback handling
"""

import logging
import hashlib
import hmac
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from .models import MpesaTransaction
from .services import daraja_service, MpesaRequestError
from .tasks import process_stk_callback_task
from .serializers import (
    STKPushSerializer, MpesaTransactionSerializer,
    MpesaTransactionListSerializer
)
from apps.shifts.models import Shift

logger = logging.getLogger("apps.mpesa")


class STKPushView(APIView):
    """Initiate M-Pesa STK Push payment"""
    permission_classes = [IsAuthenticated]
    throttle_scope = "mpesa"

    def post(self, request):
        serializer = STKPushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        station = request.user.station
        if not station:
            return Response(
                {"detail": "User not assigned to a station."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate open shift
        shift = None
        if data.get("shift_id"):
            try:
                shift = Shift.objects.get(
                    id=data["shift_id"],
                    station=station,
                    status=Shift.Status.OPEN
                )
            except Shift.DoesNotExist:
                return Response(
                    {"detail": "No open shift found with this ID."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            result = daraja_service.initiate_stk_push(
                phone_number=data["phone_number"],
                amount=int(data["amount"]),
                account_reference=data.get("account_reference", station.code),
                transaction_desc=data.get("description", "Fuel Purchase"),
            )
        except MpesaRequestError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        if not result["success"]:
            return Response(
                {"detail": result.get("error", "STK Push failed. Please try again.")},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create pending M-Pesa transaction record
        mpesa_txn = MpesaTransaction.objects.create(
            station=station,
            transaction_type=MpesaTransaction.TransactionType.STK_PUSH,
            merchant_request_id=result["merchant_request_id"],
            checkout_request_id=result["checkout_request_id"],
            phone_number=data["phone_number"],
            amount=data["amount"],
            status=MpesaTransaction.Status.PENDING,
            request_payload=result.get("raw"),
            initiated_by=request.user,
            shift=shift,
        )

        return Response({
            "success": True,
            "message": result["customer_message"],
            "checkout_request_id": result["checkout_request_id"],
            "transaction_id": str(mpesa_txn.id),
        }, status=status.HTTP_201_CREATED)


class STKCallbackView(APIView):
    """
    Receive M-Pesa STK Push callback from Safaricom
    This endpoint must be public but validated
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data
        logger.info(f"STK callback received: {payload}")

        # Basic payload validation
        if not payload.get("Body", {}).get("stkCallback"):
            logger.warning("Invalid STK callback structure")
            return Response({"ResultCode": 1, "ResultDesc": "Invalid payload"})

        checkout_request_id = payload["Body"]["stkCallback"].get("CheckoutRequestID")

        # Find the transaction to get station context
        try:
            mpesa_txn = MpesaTransaction.objects.get(checkout_request_id=checkout_request_id)
            station_id = str(mpesa_txn.station.id)
        except MpesaTransaction.DoesNotExist:
            logger.error(f"Callback for unknown CheckoutRequestID: {checkout_request_id}")
            # Acknowledge to Safaricom but log for investigation
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        # Queue async processing - return immediately to Safaricom
        process_stk_callback_task.delay(payload, station_id)

        # Always return success to Safaricom (process asynchronously)
        return Response({"ResultCode": 0, "ResultDesc": "Accepted successfully"})


class C2BValidationView(APIView):
    """C2B validation endpoint - validates payment before processing"""
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data
        logger.info(f"C2B validation: {payload}")

        # Accept all valid payments (add business logic here)
        # e.g., check bill reference is valid shift/account
        return Response({
            "ResultCode": 0,
            "ResultDesc": "Accepted"
        })


class C2BConfirmationView(APIView):
    """C2B confirmation - payment successfully processed"""
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data
        logger.info(f"C2B confirmation: {payload}")

        try:
            processed = daraja_service.process_c2b_payment(payload)

            # Create M-Pesa transaction record
            # Station lookup by shortcode
            from apps.stations.models import Station
            station = Station.objects.filter(
                mpesa_shortcode=processed.get("business_shortcode")
            ).first()

            if station:
                MpesaTransaction.objects.create(
                    station=station,
                    transaction_type=MpesaTransaction.TransactionType.C2B,
                    mpesa_receipt_number=processed["mpesa_receipt_number"],
                    phone_number=processed["phone_number"],
                    amount=Decimal(str(processed["amount"])),
                    status=MpesaTransaction.Status.SUCCESS,
                    callback_payload=payload,
                    completed_at=timezone.now(),
                )
                logger.info(f"C2B payment recorded: {processed['mpesa_receipt_number']}")

        except Exception as e:
            logger.error(f"C2B confirmation error: {e}", exc_info=True)

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class MpesaTransactionListView(APIView):
    """List M-Pesa transactions for current station"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        station = request.user.station
        qs = MpesaTransaction.objects.filter(station=station).order_by("-created_at")

        # Filters
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        serializer = MpesaTransactionListSerializer(qs[:50], many=True)
        return Response(serializer.data)


class CheckSTKStatusView(APIView):
    """Query status of STK Push"""
    permission_classes = [IsAuthenticated]

    def get(self, request, checkout_request_id):
        try:
            txn = MpesaTransaction.objects.get(
                checkout_request_id=checkout_request_id,
                station=request.user.station
            )
            serializer = MpesaTransactionSerializer(txn)
            return Response(serializer.data)
        except MpesaTransaction.DoesNotExist:
            return Response({"detail": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)
