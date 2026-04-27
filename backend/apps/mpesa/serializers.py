"""M-Pesa Serializers"""

from rest_framework import serializers
from .models import MpesaTransaction


class STKPushSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=1)
    account_reference = serializers.CharField(max_length=12, required=False)
    description = serializers.CharField(max_length=13, required=False, default="Fuel Purchase")
    shift_id = serializers.UUIDField(required=False)

    def validate_phone_number(self, value):
        value = value.strip().replace(" ", "").replace("-", "")
        if value.startswith("0") and len(value) == 10:
            return value
        if value.startswith("254") and len(value) == 12:
            return value
        if value.startswith("+254") and len(value) == 13:
            return value[1:]
        raise serializers.ValidationError("Enter a valid Kenyan phone number (07XXXXXXXX or 254XXXXXXXXX)")


class MpesaTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaTransaction
        fields = [
            "id", "merchant_request_id", "checkout_request_id",
            "mpesa_receipt_number", "transaction_type", "phone_number",
            "amount", "status", "result_code", "result_desc",
            "created_at", "completed_at",
        ]


class MpesaTransactionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaTransaction
        fields = [
            "id", "mpesa_receipt_number", "transaction_type",
            "phone_number", "amount", "status", "created_at",
        ]
