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
    # Frontend-compatible alias fields
    litres_delivered = serializers.DecimalField(source="delivered_litres", max_digits=12, decimal_places=2, read_only=True)
    cost_per_litre = serializers.DecimalField(source="price_per_litre", max_digits=10, decimal_places=2, read_only=True)
    delivery_date = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    tank_name = serializers.SerializerMethodField()

    class Meta:
        model = FuelDelivery
        fields = "__all__"
        read_only_fields = ["id", "created_at", "variance_litres"]

    def get_delivery_date(self, obj):
        return obj.delivered_at.date().isoformat() if obj.delivered_at else None

    def get_recorded_by_name(self, obj):
        return obj.received_by.get_full_name() if obj.received_by else None

    def get_tank_name(self, obj):
        return obj.tank.name if obj.tank else None

    def validate(self, data):
        if data.get("delivered_litres", 0) > data.get("tank").available_space:
            raise serializers.ValidationError(
                "Delivery would exceed safe fill level. "
                f"Available space: {data['tank'].available_space:.0f}L"
            )
        return data


class DipReadingSerializer(serializers.ModelSerializer):
    # Frontend-compatible alias
    reading_litres = serializers.DecimalField(source="litres", max_digits=12, decimal_places=2, read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DipReading
        fields = "__all__"
        read_only_fields = ["id", "recorded_at", "variance"]

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.get_full_name() if obj.recorded_by else None


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


class SimpleDeliverySerializer(serializers.Serializer):
    """Accept the simplified frontend form and map to FuelDelivery model fields."""
    tank = serializers.UUIDField()
    supplier = serializers.CharField(max_length=200)
    litres_delivered = serializers.DecimalField(max_digits=12, decimal_places=2)
    cost_per_litre = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    delivery_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_tank(self, value):
        try:
            return Tank.objects.get(id=value, station=self.context["request"].user.station)
        except Tank.DoesNotExist:
            raise serializers.ValidationError("Tank not found.")

    def validate(self, data):
        tank = data["tank"]
        if data["litres_delivered"] > tank.available_space:
            raise serializers.ValidationError(
                f"Delivery would exceed safe fill level. Available space: {tank.available_space:.0f}L"
            )
        return data


class SimpleDeliveryView(APIView):
    """Simplified delivery endpoint matching the frontend form fields."""
    permission_classes = [IsManagerOrAbove]

    def post(self, request):
        ser = SimpleDeliverySerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        tank = d["tank"]

        import datetime
        delivered_at = datetime.datetime.combine(d["delivery_date"], datetime.time(12, 0))

        from django.utils import timezone as tz
        delivered_at = tz.make_aware(delivered_at)

        total_cost = float(d["litres_delivered"]) * float(d.get("cost_per_litre") or 0)

        delivery = FuelDelivery.objects.create(
            tank=tank,
            station=request.user.station,
            delivery_note_number=f"DN-{int(float(d['litres_delivered']))}L",
            supplier=d["supplier"],
            ordered_litres=d["litres_delivered"],
            delivered_litres=d["litres_delivered"],
            dip_before=tank.current_stock,
            price_per_litre=d.get("cost_per_litre") or 0,
            total_cost=total_cost,
            status=FuelDelivery.Status.DELIVERED,
            delivered_at=delivered_at,
            received_by=request.user,
        )

        # Update tank stock
        tank.current_stock += delivery.delivered_litres
        tank.save(update_fields=["current_stock"])

        if tank.is_low:
            from apps.notifications.tasks import alert_low_tank_level
            alert_low_tank_level.delay(str(tank.id))

        return Response(
            FuelDeliverySerializer(delivery).data,
            status=status.HTTP_201_CREATED,
        )


class DipReadingListView(generics.ListAPIView):
    serializer_class = DipReadingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tank_id = self.kwargs.get("tank_id")
        qs = DipReading.objects.filter(tank__station=self.request.user.station).order_by("-recorded_at")
        if tank_id:
            qs = qs.filter(tank_id=tank_id)
        return qs


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
