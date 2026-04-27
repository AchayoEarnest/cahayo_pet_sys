"""Tank Views"""
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from .models import Tank, FuelDelivery, DipReading
from apps.authentication.permissions import IsManagerOrAbove


class TankSerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.SerializerMethodField()
    fill_percentage = serializers.SerializerMethodField()
    is_low = serializers.SerializerMethodField()
    available_space = serializers.SerializerMethodField()

    class Meta:
        model = Tank
        fields = [
            "id", "station", "number", "name", "fuel_type", "fuel_type_name",
            "capacity_litres", "safe_fill_level", "reorder_level",
            "current_stock", "fill_percentage", "is_low", "available_space", "status",
        ]

    def get_fuel_type_name(self, obj): return obj.fuel_type.name
    def get_fill_percentage(self, obj): return round(obj.fill_percentage, 2)
    def get_is_low(self, obj): return obj.is_low
    def get_available_space(self, obj): return obj.available_space


class FuelDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelDelivery
        fields = "__all__"
        read_only_fields = ["id", "created_at", "variance_litres"]

    def validate(self, data):
        if data.get("delivered_litres", 0) > data.get("tank").available_space:
            raise serializers.ValidationError(
                "Delivery would exceed safe fill level. "
                f"Available space: {data['tank'].available_space:.0f}L"
            )
        return data


class DipReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DipReading
        fields = "__all__"
        read_only_fields = ["id", "recorded_at", "variance"]


class TankListView(generics.ListAPIView):
    serializer_class = TankSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tank.objects.filter(
            station=self.request.user.station,
            status="operational"
        ).select_related("fuel_type")


class TankDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = TankSerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        return Tank.objects.filter(station=self.request.user.station)


class DeliveryListCreateView(generics.ListCreateAPIView):
    serializer_class = FuelDeliverySerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        qs = FuelDelivery.objects.filter(station=self.request.user.station).order_by("-delivered_at")
        tank_id = self.kwargs.get("tank_id")
        if tank_id:
            qs = qs.filter(tank_id=tank_id)
        return qs

    def perform_create(self, serializer):
        delivery = serializer.save(
            station=self.request.user.station,
            received_by=self.request.user,
        )
        # Update tank current stock
        tank = delivery.tank
        tank.current_stock += delivery.delivered_litres
        tank.save(update_fields=["current_stock"])

        # Check if still low after delivery (unlikely, but notify)
        if tank.is_low:
            from apps.notifications.tasks import alert_low_tank_level
            alert_low_tank_level.delay(str(tank.id))


class DipReadingCreateView(generics.CreateAPIView):
    serializer_class = DipReadingSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        reading = serializer.save(recorded_by=self.request.user)
        # Check and alert if low
        if reading.tank.is_low:
            from apps.notifications.tasks import alert_low_tank_level
            alert_low_tank_level.delay(str(reading.tank.id))

    def get_queryset(self):
        return DipReading.objects.filter(tank__station=self.request.user.station)
