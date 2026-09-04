from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import AccessToken
from bson import ObjectId
from django.contrib.auth.hashers import make_password

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    AdminUserResponseSerializer,
    AdminCreateUserSerializer,
    AdminUpdateUserSerializer,
)
from .services import register_service, login_service
from AIticket.db import users_collection


@api_view(["POST"])
def register(request):

    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():

        result = register_service(serializer.validated_data)

        if result["success"]:
            return Response(
                {
                    "message": result["message"],
                    "access": result["access"],
                    "refresh": result["refresh"]
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            {
                "message": result["message"]
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(["POST"])
def login(request):

    serializer = LoginSerializer(data=request.data)

    if serializer.is_valid():

        result = login_service(serializer.validated_data)

        if result["success"]:
            return Response(
                {
                    "message": result["message"],
                    "access": result["access"],
                    "refresh": result["refresh"]
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {
                "message": result["message"]
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def me(request):

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return Response(
            {
                "message": "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:

        token = auth_header.split(" ")[1]

        access_token = AccessToken(token)

        user_id = access_token["user_id"]

        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

        if not user:
            return Response(
                {
                    "message": "User not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if user.get("status") == "Inactive":
            return Response(
                {
                    "message": "User account is deactivated."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        return Response(
            {
                "username": user["username"],
                "email": user["email"],
                "mobile": user.get("mobile", ""),
                "role": user.get("role", "User")
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:

        print("JWT error:", e)

        return Response(
            {
                "message": "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )


def check_admin_auth(request):
    """
    Checks if the user is authenticated and is an Admin.
    Returns (user_doc, None) on success, or (None, Response) on failure.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None, Response(
            {"message": "Authorization header missing."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0] != "Bearer":
            return None, Response(
                {"message": "Invalid Authorization header."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = parts[1]
        access_token = AccessToken(token)
        user_id = access_token["user_id"]
    except Exception as e:
        print("TEST DEBUG check_admin_auth Exception:", e)
        return None, Response(
            {"message": "Invalid or expired token."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None, Response(
            {"message": "Invalid user ID."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user:
        return None, Response(
            {"message": "User not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    if user.get("status") == "Inactive":
        return None, Response(
            {"message": "User account is deactivated."},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if user.get("role", "User") != "Admin":
        return None, Response(
            {"message": "Admin access required."},
            status=status.HTTP_403_FORBIDDEN
        )

    return user, None


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_users_view(request):
    admin_user, err_response = check_admin_auth(request)
    if err_response:
        return err_response

    if request.method == "GET":
        users = list(users_collection.find())
        serializer = AdminUserResponseSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "POST":
        serializer = AdminCreateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        existing_email = users_collection.find_one({"email": data["email"]})
        if existing_email:
            return Response(
                {"message": "Email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        existing_username = users_collection.find_one({"username": data["username"]})
        if existing_username:
            return Response(
                {"message": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_user = {
            "username": data["username"],
            "email": data["email"],
            "mobile": data.get("mobile", ""),
            "role": data.get("role", "User"),
            "status": data.get("status", "Active"),
            "password": make_password(data["password"])
        }

        result = users_collection.insert_one(new_user)
        new_user["_id"] = result.inserted_id

        response_serializer = AdminUserResponseSerializer(new_user)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_user_detail_view(request, user_id):
    admin_user, err_response = check_admin_auth(request)
    if err_response:
        return err_response

    try:
        target_oid = ObjectId(user_id)
    except Exception:
        return Response(
            {"message": "Invalid user ID format."},
            status=status.HTTP_400_BAD_REQUEST
        )

    target_user = users_collection.find_one({"_id": target_oid})
    if not target_user:
        return Response(
            {"message": "User not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = AdminUpdateUserSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    update_data = {}
    new_role = serializer.validated_data.get("role")
    new_status = serializer.validated_data.get("status")

    if (new_role is not None and new_role != "Admin" and target_user.get("role") == "Admin") or \
       (new_status is not None and new_status == "Inactive" and target_user.get("role") == "Admin"):
        
        active_admins_count = users_collection.count_documents(
            {"role": "Admin", "status": {"$ne": "Inactive"}}
        )
        if active_admins_count <= 1:
            return Response(
                {"message": "Cannot deactivate or demote the only remaining Admin account."},
                status=status.HTTP_400_BAD_REQUEST
            )

    if new_role is not None:
        update_data["role"] = new_role
    if new_status is not None:
        update_data["status"] = new_status

    if update_data:
        users_collection.update_one({"_id": target_oid}, {"$set": update_data})
        target_user = users_collection.find_one({"_id": target_oid})

    response_serializer = AdminUserResponseSerializer(target_user)
    return Response(response_serializer.data, status=status.HTTP_200_OK)