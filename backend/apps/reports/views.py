"""
Reports & Analytics Views
Daily sales, shift performance, fuel variance, attendant performance
"""

from datetime import date, timedelta
from decimal import Decimal
from django.db.models import Sum, Count, Avg, Q, F
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import IsManagerOrAbove, IsAccountantOrAbove
from apps.shifts.models import Shift
from apps.transactions.models import Transaction
from apps.tanks.models import Tank, DipReading
from apps.authentication.models import User


class DailySalesReportView(APIView):
    """Comprehensive daily sales report"""
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        report_date = request.query_params.get("date", str(timezone.localdate()))
        station = request.user.station

        # Shift summary
        shifts = Shift.objects.filter(station=station, shift_date=report_date)
        shift_data = shifts.aggregate(
            total_shifts=Count("id"),
            open_shifts=Count("id", filter=Q(status="open")),
            closed_shifts=Count("id", filter=Q(status="closed")),
            total_revenue=Sum("actual_revenue"),
            expected_revenue=Sum("expected_revenue"),
            total_litres=Sum("total_litres_sold"),
            total_cash=Sum("total_cash"),
            total_mpesa=Sum("total_mpesa"),
            total_card=Sum("total_card"),
            total_credit=Sum("total_credit"),
        )

        # Transaction breakdown
        transactions = Transaction.objects.filter(
            station=station,
            created_at__date=report_date,
            status=Transaction.Status.COMPLETED,
        )
        txn_data = transactions.aggregate(
            transaction_count=Count("id"),
            avg_transaction=Avg("amount"),
        )

        # Fuel breakdown
        fuel_breakdown = (
            transactions.values("fuel_type__name", "fuel_type__code")
            .annotate(
                litres=Sum("litres"),
                revenue=Sum("amount"),
                count=Count("id"),
            )
            .order_by("-revenue")
        )

        # Payment method breakdown
        payment_breakdown = (
            transactions.values("payment_method")
            .annotate(
                total=Sum("amount"),
                count=Count("id"),
            )
            .order_by("-total")
        )

        # Attendant performance
        attendant_performance = (
            shifts.filter(status="closed")
            .values("attendant__first_name", "attendant__last_name", "attendant__id")
            .annotate(
                shifts=Count("id"),
                revenue=Sum("actual_revenue"),
                litres=Sum("total_litres_sold"),
                variance=Sum("revenue_variance"),
                flagged=Count("id", filter=Q(is_flagged=True)),
            )
            .order_by("-revenue")
        )

        # Expenses
        from apps.accounting.models import Expense
        expenses = Expense.objects.filter(
            station=station, expense_date=report_date
        ).aggregate(total_expenses=Sum("amount"))

        return Response({
            "date": report_date,
            "station": station.name,
            "shifts": {**shift_data, "flagged": shifts.filter(is_flagged=True).count()},
            "transactions": {**txn_data, "count": transactions.count()},
            "fuel_breakdown": list(fuel_breakdown),
            "payment_breakdown": list(payment_breakdown),
            "attendant_performance": list(attendant_performance),
            "expenses": expenses,
            "net_revenue": (shift_data.get("total_revenue") or 0) - (expenses.get("total_expenses") or 0),
        })


class ShiftPerformanceView(APIView):
    """Shift performance analytics over date range"""
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        station = request.user.station
        date_from = timezone.localdate() - timedelta(days=days)

        shifts = Shift.objects.filter(
            station=station,
            shift_date__gte=date_from,
            status=Shift.Status.CLOSED
        )

        daily = (
            shifts.values("shift_date")
            .annotate(
                revenue=Sum("actual_revenue"),
                litres=Sum("total_litres_sold"),
                shifts=Count("id"),
                variance=Sum("revenue_variance"),
                cash=Sum("total_cash"),
                mpesa=Sum("total_mpesa"),
            )
            .order_by("shift_date")
        )

        return Response({
            "period_days": days,
            "date_from": str(date_from),
            "date_to": str(timezone.localdate()),
            "daily_breakdown": list(daily),
            "totals": shifts.aggregate(
                total_revenue=Sum("actual_revenue"),
                total_litres=Sum("total_litres_sold"),
                total_variance=Sum("revenue_variance"),
                flagged_shifts=Count("id", filter=Q(is_flagged=True)),
            ),
        })


