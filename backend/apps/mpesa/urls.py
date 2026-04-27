from django.urls import path
from . import views

urlpatterns = [
    path("stk-push/", views.STKPushView.as_view(), name="stk-push"),
    path("callback/", views.STKCallbackView.as_view(), name="stk-callback"),
    path("c2b/validate/", views.C2BValidationView.as_view(), name="c2b-validate"),
    path("c2b/confirm/", views.C2BConfirmationView.as_view(), name="c2b-confirm"),
    path("transactions/", views.MpesaTransactionListView.as_view(), name="mpesa-transactions"),
    path("status/<str:checkout_request_id>/", views.CheckSTKStatusView.as_view(), name="stk-status"),
]
