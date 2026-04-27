from django.urls import path
from . import views

urlpatterns = [
    path("expenses/", views.ExpenseListCreateView.as_view(), name="expense-list"),
    path("deposits/", views.BankDepositListCreateView.as_view(), name="deposit-list"),
    path("credit-accounts/", views.CreditAccountListView.as_view(), name="credit-accounts"),
    path("reconciliation/", views.ReconciliationView.as_view(), name="reconciliation"),
]