class FuelVarianceReportView(APIView):
    """Fuel stock variance analysis"""
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        report_date = request.query_params.get("date", str(timezone.localdate()))
        station = request.user.station

        tanks = Tank.objects.filter(station=station, status="operational")
        tank_data = []

        for tank in tanks:
            # Get latest dip reading
            latest_dip = DipReading.objects.filter(
                tank=tank, recorded_at__date=report_date
            ).order_by("-recorded_at").first()

            # Theoretical stock (book stock)
            from apps.pumps.models import ShiftNozzleReading
            litres_sold_today = ShiftNozzleReading.objects.filter(
                shift__station=station,
                shift__shift_date=report_date,
                nozzle__fuel_type=tank.fuel_type,
            ).aggregate(total=Sum("litres_sold"))["total"] or 0

            # Deliveries today
            from apps.tanks.models import FuelDelivery
            deliveries_today = FuelDelivery.objects.filter(
                tank=tank,
                delivered_at__date=report_date,
                status="verified"
            ).aggregate(total=Sum("delivered_litres"))["total"] or 0

            tank_data.append({
                "tank_id": str(tank.id),
                "tank_name": tank.name,
                "fuel_type": tank.fuel_type.name,
                "capacity": float(tank.capacity_litres),
                "current_stock": float(tank.current_stock),
                "fill_percentage": tank.fill_percentage,
                "reorder_level": float(tank.reorder_level),
                "is_low": tank.is_low,
                "litres_sold_today": float(litres_sold_today),
                "deliveries_today": float(deliveries_today),
                "dip_reading": float(latest_dip.litres) if latest_dip else None,
                "book_variance": float(latest_dip.variance) if latest_dip and latest_dip.variance else None,
            })

        return Response({"date": report_date, "tanks": tank_data})


class AttendantPerformanceView(APIView):
    """Attendant performance report"""
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        station = request.user.station
        date_from = timezone.localdate() - timedelta(days=days)

        performance = (
            Shift.objects.filter(
                station=station,
                shift_date__gte=date_from,
                status=Shift.Status.CLOSED,
                attendant__isnull=False,
            )
            .values(
                "attendant__id",
                "attendant__first_name",
                "attendant__last_name",
                "attendant__email",
            )
            .annotate(
                total_shifts=Count("id"),
                total_revenue=Sum("actual_revenue"),
                total_litres=Sum("total_litres_sold"),
                avg_revenue_per_shift=Avg("actual_revenue"),
                total_variance=Sum("revenue_variance"),
                flagged_shifts=Count("id", filter=Q(is_flagged=True)),
                flag_rate=Count("id", filter=Q(is_flagged=True)) * 100.0 / Count("id"),
            )
            .order_by("-total_revenue")
        )

        return Response({
            "period_days": days,
            "date_from": str(date_from),
            "attendants": list(performance),
        })


class KPIDashboardView(APIView):
    """Real-time KPIs for dashboard"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        station = request.user.station
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        month_start = today.replace(day=1)

        def get_day_stats(d):
            return Shift.objects.filter(
                station=station, shift_date=d
            ).aggregate(
                revenue=Sum("actual_revenue"),
                litres=Sum("total_litres_sold"),
                shifts=Count("id"),
                open_shifts=Count("id", filter=Q(status="open")),
            )

        today_stats = get_day_stats(today)
        yesterday_stats = get_day_stats(yesterday)

        # Month-to-date
        mtd = Shift.objects.filter(
            station=station, shift_date__gte=month_start
        ).aggregate(
            revenue=Sum("actual_revenue"),
            litres=Sum("total_litres_sold"),
        )

        # Tank status
        tanks = Tank.objects.filter(station=station, status="operational").values(
            "id", "name", "fuel_type__name", "current_stock",
            "capacity_litres", "reorder_level"
        )
        tank_data = [
            {
                **t,
                "fill_percentage": round(float(t["current_stock"]) / float(t["capacity_litres"]) * 100, 1),
                "is_low": t["current_stock"] <= t["reorder_level"],
            }
            for t in tanks
        ]

        # Today's revenue change vs yesterday
        today_rev = float(today_stats.get("revenue") or 0)
        yesterday_rev = float(yesterday_stats.get("revenue") or 0)
        revenue_change = (
            ((today_rev - yesterday_rev) / yesterday_rev * 100)
            if yesterday_rev > 0 else 0
        )

        return Response({
            "today": {
                "revenue": today_rev,
                "litres": float(today_stats.get("litres") or 0),
                "shifts": today_stats.get("shifts") or 0,
                "open_shifts": today_stats.get("open_shifts") or 0,
                "revenue_change_pct": round(revenue_change, 1),
            },
            "month_to_date": {
                "revenue": float(mtd.get("revenue") or 0),
                "litres": float(mtd.get("litres") or 0),
            },
            "tanks": tank_data,
            "station": {
                "name": station.name,
                "code": station.code,
            },
        })
