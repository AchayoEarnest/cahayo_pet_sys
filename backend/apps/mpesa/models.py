"""
M-Pesa Transaction Models
Safaricom Daraja API integration for STK Push and C2B payments
"""

import uuid
from django.db import models


class MpesaTransaction(models.Model):
    class TransactionType(models.TextChoices):
        STK_PUSH = "stk_push", "STK Push"
        C2B = "c2b", "Customer to Business"
        B2C = "b2c", "Business to Customer (Refund)"

    class Status(models.TextChoices):
        INITIATED = "initiated", "Initiated"
        PENDING = "pending", "Pending Callback"
        SUCCESS = "success", "Successful"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled by User"
        TIMEOUT = "timeout", "Timed Out"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    station = models.ForeignKey("stations.Station", on_delete=models.CASCADE, related_name="mpesa_transactions")

    # Daraja API fields
    merchant_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True, unique=True, null=True)

    # Transaction details
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    phone_number = models.CharField(max_length=20, help_text="Format: 254712345678")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)

    # Result from M-Pesa callback
    result_code = models.CharField(max_length=10, blank=True)
    result_desc = models.CharField(max_length=500, blank=True)

    # Raw payloads for audit/debugging
    request_payload = models.JSONField(null=True, blank=True)
    callback_payload = models.JSONField(null=True, blank=True)

    # Retry tracking
    retry_count = models.PositiveIntegerField(default=0)
    last_retry_at = models.DateTimeField(null=True, blank=True)

    # Linking
    initiated_by = models.ForeignKey(
        "authentication.User", on_delete=models.SET_NULL, null=True,
        related_name="mpesa_transactions"
    )
    shift = models.ForeignKey(
        "shifts.Shift", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mpesa_transactions"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "mpesa_transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["checkout_request_id"]),
            models.Index(fields=["merchant_request_id"]),
            models.Index(fields=["mpesa_receipt_number"]),
            models.Index(fields=["station", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.mpesa_receipt_number or self.checkout_request_id} - KES {self.amount} ({self.status})"

    @property
    def is_successful(self):
        return self.status == self.Status.SUCCESS

    @property
    def can_retry(self):
        return self.status in [self.Status.FAILED, self.Status.TIMEOUT] and self.retry_count < 3
