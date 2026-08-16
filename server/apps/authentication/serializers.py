from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    mobile = serializers.CharField(
        required=False,
        allow_blank=True
    )
    role = serializers.ChoiceField(
        choices=["User", "Agent", "Admin"],
        default="User"
    )
    password = serializers.CharField(
        min_length=8,
        write_only=True
    )


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(
        write_only=True
    )