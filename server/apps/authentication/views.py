from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import AccessToken
from bson import ObjectId

from .serializers import RegisterSerializer, LoginSerializer
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