# Generated patch migration for apps.accounting

import uuid
import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("stations", "0001_initial"),
        ("shifts", "0001_initial"),
        ("authentication", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CreditAccount",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("account_number", models.CharField(max_length=50, unique=True)),
                ("company_name", models.CharField(max_length=200)),
                ("contact_person", models.CharField(max_length=100, blank=True)),
                ("phone", models.CharField(max_length=20, blank=True)),
                ("email", models.EmailField(blank=True)),
                ("credit_limit", models.DecimalField(max_digits=14, decimal_places=2)),
                ("current_balance", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("is_active", models.BooleanField(default=True)),
                ("payment_terms_days", models.PositiveIntegerField(default=30)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("station", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="credit_accounts", to="stations.station")),
            ],
            options={"db_table": "credit_accounts"},
        ),
        migrations.CreateModel(
            name="Expense",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("category", models.CharField(max_length=30, choices=[("operational","Operational"),("maintenance","Maintenance"),("utilities","Utilities"),("salaries","Salaries"),("fuel_purchase","Fuel Purchase"),("other","Other")])),
                ("description", models.CharField(max_length=500)),
                ("amount", models.DecimalField(max_digits=14, decimal_places=2)),
                ("paid_to", models.CharField(max_length=200, blank=True)),
                ("receipt_number", models.CharField(max_length=100, blank=True)),
                ("expense_date", models.DateField()),
                ("notes", models.TextField(blank=True)),
                ("attachment", models.FileField(upload_to="expense_receipts/", null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("station", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="expenses", to="stations.station")),
                ("shift", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to="shifts.shift")),
                ("recorded_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, to=settings.AUTH_USER_MODEL)),
                ("approved_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name="approved_expenses", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "expenses", "ordering": ["-expense_date", "-created_at"],
                     "indexes": [models.Index(fields=["station","expense_date"],name="expenses_station_date_idx"), models.Index(fields=["category"],name="expenses_category_idx")]},
        ),
        migrations.CreateModel(
            name="BankDeposit",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("bank_name", models.CharField(max_length=100)),
                ("account_number", models.CharField(max_length=50)),
                ("deposit_slip_number", models.CharField(max_length=100)),
                ("amount", models.DecimalField(max_digits=14, decimal_places=2)),
                ("deposit_date", models.DateField()),
                ("status", models.CharField(max_length=20, choices=[("pending","Pending Verification"),("verified","Verified"),("disputed","Disputed")], default="pending")),
                ("notes", models.TextField(blank=True)),
                ("deposit_slip_image", models.ImageField(upload_to="deposit_slips/", null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("station", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bank_deposits", to="stations.station")),
                ("shift", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to="shifts.shift")),
                ("deposited_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, to=settings.AUTH_USER_MODEL)),
                ("verified_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name="verified_deposits", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "bank_deposits", "ordering": ["-deposit_date"]},
        ),
        migrations.CreateModel(
            name="DailyReconciliation",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("recon_date", models.DateField()),
                ("total_sales", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_cash_sales", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_mpesa_sales", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_card_sales", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_credit_sales", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_cash_collected", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_bank_deposits", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("total_expenses", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("cash_variance", models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))),
                ("status", models.CharField(max_length=20, choices=[("draft","Draft"),("submitted","Submitted"),("approved","Approved"),("disputed","Disputed")], default="draft")),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("station", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="stations.station")),
                ("prepared_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, related_name="prepared_reconciliations", to=settings.AUTH_USER_MODEL)),
                ("approved_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name="approved_reconciliations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "daily_reconciliations", "ordering": ["-recon_date"],
                     "unique_together": {("station", "recon_date")}},
        ),
    ]
