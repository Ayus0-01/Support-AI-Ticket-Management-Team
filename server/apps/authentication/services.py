from django.contrib.auth.hashers import make_password, check_password
from rest_framework_simplejwt.tokens import RefreshToken
from bson import ObjectId

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
        "role": data.get("role", "User"),
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
    # ── Demo Persona Fallback ──────────────────────────────────────────
    defaults = {
        "lakshmipriya": {
            "_id": ObjectId("60c72b2f9b1d8e2b8c9d4b01"),
            "username": "lakshmipriya",
            "email": "lakshmipriya@gmail.com",
            "role": "Admin"
        },
        "agent_test@gmail.com": {
            "_id": ObjectId("60c72b2f9b1d8e2b8c9d4b02"),
            "username": "agent_test",
            "email": "agent_test@gmail.com",
            "role": "Agent"
        },
        "user_test@gmail.com": {
            "_id": ObjectId("60c72b2f9b1d8e2b8c9d4b03"),
            "username": "user_test",
            "email": "user_test@gmail.com",
            "role": "User"
        }
    }

    input_id = data["email"]
    matched_persona = None
    for key, val in defaults.items():
        if input_id == key or input_id == val["email"]:
            matched_persona = val
            break

    if matched_persona and data["password"] == "Lakshmi@123":
        tokens = get_tokens_for_user(matched_persona)
        return {
            "success": True,
            "message": "Login Successful (Demo Persona)",
            "access": tokens["access"],
            "refresh": tokens["refresh"],
        }

    # ── Standard DB Query ──────────────────────────────────────────────
    try:
        user = users_collection.find_one(
            {
                "$or": [
                    {"email": data["email"]},
                    {"username": data["email"]}
                ]
            }
        )
    except Exception:
        user = None

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