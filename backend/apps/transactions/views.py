"""Transaction Views"""
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from .models import Transaction
from apps.authentication.permissions import IsManagerOrAbove


class TransactionSerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id", "reference", "shift", "station", "nozzle", "attendant",
            "fuel_type", "fuel_type_name", "litres", "price_per_litre", "amount",
            "payment_method", "status", "customer_name", "vehicle_reg",
            "created_at",
        ]
        read_only_fields = ["id", "reference", "station", "attendant", "created_at"]

    def get_fuel_type_name(self, obj):
        return obj.fuel_type.name if obj.fuel_type else None

    def create(self, validated_data):
        validated_data["station"] = self.context["request"].user.station
        validated_data["attendant"] = self.context["request"].user
        return super().create(validated_data)


class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["shift", "payment_method", "status", "fuel_type"]
    ordering_fields = ["created_at", "amount"]

    def get_queryset(self):
        return Transaction.objects.filter(
            station=self.request.user.station
        ).select_related("fuel_type", "attendant").order_by("-created_at")


class TransactionDetailView(generics.RetrieveAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(station=self.request.user.station)
