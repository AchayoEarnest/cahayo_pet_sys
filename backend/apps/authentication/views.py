"""Authentication Views"""

import logging
from django.contrib.auth.hashers import make_password, check_password
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, AuditLog
from .serializers import (
    UserSerializer, UserCreateSerializer, LoginSerializer,
    TokenResponseSerializer, ChangePasswordSerializer,
    PINSerializer, AuditLogSerializer,
)
from .permissions import IsAdmin, IsManagerOrAbove

logger = logging.getLogger(__name__)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "anon"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        user.last_login_ip = request.META.get("REMOTE_ADDR")
        user.save(update_fields=["last_login_ip"])

        # Audit log
        AuditLog.objects.create(
            user=user,
            action="LOGIN",
            resource_type="User",
            resource_id=str(user.id),
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            station=user.station,
        )

        tokens = TokenResponseSerializer.get_tokens_for_user(user)
        logger.info(f"User {user.email} logged in from {user.last_login_ip}")
        return Response(tokens)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({"detail": "Logged out successfully."})
        except Exception:
            return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class PINLoginView(APIView):
    """Quick PIN login for shift attendants"""
    permission_classes = [AllowAny]
    throttle_scope = "anon"

    def post(self, request):
        serializer = PINSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(email=serializer.validated_data["email"], is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.pin or not check_password(serializer.validated_data["pin"], user.pin):
            return Response({"detail": "Invalid PIN."}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = TokenResponseSerializer.get_tokens_for_user(user)
        return Response(tokens)


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"detail": "Incorrect current password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()

        AuditLog.objects.create(
            user=user,
            action="CHANGE_PASSWORD",
            resource_type="User",
            resource_id=str(user.id),
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response({"detail": "Password changed successfully."})


class SetPINView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pin = request.data.get("pin", "")
        if not pin.isdigit() or len(pin) != 4:
            return Response(
                {"detail": "PIN must be exactly 4 digits."},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.user.pin = make_password(pin)
        request.user.save(update_fields=["pin"])
        return Response({"detail": "PIN set successfully."})


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all().select_related("station")
    permission_classes = [IsManagerOrAbove]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Non-admins only see users in their station
        if not user.is_admin:
            qs = qs.filter(station=user.station)
        return qs


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all().select_related("station")
    serializer_class = UserSerializer
    permission_classes = [IsManagerOrAbove]


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsManagerOrAbove]
    filterset_fields = ["user", "action", "resource_type"]
    ordering = ["-timestamp"]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user", "station")
        if not self.request.user.is_admin:
            qs = qs.filter(station=self.request.user.station)
        return qs
