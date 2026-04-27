"""
Transaction Models
Records every sale at the pump linked to shift, attendant, payment method
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Transaction(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash"
        MPESA = "mpesa", "M-Pesa"
        CARD = "card", "Card"
        CREDIT = "credit", "Credit Account"
        VOUCHER = "voucher", "Fuel Voucher"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REVERSED = "reversed", "Reversed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=50, unique=True, help_text="Unique transaction reference")

    # Relationships
    shift = models.ForeignKey("shifts.Shift", on_delete=models.PROTECT, related_name="transactions")
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="transactions")
    nozzle = models.ForeignKey("pumps.Nozzle", on_delete=models.SET_NULL, null=True, blank=True)
    attendant = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True,
        related_name="transactions"
    )

    # Fuel details
    fuel_type = models.ForeignKey("stations.FuelType", on_delete=models.PROTECT)
    litres = models.DecimalField(
        max_digits=10, decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))]
    )
    price_per_litre = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    # Payment
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)

    # M-Pesa specific
    mpesa_transaction = models.OneToOneField(
        "mpesa.MpesaTransaction", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sale_transaction"
    )

    # Customer (optional)
    customer_name = models.CharField(max_length=200, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)
    vehicle_reg = models.CharField(max_length=20, blank=True)

    # Credit account
    credit_account = models.ForeignKey(
        "accounting.CreditAccount", on_delete=models.SET_NULL,
        null=True, blank=True
    )

    notes = models.TextField(blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shift", "payment_method"]),
            models.Index(fields=["station", "created_at"]),
            models.Index(fields=["attendant", "created_at"]),
            models.Index(fields=["reference"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.reference} - {self.amount} KES ({self.payment_method})"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = self._generate_reference()
        if not self.amount and self.litres and self.price_per_litre:
            self.amount = self.litres * self.price_per_litre
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_reference():
        import random
        import string
        return "TXN" + "".join(random.choices(string.digits, k=10))


class CreditSale(models.Model):
    """Extended details for credit sales"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.OneToOneField(Transaction, on_delete=models.CASCADE, related_name="credit_detail")
    credit_account = models.ForeignKey(
        "accounting.CreditAccount", on_delete=models.PROTECT
    )
    due_date = models.DateField()
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    lpo_number = models.CharField(max_length=50, blank=True, help_text="Local Purchase Order number")

    class Meta:
        db_table = "credit_sales"
