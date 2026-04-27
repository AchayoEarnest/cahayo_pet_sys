"""
Shift Management Models
Core operational entity - all sales and readings tied to a shift
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone


class Shift(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        RECONCILED = "reconciled", "Reconciled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="shifts")
    shift_number = models.CharField(max_length=20, help_text="Human-readable shift ID e.g. NRB-2024-001-A")

    # Personnel
    attendant = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True,
        related_name="attended_shifts"
    )
    opened_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True,
        related_name="opened_shifts"
    )
    closed_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="closed_shifts"
    )

    # Timing
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    shift_date = models.DateField(default=timezone.localdate)

    # Financial summary (computed on close)
    total_cash = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_mpesa = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_card = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_credit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    # Meter-based totals (from nozzle readings)
    expected_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    actual_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    # Cash handling
    opening_float = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    cash_collected = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    cash_variance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    # Volume totals
    total_litres_sold = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0.000"))

    # Variance (positive = overage, negative = shortage)
    revenue_variance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    variance_percentage = models.DecimalField(max_digits=6, decimal_places=3, default=Decimal("0.000"))

    notes = models.TextField(blank=True)
    is_flagged = models.BooleanField(default=False, help_text="Flagged for review due to discrepancies")
    flag_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shifts"
        ordering = ["-opened_at"]
        indexes = [
            models.Index(fields=["station", "shift_date"]),
            models.Index(fields=["station", "status"]),
            models.Index(fields=["attendant", "shift_date"]),
            models.Index(fields=["shift_number"]),
        ]

    def __str__(self):
        return f"{self.shift_number} - {self.attendant} ({self.status})"

    @property
    def duration_hours(self):
        if self.closed_at:
            return round((self.closed_at - self.opened_at).total_seconds() / 3600, 2)
        return round((timezone.now() - self.opened_at).total_seconds() / 3600, 2)

    def close(self, closed_by, notes=""):
        """Close the shift and compute financial summary"""
        from apps.pumps.models import ShiftNozzleReading
        from apps.transactions.models import Transaction

        self.closed_at = timezone.now()
        self.closed_by = closed_by
        self.status = Shift.Status.CLOSED
        self.notes = notes

        # Compute transaction totals
        txns = Transaction.objects.filter(shift=self)
        self.total_cash = sum(t.amount for t in txns if t.payment_method == "cash")
        self.total_mpesa = sum(t.amount for t in txns if t.payment_method == "mpesa")
        self.total_card = sum(t.amount for t in txns if t.payment_method == "card")
        self.total_credit = sum(t.amount for t in txns if t.payment_method == "credit")
        self.actual_revenue = self.total_cash + self.total_mpesa + self.total_card + self.total_credit

        # Compute meter-based expected revenue
        readings = ShiftNozzleReading.objects.filter(shift=self).select_related("nozzle__fuel_type")
        self.expected_revenue = sum(r.expected_revenue or 0 for r in readings)
        self.total_litres_sold = sum(r.litres_sold or 0 for r in readings)

        # Variance
        self.revenue_variance = self.actual_revenue - self.expected_revenue
        if self.expected_revenue > 0:
            self.variance_percentage = (self.revenue_variance / self.expected_revenue) * 100

        # Flag if variance > 1%
        if abs(self.variance_percentage) > 1:
            self.is_flagged = True
            self.flag_reason = f"Revenue variance of {self.variance_percentage:.2f}% detected"

        self.save()
        return self

    @classmethod
    def generate_shift_number(cls, station):
        """Generate shift number e.g. NRB-001-20240115-001"""
        from django.utils import timezone
        today = timezone.localdate()
        count = cls.objects.filter(station=station, shift_date=today).count() + 1
        return f"{station.code}-{today.strftime('%Y%m%d')}-{count:03d}"
