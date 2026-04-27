"""
Accounting Models
Cashbook, expenses, bank deposits, credit accounts, reconciliation
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class CreditAccount(models.Model):
    """Corporate/fleet credit accounts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="credit_accounts")
    account_number = models.CharField(max_length=50, unique=True)
    company_name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2)
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)
    payment_terms_days = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "credit_accounts"

    def __str__(self):
        return f"{self.company_name} ({self.account_number})"

    @property
    def available_credit(self):
        return self.credit_limit - self.current_balance

    @property
    def is_over_limit(self):
        return self.current_balance >= self.credit_limit


class Expense(models.Model):
    class Category(models.TextChoices):
        OPERATIONAL = "operational", "Operational"
        MAINTENANCE = "maintenance", "Maintenance"
        UTILITIES = "utilities", "Utilities"
        SALARIES = "salaries", "Salaries"
        FUEL_PURCHASE = "fuel_purchase", "Fuel Purchase"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="expenses")
    shift = models.ForeignKey("shifts.Shift", on_delete=models.SET_NULL, null=True, blank=True)
    category = models.CharField(max_length=30, choices=Category.choices)
    description = models.CharField(max_length=500)
    amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))]
    )
    paid_to = models.CharField(max_length=200, blank=True)
    receipt_number = models.CharField(max_length=100, blank=True)
    expense_date = models.DateField()
    recorded_by = models.ForeignKey("authentication.User", on_delete=models.SET_NULL, null=True)
    approved_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_expenses"
    )
    notes = models.TextField(blank=True)
    attachment = models.FileField(upload_to="expense_receipts/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "expenses"
        ordering = ["-expense_date", "-created_at"]
        indexes = [
            models.Index(fields=["station", "expense_date"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return f"{self.category}: KES {self.amount} - {self.description}"


class BankDeposit(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending Verification"
        VERIFIED = "verified", "Verified"
        DISPUTED = "disputed", "Disputed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="bank_deposits")
    shift = models.ForeignKey("shifts.Shift", on_delete=models.SET_NULL, null=True, blank=True)
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    deposit_slip_number = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    deposit_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    deposited_by = models.ForeignKey("authentication.User", on_delete=models.SET_NULL, null=True)
    verified_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="verified_deposits"
    )
    notes = models.TextField(blank=True)
    deposit_slip_image = models.ImageField(upload_to="deposit_slips/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bank_deposits"
        ordering = ["-deposit_date"]

    def __str__(self):
        return f"Deposit {self.deposit_slip_number}: KES {self.amount} to {self.bank_name}"


class DailyReconciliation(models.Model):
    """Daily financial reconciliation record"""
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        DISPUTED = "disputed", "Disputed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE)
    recon_date = models.DateField()

    # Sales
    total_sales = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_cash_sales = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_mpesa_sales = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_card_sales = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_credit_sales = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    # Collections
    total_cash_collected = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_bank_deposits = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_expenses = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    # Variances
    cash_variance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    prepared_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True,
        related_name="prepared_reconciliations"
    )
    approved_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_reconciliations"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "daily_reconciliations"
        unique_together = [["station", "recon_date"]]
        ordering = ["-recon_date"]

    def __str__(self):
        return f"Reconciliation {self.station.code} {self.recon_date}"
