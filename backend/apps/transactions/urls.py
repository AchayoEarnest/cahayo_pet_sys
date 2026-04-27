from django.urls import path
from . import views

urlpatterns = [
    path("", views.TransactionListCreateView.as_view(), name="transaction-list"),
    path("<uuid:pk>/", views.TransactionDetailView.as_view(), name="transaction-detail"),
]
