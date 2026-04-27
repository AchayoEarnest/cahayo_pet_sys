"""Accounting Views"""
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone

from .models import Expense, BankDeposit, CreditAccount, DailyReconciliation
from apps.authentication.permissions import IsAccountantOrAbove, IsManagerOrAbove


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = ["id", "station", "recorded_by", "created_at"]

    def create(self, validated_data):
        validated_data["station"] = self.context["request"].user.station
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class BankDepositSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankDeposit
        fields = "__all__"
        read_only_fields = ["id", "station", "deposited_by", "created_at"]

    def create(self, validated_data):
        validated_data["station"] = self.context["request"].user.station
        validated_data["deposited_by"] = self.context["request"].user
        return super().create(validated_data)


class CreditAccountSerializer(serializers.ModelSerializer):
    available_credit = serializers.SerializerMethodField()
    is_over_limit = serializers.SerializerMethodField()

    class Meta:
        model = CreditAccount
        fields = "__all__"

    def get_available_credit(self, obj): return obj.available_credit
    def get_is_over_limit(self, obj): return obj.is_over_limit


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAccountantOrAbove]
    filterset_fields = ["category", "expense_date"]
    ordering_fields = ["expense_date", "amount"]

    def get_queryset(self):
        qs = Expense.objects.filter(station=self.request.user.station).order_by("-expense_date")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from: qs = qs.filter(expense_date__gte=date_from)
        if date_to: qs = qs.filter(expense_date__lte=date_to)
        return qs


class BankDepositListCreateView(generics.ListCreateAPIView):
    serializer_class = BankDepositSerializer
    permission_classes = [IsAccountantOrAbove]

    def get_queryset(self):
        return BankDeposit.objects.filter(station=self.request.user.station).order_by("-deposit_date")


class CreditAccountListView(generics.ListCreateAPIView):
    serializer_class = CreditAccountSerializer
    permission_classes = [IsManagerOrAbove]

    def get_queryset(self):
        return CreditAccount.objects.filter(station=self.request.user.station, is_active=True)


class ReconciliationView(APIView):
    """Daily reconciliation summary"""
    permission_classes = [IsAccountantOrAbove]

    def get(self, request):
        date = request.query_params.get("date", str(timezone.localdate()))
        station = request.user.station

        from apps.shifts.models import Shift
        shifts = Shift.objects.filter(station=station, shift_date=date, status="closed")
        totals = shifts.aggregate(
            sales=Sum("actual_revenue"),
            cash=Sum("total_cash"),
            mpesa=Sum("total_mpesa"),
            card=Sum("total_card"),
            credit=Sum("total_credit"),
            litres=Sum("total_litres_sold"),
        )

        expenses = Expense.objects.filter(station=station, expense_date=date).aggregate(
            total=Sum("amount")
        )
        deposits = BankDeposit.objects.filter(station=station, deposit_date=date).aggregate(
            total=Sum("amount")
        )

        cash_sales = float(totals.get("cash") or 0)
        total_expenses = float(expenses.get("total") or 0)
        total_deposits = float(deposits.get("total") or 0)
        cash_variance = cash_sales - total_expenses - total_deposits

        return Response({
            "date": date,
            "station": station.name,
            "sales": {
                "total": float(totals.get("sales") or 0),
                "cash": cash_sales,
                "mpesa": float(totals.get("mpesa") or 0),
                "card": float(totals.get("card") or 0),
                "credit": float(totals.get("credit") or 0),
                "litres": float(totals.get("litres") or 0),
            },
            "expenses": total_expenses,
            "bank_deposits": total_deposits,
            "cash_variance": cash_variance,
            "is_balanced": abs(cash_variance) < 100,
        })
