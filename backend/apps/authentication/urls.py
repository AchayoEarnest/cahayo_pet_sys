from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("pin-login/", views.PINLoginView.as_view(), name="pin-login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", views.UserProfileView.as_view(), name="profile"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("set-pin/", views.SetPINView.as_view(), name="set-pin"),
    path("users/", views.UserListCreateView.as_view(), name="user-list"),
    path("users/<uuid:pk>/", views.UserDetailView.as_view(), name="user-detail"),
    path("audit-logs/", views.AuditLogListView.as_view(), name="audit-logs"),
]
