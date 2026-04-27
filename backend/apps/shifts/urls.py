from django.urls import path
from . import views

urlpatterns = [
    path("", views.ShiftListView.as_view(), name="shift-list"),
    path("open/", views.OpenShiftView.as_view(), name="shift-open"),
    path("current/", views.CurrentShiftView.as_view(), name="shift-current"),
    path("summary/", views.ShiftSummaryView.as_view(), name="shift-summary"),
    path("<uuid:pk>/", views.ShiftDetailView.as_view(), name="shift-detail"),
    path("<uuid:shift_id>/close/", views.CloseShiftView.as_view(), name="shift-close"),
]
