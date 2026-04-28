# Generated patch migration for apps.mpesa

import uuid
import django.db.models.deletion
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
            name="MpesaTransaction",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("merchant_request_id", models.CharField(max_length=100, blank=True, db_index=True)),
                ("checkout_request_id", models.CharField(max_length=100, blank=True, db_index=True)),
                ("mpesa_receipt_number", models.CharField(max_length=50, blank=True, unique=True, null=True)),
                ("transaction_type", models.CharField(max_length=20, choices=[("stk_push","STK Push"),("c2b","Customer to Business"),("b2c","Business to Customer (Refund)")])),
                ("phone_number", models.CharField(max_length=20)),
                ("amount", models.DecimalField(max_digits=14, decimal_places=2)),
                ("status", models.CharField(max_length=20, choices=[("initiated","Initiated"),("pending","Pending Callback"),("success","Successful"),("failed","Failed"),("cancelled","Cancelled by User"),("timeout","Timed Out")], default="initiated")),
                ("result_code", models.CharField(max_length=10, blank=True)),
                ("result_desc", models.CharField(max_length=500, blank=True)),
                ("request_payload", models.JSONField(null=True, blank=True)),
                ("callback_payload", models.JSONField(null=True, blank=True)),
                ("retry_count", models.PositiveIntegerField(default=0)),
                ("last_retry_at", models.DateTimeField(null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(null=True, blank=True)),
                ("station", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mpesa_transactions", to="stations.station")),
                ("initiated_by", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, related_name="mpesa_transactions", to=settings.AUTH_USER_MODEL)),
                ("shift", models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, related_name="mpesa_transactions", to="shifts.shift")),
            ],
            options={
                "db_table": "mpesa_transactions",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["checkout_request_id"], name="mpesa_checkout_idx"),
                    models.Index(fields=["merchant_request_id"], name="mpesa_merchant_idx"),
                    models.Index(fields=["mpesa_receipt_number"], name="mpesa_receipt_idx"),
                    models.Index(fields=["station", "status"], name="mpesa_station_status_idx"),
                    models.Index(fields=["status", "created_at"], name="mpesa_status_created_idx"),
                ],
            },
        ),
    ]
