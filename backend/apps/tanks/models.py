"""
Tank Management Models
Wet stock management: deliveries, dip readings, variance detection
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Tank(models.Model):
    class Status(models.TextChoices):
        OPERATIONAL = "operational", "Operational"
        MAINTENANCE = "maintenance", "Under Maintenance"
        DECOMMISSIONED = "decommissioned", "Decommissioned"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="tanks")
    number = models.PositiveIntegerField()
    name = models.CharField(max_length=100, help_text="e.g. Tank 1 (Petrol)")
    fuel_type = models.ForeignKey("stations.FuelType", on_delete=models.PROTECT)
    capacity_litres = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Total tank capacity in litres"
    )
    safe_fill_level = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text="Maximum safe fill level (usually 95% of capacity)"
    )
    reorder_level = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text="Stock level that triggers reorder alert"
    )
    current_stock = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"),
        help_text="Current estimated stock in litres"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPERATIONAL)
    installation_date = models.DateField(null=True, blank=True)
    last_inspection = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tanks"
        unique_together = [["station", "number"]]
        ordering = ["station", "number"]

    def __str__(self):
        return f"{self.station.code} - Tank {self.number} ({self.fuel_type.code})"

    @property
    def fill_percentage(self):
        if self.capacity_litres == 0:
            return 0
        return float(self.current_stock / self.capacity_litres * 100)

    @property
    def is_low(self):
        return self.current_stock <= self.reorder_level

    @property
    def available_space(self):
        return self.safe_fill_level - self.current_stock


class FuelDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        DELIVERED = "delivered", "Delivered"
        VERIFIED = "verified", "Verified"
        DISPUTED = "disputed", "Disputed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tank = models.ForeignKey(Tank, on_delete=models.CASCADE, related_name="deliveries")
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="deliveries")

    # Delivery details
    delivery_note_number = models.CharField(max_length=50)
    supplier = models.CharField(max_length=200)
    vehicle_reg = models.CharField(max_length=20, blank=True)
    driver_name = models.CharField(max_length=100, blank=True)
    driver_phone = models.CharField(max_length=20, blank=True)

    # Quantities
    ordered_litres = models.DecimalField(max_digits=12, decimal_places=2)
    delivered_litres = models.DecimalField(max_digits=12, decimal_places=2)
    variance_litres = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Tank dip before/after delivery
    dip_before = models.DecimalField(max_digits=12, decimal_places=2, help_text="Litres in tank before delivery")
    dip_after = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Financials
    price_per_litre = models.DecimalField(max_digits=10, decimal_places=2)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2)
    invoice_number = models.CharField(max_length=50, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    delivered_at = models.DateTimeField()
    received_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True,
        related_name="received_deliveries"
    )
    verified_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="verified_deliveries"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fuel_deliveries"
        ordering = ["-delivered_at"]
        indexes = [
            models.Index(fields=["station", "delivered_at"]),
            models.Index(fields=["tank", "delivered_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"Delivery {self.delivery_note_number} to {self.tank}"

    def save(self, *args, **kwargs):
        if self.dip_after:
            self.variance_litres = self.delivered_litres - (self.dip_after - self.dip_before)
        super().save(*args, **kwargs)


class DipReading(models.Model):
    """Manual dip stick readings to verify tank stock levels"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tank = models.ForeignKey(Tank, on_delete=models.CASCADE, related_name="dip_readings")
    shift = models.ForeignKey(
        "shifts.Shift", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="dip_readings"
    )

    reading_type = models.CharField(
        max_length=20,
        choices=[("opening", "Opening"), ("closing", "Closing"), ("spot", "Spot Check")],
        default="closing"
    )
    dip_mm = models.DecimalField(max_digits=8, decimal_places=1, help_text="Dip stick reading in mm")
    litres = models.DecimalField(max_digits=12, decimal_places=2, help_text="Converted litres from dip chart")
    temperature = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="°C")

    # Variance from book stock
    book_stock = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    variance = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    recorded_by = models.ForeignKey("authentication.User", on_delete=models.SET_NULL, null=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "dip_readings"
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["tank", "recorded_at"]),
            models.Index(fields=["shift"]),
        ]

    def __str__(self):
        return f"{self.tank} dip: {self.litres}L at {self.recorded_at.strftime('%Y-%m-%d %H:%M')}"

    def calculate_variance(self):
        """Stock variance = actual dip - book stock"""
        if self.book_stock is not None:
            self.variance = self.litres - self.book_stock
