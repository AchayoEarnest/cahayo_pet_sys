"""Authentication Serializers"""

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password, check_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, AuditLog


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    station_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "phone", "role", "station", "station_name",
            "is_active", "date_joined", "avatar",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_station_name(self, obj):
        return obj.station.name if obj.station else None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "email", "first_name", "last_name", "phone",
            "role", "station", "password", "confirm_password",
        ]

    def validate(self, data):
        if data["password"] != data.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(email=data["email"], password=data["password"])
        if not user:
            raise serializers.ValidationError("Invalid credentials. Please try again.")
        if not user.is_active:
            raise serializers.ValidationError("Your account has been deactivated.")
        data["user"] = user
        return data


class TokenResponseSerializer(serializers.Serializer):
    """Serializer for login response with tokens + user info"""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()

    @staticmethod
    def get_tokens_for_user(user):
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user).data,
        }


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_new_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["new_password"] != data["confirm_new_password"]:
            raise serializers.ValidationError({"confirm_new_password": "Passwords do not match."})
        return data


class PINSerializer(serializers.Serializer):
    """Quick 4-digit PIN login for attendants"""
    email = serializers.EmailField()
    pin = serializers.CharField(min_length=4, max_length=4)

    def validate_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("PIN must be 4 digits.")
        return value


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = "__all__"

    def get_user_name(self, obj):
        return obj.user.get_full_name() if obj.user else "System"
