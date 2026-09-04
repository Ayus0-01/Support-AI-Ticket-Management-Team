from django.urls import path
from .views import register, login, me

urlpatterns = [
    path("register/", register),
    path("login/", login),
    path("me/", me),
]