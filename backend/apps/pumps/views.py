"""Pump Views"""
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from .models import Pump, Nozzle, ShiftNozzleReading
from apps.authentication.permissions import IsManagerOrAbove


class NozzleSerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.SerializerMethodField()
    pump_number = serializers.SerializerMethodField()

    class Meta:
        model = Nozzle
        fields = ["id", "pump", "number", "fuel_type", "fuel_type_name", "status", "current_reading", "pump_number"]

    def get_fuel_type_name(self, obj):
        return obj.fuel_type.name

    def get_pump_number(self, obj):
        return obj.pump.number


class PumpSerializer(serializers.ModelSerializer):
    nozzles = NozzleSerializer(many=True, read_only=True)

    class Meta:
        model = Pump
        fields = ["id", "station", "number", "name", "model", "serial_number", "status", "nozzles", "tank"]


class PumpListView(generics.ListCreateAPIView):
    serializer_class = PumpSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Pump.objects.filter(
            station=self.request.user.station,
            status="active"
        ).prefetch_related("nozzles__fuel_type")


class PumpDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = PumpSerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        return Pump.objects.filter(station=self.request.user.station)


class NozzleListView(generics.ListAPIView):
    serializer_class = NozzleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Nozzle.objects.filter(
            pump_id=self.kwargs["pump_id"],
            pump__station=self.request.user.station,
        ).select_related("fuel_type")
