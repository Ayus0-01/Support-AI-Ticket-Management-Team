from django.contrib.auth.hashers import make_password, check_password
from rest_framework_simplejwt.tokens import RefreshToken

from AIticket.db import users_collection


def register_service(data):

    existing_user = users_collection.find_one(
        {
            "email": data["email"]
        }
    )

    if existing_user:
        return {
            "success": False,
            "message": "Email already exists."
        }

    user = {
    "username": data["username"],
    "email": data["email"],
    "mobile": data.get("mobile", ""),
    "role": "User",
    "password": make_password(data["password"])
}

    result = users_collection.insert_one(user)

    user["_id"] = result.inserted_id

    tokens = get_tokens_for_user(user)

    return {
        "success": True,
        "message": "User registered successfully.",
        "access": tokens["access"],
        "refresh": tokens["refresh"]
    }


def get_tokens_for_user(user):

    refresh = RefreshToken()

    refresh["user_id"] = str(user["_id"])
    refresh["email"] = user["email"]

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def login_service(data):

    user = users_collection.find_one(
        {
            "email": data["email"]
        }
    )

    if not user:
        return {
            "success": False,
            "message": "User does not exist."
        }

    if not check_password(
        data["password"],
        user["password"]
    ):
        return {
            "success": False,
            "message": "Invalid password."
        }

    tokens = get_tokens_for_user(user)

    return {
        "success": True,
        "message": "Login Successful",
        "access": tokens["access"],
        "refresh": tokens["refresh"],
    }