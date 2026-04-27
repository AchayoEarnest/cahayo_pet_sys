"""Shift Serializers"""

from rest_framework import serializers
from .models import Shift
from apps.pumps.models import ShiftNozzleReading


class NozzleOpeningReadingSerializer(serializers.Serializer):
    nozzle_id = serializers.UUIDField()
    opening_reading = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class NozzleClosingReadingSerializer(serializers.Serializer):
    nozzle_id = serializers.UUIDField()
    closing_reading = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)
    test_litres = serializers.DecimalField(max_digits=8, decimal_places=3, default=0, required=False)


class DipReadingInputSerializer(serializers.Serializer):
    tank_id = serializers.UUIDField()
    dip_mm = serializers.DecimalField(max_digits=8, decimal_places=1, min_value=0)
    litres = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    book_stock = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class ShiftOpenSerializer(serializers.Serializer):
    attendant = serializers.UUIDField(required=False)
    opening_float = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)
    nozzle_readings = NozzleOpeningReadingSerializer(many=True, min_length=1)


class ShiftCloseSerializer(serializers.Serializer):
    nozzle_readings = NozzleClosingReadingSerializer(many=True, min_length=1)
    dip_readings = DipReadingInputSerializer(many=True, required=False, default=list)
    cash_collected = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ShiftNozzleReadingSerializer(serializers.ModelSerializer):
    nozzle_number = serializers.SerializerMethodField()
    pump_number = serializers.SerializerMethodField()
    fuel_type = serializers.SerializerMethodField()

    class Meta:
        model = ShiftNozzleReading
        fields = [
            "id", "nozzle", "nozzle_number", "pump_number", "fuel_type",
            "opening_reading", "closing_reading", "litres_sold",
            "expected_revenue", "test_litres",
        ]

    def get_nozzle_number(self, obj):
        return obj.nozzle.number

    def get_pump_number(self, obj):
        return obj.nozzle.pump.number

    def get_fuel_type(self, obj):
        return obj.nozzle.fuel_type.name


class ShiftSerializer(serializers.ModelSerializer):
    attendant_name = serializers.SerializerMethodField()
    duration_hours = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = [
            "id", "shift_number", "attendant", "attendant_name",
            "status", "opened_at", "closed_at", "shift_date",
            "total_cash", "total_mpesa", "total_card", "total_credit",
            "expected_revenue", "actual_revenue", "revenue_variance",
            "variance_percentage", "total_litres_sold",
            "is_flagged", "flag_reason", "duration_hours",
        ]

    def get_attendant_name(self, obj):
        return obj.attendant.get_full_name() if obj.attendant else None

    def get_duration_hours(self, obj):
        return obj.duration_hours


class ShiftDetailSerializer(ShiftSerializer):
    nozzle_readings = ShiftNozzleReadingSerializer(many=True, read_only=True)
    transaction_count = serializers.SerializerMethodField()

    class Meta(ShiftSerializer.Meta):
        fields = ShiftSerializer.Meta.fields + ["nozzle_readings", "transaction_count", "notes", "opening_float"]

    def get_transaction_count(self, obj):
        return obj.transactions.count()


class ShiftSummarySerializer(serializers.Serializer):
    date = serializers.DateField()
    total_shifts = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_litres = serializers.DecimalField(max_digits=14, decimal_places=3)
    total_cash = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_mpesa = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_card = serializers.DecimalField(max_digits=14, decimal_places=2)
    flagged_count = serializers.IntegerField()
    open_shifts = serializers.IntegerField()
