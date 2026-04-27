"""
Station Models
Supports multi-station/multi-tenant setup
"""

import uuid
from django.db import models


class Station(models.Model):
    """Petrol Station - top-level tenant entity"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True, help_text="Station short code e.g. NRB-001")
    address = models.TextField()
    county = models.CharField(max_length=100, default="Nairobi")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)

    # Business details
    kra_pin = models.CharField(max_length=20, blank=True, help_text="KRA PIN for tax purposes")
    license_number = models.CharField(max_length=50, blank=True)
    license_expiry = models.DateField(null=True, blank=True)

    # Operational
    is_active = models.BooleanField(default=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    operates_24hrs = models.BooleanField(default=True)

    # Financials
    currency = models.CharField(max_length=3, default="KES")
    mpesa_shortcode = models.CharField(max_length=20, blank=True)
    mpesa_till = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "stations"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class FuelType(models.Model):
    """Fuel product types - global registry"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)  # Petrol, Diesel, Kerosene, LPG
    code = models.CharField(max_length=10, unique=True)  # PMS, AGO, IK, LPG
    color = models.CharField(max_length=7, default="#gray", help_text="Hex color for UI display")
    unit = models.CharField(max_length=10, default="L", help_text="Unit of measure")
    density = models.DecimalField(
        max_digits=5, decimal_places=3,
        null=True, blank=True,
        help_text="Density in kg/L for mass calculations"
    )

    class Meta:
        db_table = "fuel_types"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class StationFuelPrice(models.Model):
    """Current fuel prices per station - price changes tracked"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name="fuel_prices")
    fuel_type = models.ForeignKey(FuelType, on_delete=models.CASCADE)
    price_per_litre = models.DecimalField(max_digits=10, decimal_places=2)
    effective_from = models.DateTimeField()
    effective_to = models.DateTimeField(null=True, blank=True)
    set_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True
    )
    is_current = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "station_fuel_prices"
        ordering = ["-effective_from"]
        indexes = [
            models.Index(fields=["station", "fuel_type", "is_current"]),
        ]

    def __str__(self):
        return f"{self.station.code} - {self.fuel_type.code}: KES {self.price_per_litre}"

    def save(self, *args, **kwargs):
        if self.is_current:
            # Deactivate previous prices for this station/fuel combination
            StationFuelPrice.objects.filter(
                station=self.station,
                fuel_type=self.fuel_type,
                is_current=True
            ).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)
