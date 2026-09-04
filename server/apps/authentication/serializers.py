from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    mobile = serializers.CharField(
        required=False,
        allow_blank=True
    )
    password = serializers.CharField(
        min_length=8,
        write_only=True
    )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True
    )


class AdminUserResponseSerializer(serializers.Serializer):
    id = serializers.SerializerMethodField()
    username = serializers.CharField()
    email = serializers.EmailField()
    mobile = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField()
    status = serializers.SerializerMethodField()

    def get_id(self, obj):
        return str(obj.get("_id", ""))

    def get_status(self, obj):
        return obj.get("status", "Active")


class AdminCreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    mobile = serializers.CharField(required=False, allow_blank=True, default="")
    password = serializers.CharField(min_length=8, write_only=True)
    role = serializers.ChoiceField(choices=["User", "Agent", "Admin"], default="User")
    status = serializers.ChoiceField(choices=["Active", "Inactive"], default="Active")


class AdminUpdateUserSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["User", "Agent", "Admin"], required=False)
    status = serializers.ChoiceField(choices=["Active", "Inactive"], required=False)