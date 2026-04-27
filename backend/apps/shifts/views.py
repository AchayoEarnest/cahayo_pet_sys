"""
Shift Management Views
Complete shift lifecycle: open → record → close → reconcile
"""

import logging
from django.utils import timezone
from django.db import transaction as db_transaction
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import Shift
from .serializers import (
    ShiftSerializer, ShiftOpenSerializer, ShiftCloseSerializer,
    ShiftDetailSerializer, ShiftSummarySerializer,
)
from apps.authentication.permissions import IsManagerOrAbove, StationAccessPermission
from apps.pumps.models import Nozzle, ShiftNozzleReading

logger = logging.getLogger("apps.shifts")


class OpenShiftView(APIView):
    """Open a new shift with nozzle opening readings"""
    permission_classes = [IsAuthenticated]

    @db_transaction.atomic
    def post(self, request):
        serializer = ShiftOpenSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        station = request.user.station
        if not station:
            return Response(
                {"detail": "You must be assigned to a station to open a shift."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check for already open shift for this attendant
        open_shift = Shift.objects.filter(
            station=station,
            attendant=request.user,
            status=Shift.Status.OPEN
        ).first()

        if open_shift:
            return Response(
                {
                    "detail": "You already have an open shift.",
                    "shift_id": str(open_shift.id),
                    "shift_number": open_shift.shift_number,
                },
                status=status.HTTP_409_CONFLICT
            )

        # Create shift
        shift = Shift.objects.create(
            station=station,
            shift_number=Shift.generate_shift_number(station),
            attendant=data.get("attendant", request.user),
            opened_by=request.user,
            opening_float=data.get("opening_float", 0),
            shift_date=timezone.localdate(),
        )

        # Record opening nozzle readings
        nozzle_readings = data.get("nozzle_readings", [])
        created_readings = []

        for reading_data in nozzle_readings:
            try:
                nozzle = Nozzle.objects.get(
                    id=reading_data["nozzle_id"],
                    pump__station=station,
                    status=Nozzle.Status.ACTIVE
                )
                reading = ShiftNozzleReading.objects.create(
                    shift=shift,
                    nozzle=nozzle,
                    opening_reading=reading_data["opening_reading"],
                    recorded_by=request.user,
                )
                # Update current nozzle reading
                nozzle.current_reading = reading_data["opening_reading"]
                nozzle.save(update_fields=["current_reading"])
                created_readings.append(reading)

            except Nozzle.DoesNotExist:
                db_transaction.set_rollback(True)
                return Response(
                    {"detail": f"Nozzle {reading_data['nozzle_id']} not found or inactive."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        logger.info(f"Shift opened: {shift.shift_number} by {request.user.email}")

        return Response(
            ShiftDetailSerializer(shift).data,
            status=status.HTTP_201_CREATED
        )


class CloseShiftView(APIView):
    """Close a shift with nozzle closing readings"""
    permission_classes = [IsAuthenticated]

    @db_transaction.atomic
    def post(self, request, shift_id):
        try:
            shift = Shift.objects.get(
                id=shift_id,
                station=request.user.station,
                status=Shift.Status.OPEN,
            )
        except Shift.DoesNotExist:
            return Response(
                {"detail": "Open shift not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ShiftCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Update closing nozzle readings
        nozzle_readings = data.get("nozzle_readings", [])
        for reading_data in nozzle_readings:
            try:
                reading = ShiftNozzleReading.objects.get(
                    shift=shift,
                    nozzle_id=reading_data["nozzle_id"]
                )

                if reading_data["closing_reading"] < reading.opening_reading:
                    return Response(
                        {
                            "detail": f"Closing reading ({reading_data['closing_reading']}) cannot be "
                                      f"less than opening reading ({reading.opening_reading}) "
                                      f"for nozzle {reading_data['nozzle_id']}."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                reading.closing_reading = reading_data["closing_reading"]
                reading.test_litres = reading_data.get("test_litres", 0)
                reading.closing_recorded_at = timezone.now()

                # Calculate litres and revenue
                from apps.stations.models import StationFuelPrice
                price_obj = StationFuelPrice.objects.filter(
                    station=shift.station,
                    fuel_type=reading.nozzle.fuel_type,
                    is_current=True
                ).first()

                price = price_obj.price_per_litre if price_obj else 0
                reading.litres_sold = reading.calculate_litres_sold()
                reading.expected_revenue = reading.calculate_expected_revenue(price)
                reading.save()

                # Update nozzle current reading
                reading.nozzle.current_reading = reading_data["closing_reading"]
                reading.nozzle.save(update_fields=["current_reading"])

            except ShiftNozzleReading.DoesNotExist:
                return Response(
                    {"detail": f"Opening reading not found for nozzle {reading_data['nozzle_id']}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Record dip readings if provided
        dip_readings = data.get("dip_readings", [])
        for dip in dip_readings:
            from apps.tanks.models import DipReading
            DipReading.objects.create(
                tank_id=dip["tank_id"],
                shift=shift,
                reading_type="closing",
                dip_mm=dip["dip_mm"],
                litres=dip["litres"],
                book_stock=dip.get("book_stock"),
                recorded_by=request.user,
            )

        # Close the shift (calculates all variances)
        shift.close(closed_by=request.user, notes=data.get("notes", ""))

        logger.info(
            f"Shift closed: {shift.shift_number} | "
            f"Revenue: {shift.actual_revenue} | "
            f"Variance: {shift.revenue_variance} | "
            f"Flagged: {shift.is_flagged}"
        )

        # Send flagged shift alert
        if shift.is_flagged:
            from apps.notifications.tasks import alert_shift_variance
            alert_shift_variance.delay(str(shift.id))

        return Response(ShiftDetailSerializer(shift).data)


class ShiftListView(generics.ListAPIView):
    """List shifts for current station"""
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "attendant", "shift_date"]
    ordering_fields = ["opened_at", "shift_date", "total_litres_sold"]

    def get_queryset(self):
        qs = Shift.objects.filter(
            station=self.request.user.station
        ).select_related("attendant", "opened_by", "closed_by")

        # Date filters
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(shift_date__gte=date_from)
        if date_to:
            qs = qs.filter(shift_date__lte=date_to)

        # Flagged only
        if self.request.query_params.get("flagged"):
            qs = qs.filter(is_flagged=True)

        return qs


class ShiftDetailView(generics.RetrieveAPIView):
    serializer_class = ShiftDetailSerializer
    permission_classes = [IsAuthenticated, StationAccessPermission]

    def get_queryset(self):
        return Shift.objects.filter(
            station=self.request.user.station
        ).select_related("attendant", "station")


class CurrentShiftView(APIView):
    """Get the currently open shift for the authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shift = Shift.objects.filter(
            station=request.user.station,
            attendant=request.user,
            status=Shift.Status.OPEN,
        ).first()

        if not shift:
            return Response({"detail": "No open shift found.", "shift": None})

        return Response(ShiftDetailSerializer(shift).data)


class ShiftSummaryView(APIView):
    """Daily summary of all shifts for a station"""
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        from django.db.models import Sum, Count, Avg
        date = request.query_params.get("date", str(timezone.localdate()))
        station = request.user.station

        shifts = Shift.objects.filter(station=station, shift_date=date)
        summary = shifts.aggregate(
            total_shifts=Count("id"),
            total_revenue=Sum("actual_revenue"),
            total_litres=Sum("total_litres_sold"),
            total_cash=Sum("total_cash"),
            total_mpesa=Sum("total_mpesa"),
            total_card=Sum("total_card"),
            flagged_count=Count("id", filter=models.Q(is_flagged=True)),
        )
        summary["date"] = date
        summary["open_shifts"] = shifts.filter(status=Shift.Status.OPEN).count()

        return Response(summary)
