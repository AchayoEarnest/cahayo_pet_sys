"""
Cahayo FMS - Comprehensive Test Suite
Tests for authentication, shifts, transactions, and M-Pesa integration
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from apps.authentication.models import User
from apps.stations.models import Station, FuelType, StationFuelPrice
from apps.pumps.models import Pump, Nozzle, ShiftNozzleReading
from apps.tanks.models import Tank
from apps.shifts.models import Shift
from apps.transactions.models import Transaction
from apps.mpesa.models import MpesaTransaction


# ── Factories ─────────────────────────────────────────────────────────────────

def make_station(**kwargs):
    defaults = dict(
        name="Test Station Nairobi",
        code="NRB-001",
        address="Mombasa Road, Nairobi",
        phone="0700000000",
        mpesa_shortcode="174379",
    )
    defaults.update(kwargs)
    return Station.objects.create(**defaults)


def make_user(station=None, role="manager", **kwargs):
    defaults = dict(
        email=f"user_{timezone.now().timestamp()}@cahayo.co.ke",
        first_name="Test",
        last_name="User",
        role=role,
        station=station,
    )
    defaults.update(kwargs)
    user = User.objects.create_user(password="TestPass123!", **defaults)
    return user


def make_fuel_type(**kwargs):
    defaults = dict(name="Petrol", code="PMS", color="#3b82f6", unit="L")
    defaults.update(kwargs)
    return FuelType.objects.get_or_create(code=defaults["code"], defaults=defaults)[0]


def make_pump(station, tank=None, **kwargs):
    defaults = dict(number=1, name="Pump 1", status="active", tank=tank)
    defaults.update(kwargs)
    return Pump.objects.create(station=station, **defaults)


def make_nozzle(pump, fuel_type, **kwargs):
    defaults = dict(number=1, status="active", current_reading=Decimal("1000.000"))
    defaults.update(kwargs)
    return Nozzle.objects.create(pump=pump, fuel_type=fuel_type, **defaults)


def make_tank(station, fuel_type, **kwargs):
    defaults = dict(
        number=1,
        name="Tank 1",
        capacity_litres=Decimal("50000.00"),
        safe_fill_level=Decimal("47500.00"),
        reorder_level=Decimal("5000.00"),
        current_stock=Decimal("25000.00"),
        status="operational",
    )
    defaults.update(kwargs)
    return Tank.objects.create(station=station, fuel_type=fuel_type, **defaults)


def make_fuel_price(station, fuel_type, price=Decimal("205.00")):
    return StationFuelPrice.objects.create(
        station=station,
        fuel_type=fuel_type,
        price_per_litre=price,
        effective_from=timezone.now(),
        is_current=True,
    )


# ── Authentication Tests ──────────────────────────────────────────────────────

class AuthenticationTestCase(APITestCase):
    def setUp(self):
        self.station = make_station()
        self.user = make_user(
            station=self.station,
            role="manager",
            email="manager@cahayo.co.ke",
        )
        self.client = APIClient()

    def test_login_success(self):
        url = reverse("login")
        response = self.client.post(url, {"email": "manager@cahayo.co.ke", "password": "TestPass123!"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["role"], "manager")

    def test_login_wrong_password(self):
        url = reverse("login")
        response = self.client.post(url, {"email": "manager@cahayo.co.ke", "password": "WrongPassword"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        url = reverse("login")
        response = self.client.post(url, {"email": "manager@cahayo.co.ke", "password": "TestPass123!"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_profile_requires_auth(self):
        url = reverse("profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_user_data(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "manager@cahayo.co.ke")
        self.assertEqual(response.data["station_name"], self.station.name)

    def test_change_password(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("change-password")
        response = self.client.post(url, {
            "old_password": "TestPass123!",
            "new_password": "NewSecure456!",
            "confirm_new_password": "NewSecure456!",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecure456!"))

    def test_pin_login(self):
        from django.contrib.auth.hashers import make_password
        self.user.pin = make_password("1234")
        self.user.save()

        url = reverse("pin-login")
        response = self.client.post(url, {"email": "manager@cahayo.co.ke", "pin": "1234"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_role_permissions_attendant_cannot_see_users(self):
        attendant = make_user(station=self.station, role="attendant", email="att@cahayo.co.ke")
        self.client.force_authenticate(user=attendant)
        url = reverse("user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ── Shift Tests ───────────────────────────────────────────────────────────────

class ShiftTestCase(APITestCase):
    def setUp(self):
        self.station = make_station()
        self.fuel_type = make_fuel_type()
        self.tank = make_tank(self.station, self.fuel_type)
        self.pump = make_pump(self.station, self.tank)
        self.nozzle = make_nozzle(self.pump, self.fuel_type, current_reading=Decimal("10000.000"))
        self.price = make_fuel_price(self.station, self.fuel_type, Decimal("205.00"))

        self.attendant = make_user(station=self.station, role="attendant", email="att@cahayo.co.ke")
        self.manager = make_user(station=self.station, role="manager", email="mgr@cahayo.co.ke")
        self.client = APIClient()

    def _open_shift(self, user=None):
        self.client.force_authenticate(user=user or self.attendant)
        url = reverse("shift-open")
        return self.client.post(url, {
            "opening_float": 5000,
            "nozzle_readings": [
                {"nozzle_id": str(self.nozzle.id), "opening_reading": "10000.000"}
            ],
        }, format="json")

    def test_open_shift_success(self):
        response = self._open_shift()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "open")
        self.assertIn("shift_number", response.data)
        self.assertEqual(Shift.objects.count(), 1)

    def test_cannot_open_duplicate_shift(self):
        self._open_shift()
        response = self._open_shift()
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_user_without_station_cannot_open_shift(self):
        homeless_user = make_user(station=None, role="attendant", email="homeless@cahayo.co.ke")
        self.client.force_authenticate(user=homeless_user)
        url = reverse("shift-open")
        response = self.client.post(url, {
            "nozzle_readings": [
                {"nozzle_id": str(self.nozzle.id), "opening_reading": "10000.000"}
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_close_shift_calculates_correctly(self):
        # Open shift
        open_resp = self._open_shift()
        shift_id = open_resp.data["id"]

        # Record a transaction
        shift = Shift.objects.get(id=shift_id)
        Transaction.objects.create(
            shift=shift,
            station=self.station,
            nozzle=self.nozzle,
            attendant=self.attendant,
            fuel_type=self.fuel_type,
            litres=Decimal("100.000"),
            price_per_litre=Decimal("205.00"),
            amount=Decimal("20500.00"),
            payment_method="cash",
            status="completed",
        )

        # Close shift with closing reading
        url = reverse("shift-close", kwargs={"shift_id": shift_id})
        response = self.client.post(url, {
            "nozzle_readings": [
                {
                    "nozzle_id": str(self.nozzle.id),
                    "closing_reading": "10100.000",  # 100 litres sold
                    "test_litres": "0",
                }
            ],
            "cash_collected": "20500.00",
            "notes": "Clean shift",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "closed")

        shift.refresh_from_db()
        self.assertEqual(shift.total_litres_sold, Decimal("100.000"))
        self.assertEqual(shift.actual_revenue, Decimal("20500.00"))
        self.assertEqual(shift.total_cash, Decimal("20500.00"))

    def test_closing_reading_less_than_opening_rejected(self):
        open_resp = self._open_shift()
        shift_id = open_resp.data["id"]
        url = reverse("shift-close", kwargs={"shift_id": shift_id})
        response = self.client.post(url, {
            "nozzle_readings": [
                {"nozzle_id": str(self.nozzle.id), "closing_reading": "9999.000"}
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_shift_variance_flagging(self):
        """Shifts with >1% variance should be auto-flagged"""
        open_resp = self._open_shift()
        shift_id = open_resp.data["id"]
        shift = Shift.objects.get(id=shift_id)

        # Record 100L sold via meter, but only KES 10000 collected (should be 20500)
        Transaction.objects.create(
            shift=shift, station=self.station, nozzle=self.nozzle,
            attendant=self.attendant, fuel_type=self.fuel_type,
            litres=Decimal("100.000"), price_per_litre=Decimal("205.00"),
            amount=Decimal("10000.00"),  # Short by 10500
            payment_method="cash", status="completed",
        )

        url = reverse("shift-close", kwargs={"shift_id": shift_id})
        self.client.post(url, {
            "nozzle_readings": [
                {"nozzle_id": str(self.nozzle.id), "closing_reading": "10100.000"}
            ],
        }, format="json")

        shift.refresh_from_db()
        self.assertTrue(shift.is_flagged)
        self.assertIn("variance", shift.flag_reason.lower())

    def test_shift_number_format(self):
        response = self._open_shift()
        shift_number = response.data["shift_number"]
        # Should match format: CODE-YYYYMMDD-NNN
        self.assertRegex(shift_number, r"NRB-001-\d{8}-\d{3}")

    def test_current_shift_endpoint(self):
        self._open_shift()
        self.client.force_authenticate(user=self.attendant)
        url = reverse("shift-current")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data.get("shift_number") or response.data.get("shift", {}).get("shift_number"))


# ── Transaction Tests ─────────────────────────────────────────────────────────

class TransactionTestCase(APITestCase):
    def setUp(self):
        self.station = make_station()
        self.fuel_type = make_fuel_type()
        self.tank = make_tank(self.station, self.fuel_type)
        self.pump = make_pump(self.station, self.tank)
        self.nozzle = make_nozzle(self.pump, self.fuel_type)
        self.attendant = make_user(station=self.station, role="attendant", email="att@t.ke")
        self.client = APIClient()
        self.client.force_authenticate(user=self.attendant)

        # Create open shift
        self.shift = Shift.objects.create(
            station=self.station,
            shift_number="NRB-001-20240101-001",
            attendant=self.attendant,
            opened_by=self.attendant,
        )

    def test_create_cash_transaction(self):
        url = reverse("transaction-list")
        response = self.client.post(url, {
            "shift": str(self.shift.id),
            "nozzle": str(self.nozzle.id),
            "fuel_type": str(self.fuel_type.id),
            "litres": "50.000",
            "price_per_litre": "205.00",
            "amount": "10250.00",
            "payment_method": "cash",
            "status": "completed",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("reference", response.data)

    def test_transaction_reference_is_unique(self):
        txn1 = Transaction.objects.create(
            shift=self.shift, station=self.station, nozzle=self.nozzle,
            attendant=self.attendant, fuel_type=self.fuel_type,
            litres=Decimal("10.000"), price_per_litre=Decimal("205.00"),
            amount=Decimal("2050.00"), payment_method="cash",
        )
        txn2 = Transaction.objects.create(
            shift=self.shift, station=self.station, nozzle=self.nozzle,
            attendant=self.attendant, fuel_type=self.fuel_type,
            litres=Decimal("5.000"), price_per_litre=Decimal("205.00"),
            amount=Decimal("1025.00"), payment_method="cash",
        )
        self.assertNotEqual(txn1.reference, txn2.reference)


# ── M-Pesa Tests ──────────────────────────────────────────────────────────────

class MpesaTestCase(APITestCase):
    def setUp(self):
        self.station = make_station()
        self.user = make_user(station=self.station, role="attendant", email="att@mpesa.ke")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.shift = Shift.objects.create(
            station=self.station,
            shift_number="NRB-001-20240101-001",
            attendant=self.user,
            opened_by=self.user,
        )

    @patch("apps.mpesa.services.DarajaService.initiate_stk_push")
    def test_stk_push_success(self, mock_stk):
        mock_stk.return_value = {
            "success": True,
            "merchant_request_id": "MOCK-MRI-001",
            "checkout_request_id": "ws_CO_MOCK_001",
            "customer_message": "Please enter your M-Pesa PIN",
            "raw": {},
        }

        url = reverse("stk-push")
        response = self.client.post(url, {
            "phone_number": "0712345678",
            "amount": "5000",
            "shift_id": str(self.shift.id),
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(MpesaTransaction.objects.count(), 1)

        txn = MpesaTransaction.objects.first()
        self.assertEqual(txn.status, "pending")
        self.assertEqual(txn.checkout_request_id, "ws_CO_MOCK_001")

    @patch("apps.mpesa.services.DarajaService.initiate_stk_push")
    def test_stk_push_failure_from_daraja(self, mock_stk):
        mock_stk.return_value = {
            "success": False,
            "error": "Invalid phone number",
            "raw": {},
        }
        url = reverse("stk-push")
        response = self.client.post(url, {
            "phone_number": "0712345678",
            "amount": "5000",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stk_callback_success(self):
        # Create pending M-Pesa transaction
        txn = MpesaTransaction.objects.create(
            station=self.station,
            transaction_type="stk_push",
            merchant_request_id="MOCK-MRI-001",
            checkout_request_id="ws_CO_MOCK_001",
            phone_number="254712345678",
            amount=Decimal("5000.00"),
            status="pending",
        )

        payload = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "MOCK-MRI-001",
                    "CheckoutRequestID": "ws_CO_MOCK_001",
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 5000},
                            {"Name": "MpesaReceiptNumber", "Value": "QGH1234ABC"},
                            {"Name": "PhoneNumber", "Value": 254712345678},
                            {"Name": "TransactionDate", "Value": 20240101120000},
                        ]
                    },
                }
            }
        }

        # Test public callback endpoint (no auth required)
        anon_client = APIClient()
        url = reverse("stk-callback")

        with patch("apps.mpesa.tasks.process_stk_callback_task.delay") as mock_task:
            response = anon_client.post(url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["ResultCode"], 0)
            mock_task.assert_called_once()

    def test_phone_normalization(self):
        from apps.mpesa.services import DarajaService
        svc = DarajaService()
        self.assertEqual(svc._normalize_phone("0712345678"), "254712345678")
        self.assertEqual(svc._normalize_phone("+254712345678"), "254712345678")
        self.assertEqual(svc._normalize_phone("254712345678"), "254712345678")

    def test_stk_push_requires_station(self):
        user_no_station = make_user(station=None, role="attendant", email="nostation@cahayo.ke")
        self.client.force_authenticate(user=user_no_station)
        url = reverse("stk-push")
        response = self.client.post(url, {"phone_number": "0712345678", "amount": "100"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ── Report Tests ──────────────────────────────────────────────────────────────

class ReportTestCase(APITestCase):
    def setUp(self):
        self.station = make_station()
        self.fuel_type = make_fuel_type()
        self.tank = make_tank(self.station, self.fuel_type)
        self.manager = make_user(station=self.station, role="manager", email="mgr@rpt.ke")
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

        # Create test shifts and transactions
        self.shift = Shift.objects.create(
            station=self.station,
            shift_number="NRB-001-TEST-001",
            attendant=self.manager,
            opened_by=self.manager,
            status="closed",
            shift_date=timezone.localdate(),
            actual_revenue=Decimal("50000.00"),
            expected_revenue=Decimal("50200.00"),
            total_litres_sold=Decimal("250.000"),
            total_cash=Decimal("30000.00"),
            total_mpesa=Decimal("20000.00"),
        )

    def test_dashboard_kpi(self):
        url = reverse("kpi-dashboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("today", response.data)
        self.assertIn("tanks", response.data)
        self.assertIn("station", response.data)

    def test_daily_report(self):
        url = reverse("daily-report")
        response = self.client.get(url, {"date": str(timezone.localdate())})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("shifts", response.data)
        self.assertIn("fuel_breakdown", response.data)

    def test_shift_performance(self):
        url = reverse("shift-performance")
        response = self.client.get(url, {"days": "7"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("daily_breakdown", response.data)

    def test_attendant_cannot_access_reports(self):
        attendant = make_user(station=self.station, role="attendant", email="att@rpt.ke")
        self.client.force_authenticate(user=attendant)
        url = reverse("daily-report")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ── Tank Tests ────────────────────────────────────────────────────────────────

class TankTestCase(TestCase):
    def setUp(self):
        self.station = make_station()
        self.fuel_type = make_fuel_type()
        self.tank = make_tank(
            self.station, self.fuel_type,
            capacity_litres=Decimal("50000.00"),
            current_stock=Decimal("25000.00"),
            reorder_level=Decimal("5000.00"),
        )

    def test_fill_percentage(self):
        self.assertEqual(self.tank.fill_percentage, 50.0)

    def test_is_low_false_when_above_reorder(self):
        self.assertFalse(self.tank.is_low)

    def test_is_low_true_when_below_reorder(self):
        self.tank.current_stock = Decimal("4999.00")
        self.tank.save()
        self.assertTrue(self.tank.is_low)

    def test_available_space(self):
        expected = Decimal("47500.00") - Decimal("25000.00")
        self.assertEqual(self.tank.available_space, expected)


# ── Model Tests ───────────────────────────────────────────────────────────────

class ShiftModelTestCase(TestCase):
    def setUp(self):
        self.station = make_station()
        self.fuel_type = make_fuel_type()
        self.tank = make_tank(self.station, self.fuel_type)
        self.pump = make_pump(self.station, self.tank)
        self.nozzle = make_nozzle(self.pump, self.fuel_type)
        self.user = make_user(station=self.station, role="attendant")

    def test_generate_shift_number(self):
        shift_num = Shift.generate_shift_number(self.station)
        today = timezone.localdate().strftime("%Y%m%d")
        self.assertIn(today, shift_num)
        self.assertIn("NRB-001", shift_num)

    def test_shift_duration_calculation(self):
        shift = Shift.objects.create(
            station=self.station,
            shift_number="TEST-001",
            attendant=self.user,
            opened_by=self.user,
        )
        self.assertGreaterEqual(shift.duration_hours, 0)


class NozzleReadingTestCase(TestCase):
    def setUp(self):
        station = make_station()
        fuel_type = make_fuel_type()
        pump = make_pump(station)
        self.nozzle = make_nozzle(pump, fuel_type, current_reading=Decimal("1000.000"))
        user = make_user(station=station)
        self.shift = Shift.objects.create(
            station=station, shift_number="TEST-001", attendant=user, opened_by=user
        )

    def test_calculate_litres_sold(self):
        reading = ShiftNozzleReading(
            shift=self.shift,
            nozzle=self.nozzle,
            opening_reading=Decimal("1000.000"),
            closing_reading=Decimal("1100.000"),
            test_litres=Decimal("0.000"),
        )
        self.assertEqual(reading.calculate_litres_sold(), Decimal("100.000"))

    def test_calculate_litres_sold_with_test_litres(self):
        reading = ShiftNozzleReading(
            shift=self.shift,
            nozzle=self.nozzle,
            opening_reading=Decimal("1000.000"),
            closing_reading=Decimal("1100.500"),
            test_litres=Decimal("0.500"),
        )
        self.assertEqual(reading.calculate_litres_sold(), Decimal("100.000"))

    def test_closing_less_than_opening_raises_error(self):
        reading = ShiftNozzleReading(
            shift=self.shift,
            nozzle=self.nozzle,
            opening_reading=Decimal("1000.000"),
            closing_reading=Decimal("999.000"),
            test_litres=Decimal("0.000"),
        )
        with self.assertRaises(ValueError):
            reading.calculate_litres_sold()

    def test_expected_revenue_calculation(self):
        reading = ShiftNozzleReading(
            shift=self.shift,
            nozzle=self.nozzle,
            opening_reading=Decimal("1000.000"),
            closing_reading=Decimal("1100.000"),
            test_litres=Decimal("0.000"),
        )
        revenue = reading.calculate_expected_revenue(Decimal("205.00"))
        self.assertEqual(revenue, Decimal("20500.000"))
