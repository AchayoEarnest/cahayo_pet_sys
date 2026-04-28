# Generated patch migration for apps.transactions

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
        ("pumps", "0001_initial"),
        ("authentication", "0001_initial"),
        ("accounting", "0001_initial"),
        ("mpesa", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Transaction",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("reference", models.CharField(max_length=50, unique=True)),
                ("litres", models.DecimalField(max_digits=10, decimal_places=3)),
                ("price_per_litre", models.DecimalField(max_digits=10, decimal_places=2)),
                ("amount", models.DecimalField(max_digits=14, decimal_places=2)),
                ("payment_method", models.CharField(max_length=20, choices=[("cash","Cash"),("mpesa","M-Pesa"),("card","Card"),("credit","Credit Account"),("voucher","Fuel Voucher")])),
                ("status", models.CharField(max_length=20, choices=[("pending","Pending"),("completed","Completed"),("cancelled","Cancelled"),("reversed","Reversed")], default="completed")),
                ("customer_name", models.CharField(max_length=200, blank=True)),
                ("customer_phone", models.CharField(max_length=20, blank=True)),
                ("vehicle_reg", models.CharField(max_length=20, blank=True)),
                ("notes", models.TextField(blank=True)),
                ("receipt_number", models.CharField(max_length=50, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("shift", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transactions", to="shifts.shift")),
                ("station", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="transactions", to="stations.station")),
                ("nozzle", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to="pumps.nozzle")),
                ("attendant", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, related_name="transactions", to=settings.AUTH_USER_MODEL)),
                ("fuel_type", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="stations.fueltype")),
                ("mpesa_transaction", models.OneToOneField(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name="sale_transaction", to="mpesa.mpesatransaction")),
                ("credit_account", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to="accounting.creditaccount")),
            ],
            options={
                "db_table": "transactions",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["shift", "payment_method"], name="txn_shift_payment_idx"),
                    models.Index(fields=["station", "created_at"], name="txn_station_created_idx"),
                    models.Index(fields=["attendant", "created_at"], name="txn_attendant_created_idx"),
                    models.Index(fields=["reference"], name="txn_reference_idx"),
                    models.Index(fields=["status"], name="txn_status_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="CreditSale",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("due_date", models.DateField()),
                ("is_paid", models.BooleanField(default=False)),
                ("paid_at", models.DateTimeField(null=True, blank=True)),
                ("lpo_number", models.CharField(max_length=50, blank=True)),
                ("transaction", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="credit_detail", to="transactions.transaction")),
                ("credit_account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="accounting.creditaccount")),
            ],
            options={"db_table": "credit_sales"},
        ),
    ]
