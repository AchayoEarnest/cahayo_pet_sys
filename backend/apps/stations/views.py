"""Stations Views"""
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from .models import Station, FuelType, StationFuelPrice
from apps.authentication.permissions import IsAdmin, IsManagerOrAbove


class StationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Station
        fields = [
            "id", "name", "code", "address", "county", "phone", "email",
            "kra_pin", "is_active", "currency", "mpesa_shortcode", "mpesa_till",
            "operates_24hrs", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class FuelTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelType
        fields = ["id", "name", "code", "color", "unit", "density"]


class FuelPriceSerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.SerializerMethodField()

    class Meta:
        model = StationFuelPrice
        fields = ["id", "station", "fuel_type", "fuel_type_name", "price_per_litre",
                  "effective_from", "is_current", "created_at"]
        read_only_fields = ["id", "created_at", "is_current"]

    def get_fuel_type_name(self, obj): return obj.fuel_type.name

    def create(self, validated_data):
        validated_data["set_by"] = self.context["request"].user
        validated_data["is_current"] = True
        return super().create(validated_data)


class StationListView(generics.ListCreateAPIView):
    serializer_class = StationSerializer
    permission_classes = [IsAdmin]
    queryset = Station.objects.filter(is_active=True)


class StationDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = StationSerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Station.objects.all()
        return Station.objects.filter(id=user.station_id)


class FuelTypeListView(generics.ListAPIView):
    serializer_class = FuelTypeSerializer
    permission_classes = [IsAuthenticated]
    queryset = FuelType.objects.all()


class FuelPriceListCreateView(generics.ListCreateAPIView):
    serializer_class = FuelPriceSerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        return StationFuelPrice.objects.filter(
            station=self.request.user.station,
            is_current=True,
        ).select_related("fuel_type")
