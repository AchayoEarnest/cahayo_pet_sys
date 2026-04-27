"""
Pump Management Models
Pumps → Nozzles → linked to fuel types and shifts
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Pump(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MAINTENANCE = "maintenance", "Under Maintenance"
        DECOMMISSIONED = "decommissioned", "Decommissioned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="pumps")
    number = models.PositiveIntegerField(help_text="Pump number/label on forecourt")
    name = models.CharField(max_length=100, help_text="e.g. Pump 1, Island A")
    model = models.CharField(max_length=100, blank=True, help_text="e.g. Gilbarco Encore 700")
    serial_number = models.CharField(max_length=100, blank=True)
    installation_date = models.DateField(null=True, blank=True)
    last_calibration = models.DateField(null=True, blank=True)
    next_calibration = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    tank = models.ForeignKey(
        "tanks.Tank", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="pumps",
        help_text="Primary tank supplying this pump"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pumps"
        unique_together = [["station", "number"]]
        ordering = ["station", "number"]
        indexes = [models.Index(fields=["station", "status"])]

    def __str__(self):
        return f"{self.station.code} - Pump {self.number}"


class Nozzle(models.Model):
    """Each pump can have multiple nozzles dispensing different fuel grades"""
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        FAULTY = "faulty", "Faulty"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pump = models.ForeignKey(Pump, on_delete=models.CASCADE, related_name="nozzles")
    number = models.PositiveIntegerField(help_text="Nozzle number on pump (1, 2, 3...)")
    fuel_type = models.ForeignKey("stations.FuelType", on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # Current cumulative meter reading (totalizer)
    current_reading = models.DecimalField(
        max_digits=12, decimal_places=3, default=Decimal("0.000"),
        validators=[MinValueValidator(Decimal("0"))]
    )

    class Meta:
        db_table = "nozzles"
        unique_together = [["pump", "number"]]
        ordering = ["pump", "number"]

    def __str__(self):
        return f"{self.pump} - Nozzle {self.number} ({self.fuel_type.code})"


class ShiftNozzleReading(models.Model):
    """Meter readings captured at shift open/close for each nozzle"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shift = models.ForeignKey("shifts.Shift", on_delete=models.CASCADE, related_name="nozzle_readings")
    nozzle = models.ForeignKey(Nozzle, on_delete=models.PROTECT, related_name="shift_readings")

    opening_reading = models.DecimalField(
        max_digits=12, decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))]
    )
    closing_reading = models.DecimalField(
        max_digits=12, decimal_places=3,
        null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))]
    )

    # Calculated on shift close
    litres_sold = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True
    )
    expected_revenue = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )

    # Test litres (calibration waste)
    test_litres = models.DecimalField(
        max_digits=8, decimal_places=3, default=Decimal("0.000")
    )

    recorded_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True
    )
    opening_recorded_at = models.DateTimeField(auto_now_add=True)
    closing_recorded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "shift_nozzle_readings"
        unique_together = [["shift", "nozzle"]]
        indexes = [models.Index(fields=["shift", "nozzle"])]

    def calculate_litres_sold(self):
        """Calculate litres sold = closing - opening - test litres"""
        if self.closing_reading is None:
            return None
        if self.closing_reading < self.opening_reading:
            raise ValueError(
                f"Closing reading ({self.closing_reading}) cannot be less than "
                f"opening reading ({self.opening_reading}) for nozzle {self.nozzle}"
            )
        return self.closing_reading - self.opening_reading - self.test_litres

    def calculate_expected_revenue(self, price_per_litre):
        """Expected revenue based on meter reading difference"""
        litres = self.calculate_litres_sold()
        if litres is None:
            return None
        return litres * price_per_litre

    def __str__(self):
        return f"Shift {self.shift.id} - {self.nozzle} reading"
