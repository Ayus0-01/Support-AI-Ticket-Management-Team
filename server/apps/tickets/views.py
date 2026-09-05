from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import AccessToken
from bson import ObjectId

from AIticket.db import (
    users_collection,
    tickets_collection,
    ticket_responses_collection,
    response_citations_collection,
)

from .serializers import (
    CreateTicketSerializer,
    CheckDuplicateSerializer,
    PreviewClassifySerializer,
    EmployeeTicketSerializer,
    ClassificationOverrideSerializer,
    StatusTransitionSerializer,
    TicketCommentSerializer,
)
from .services import (
    create_ticket,
    enqueue_classification,
    get_user_tickets,
    get_ticket_by_id,
    check_duplicate_tickets,
    get_agent_queue,
    save_classification_override,
    apply_classification_override,
    transition_ticket_status,
    add_ticket_comment,
    get_ticket_timeline,
)
from .classification.category_classifier import (
    predict_category_fast,
)

from .classification.subcategory_classifier import (
    CATEGORY_SUBCATEGORIES,
    predict_subcategory_fast,
)
from apps.knowledge_base.resolution_service import(
    generate_and_persist_resolution,
)

from apps.knowledge_base.review_service import (
    get_response_for_review,
    accept_response,
    edit_and_send_response,
    reject_response,
    submit_feedback,
    send_manual_resolution,
)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ticket_taxonomy_view(request):
    """Return the selectable categories from the active classifier taxonomy."""

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return Response(
            {"message": "Authorization header missing."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            raise ValueError("Invalid Authorization header")

        user_id = AccessToken(parts[1])["user_id"]
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return Response(
            {"message": "Invalid or expired token."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user:
        return Response(
            {"message": "User not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    categories = sorted(
        category
        for category, subcategories in CATEGORY_SUBCATEGORIES.items()
        if subcategories
    )

    return Response({"categories": categories}, status=status.HTTP_200_OK)

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def create_ticket_view(request):
    """
    Create a new support ticket.

    The requester is identified from the JWT.
    The frontend cannot choose the requester.
    """

     # Get Authorization header

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return Response(
            {
                "message": "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )
    
      # Extract and validate jwt

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            return Response(
                {
                    "message": "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = parts[1]

        access_token = AccessToken(token)

        user_id = access_token["user_id"]

    except Exception as e:
        print("JWT error:", e)

        return Response(
            {
                "message": "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

        # find requester in mongodb

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        return Response(
            {
                "message": "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user:
        return Response(
            {
                "message": "User not found."
            },
            status=status.HTTP_404_NOT_FOUND
        )

   # validate ticket data

    serializer = CreateTicketSerializer(data=request.data)

    if not serializer.is_valid():

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

   # create ticket

    requester = {
        "user_id": user_id,
        "username": user["username"],
        "email": user["email"],
    }

    ticket = create_ticket(
        serializer.validated_data,
        requester
    )

    enqueue_classification(
        ticket["ticket_id"]
    )

    # return created ticket

    return Response(
        {
            "message": "Ticket created successfully.",
            "ticket": ticket,
        },
        status=status.HTTP_201_CREATED
    )

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def get_tickets_view(request):

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return Response(
            {
                "message": "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            return Response(
                {
                    "message": "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = parts[1]

        access_token = AccessToken(token)
        user_id = access_token["user_id"]

    except Exception as e:
        print("JWT error:", e)

        return Response(
            {
                "message": "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    tickets = get_user_tickets(user_id)

    safe_tickets = EmployeeTicketSerializer(
        tickets,
        many=True
    ).data

    return Response(
    {
        "ticket": safe_tickets
    },
    status=status.HTTP_200_OK
)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def get_ticket_detail_view(request, ticket_id):

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return Response(
            {
                "message": "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            return Response(
                {
                    "message": "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = parts[1]

        access_token = AccessToken(token)
        user_id = access_token["user_id"]

    except Exception as e:
        print("JWT error:", e)

        return Response(
            {
                "message": "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    ticket = get_ticket_by_id(ticket_id, user_id)

    if not ticket:
        return Response(
            {
                "message": "Ticket not found."
            },
            status=status.HTTP_404_NOT_FOUND
        )

    safe_ticket = EmployeeTicketSerializer(
        ticket,
    ).data

    return Response(
        {
            "ticket": safe_ticket
        },
        status=status.HTTP_200_OK
    )

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def check_duplicates_view(request):

    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return Response(
            {
                "message": "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            return Response(
                {
                    "message": "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = parts[1]

        access_token = AccessToken(token)

        user_id = access_token["user_id"]

    except Exception as e:
        print("JWT error:", e)

        return Response(
            {
                "message": "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    serializer = CheckDuplicateSerializer(
        data=request.data
    )

    if not serializer.is_valid():

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    subject = serializer.validated_data["subject"]
    description = serializer.validated_data["description"]

    duplicates = check_duplicate_tickets(
        user_id=user_id,
        subject=subject,
        description=description
    )

    return Response(
        {
            "has_duplicate": len(duplicates) > 0,
            "duplicates": duplicates
        },
        status=status.HTTP_200_OK
    )

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def preview_classify_view(request):
    """
    FAST-only live classification preview.

    This endpoint never invokes the LLM.
    """

    serializer = PreviewClassifySerializer(
        data=request.data
    )

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    subject = serializer.validated_data[
        "subject"
    ]

    description = serializer.validated_data[
        "description"
    ]

    category_result = predict_category_fast(
        subject=subject,
        description=description,
    )

    subcategory_result = predict_subcategory_fast(
        subject=subject,
        description=description,
        category=category_result["category"],
    )

    return Response(
        {
            "category": category_result,
            "subcategory": subcategory_result,
        },
        status=status.HTTP_200_OK
    )

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def agent_queue_view(request):
    """
    Return the active agent queue ordered by
    time remaining until SLA breach.
    """

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return Response(
            {
                "message":
                    "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        parts = auth_header.split(" ")

        if (
            len(parts) != 2
            or parts[0] != "Bearer"
        ):
            return Response(
                {
                    "message":
                        "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = parts[1]

        access_token = AccessToken(
            token
        )

        user_id = access_token[
            "user_id"
        ]

    except Exception as e:

        print(
            "JWT error:",
            e
        )

        return Response(
            {
                "message":
                    "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        return Response(
            {
                "message":
                    "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user:
        return Response(
            {
                "message":
                    "User not found."
            },
            status=status.HTTP_404_NOT_FOUND
        )

    role = user.get(
        "role",
        "User"
    )

    if role not in {
        "Agent",
        "Admin",
    }:
        return Response(
            {
                "message":
                    "Agent access required."
            },
            status=status.HTTP_403_FORBIDDEN
        )

    tickets = get_agent_queue()

    # Queue documents can carry internal Mongo references such as
    # ``latest_response_id``. Use the same public ticket representation as
    # the other ticket endpoints instead of returning raw database documents.
    safe_tickets = EmployeeTicketSerializer(
        tickets,
        many=True,
    ).data

    return Response(
        {
            "tickets": safe_tickets
        },
        status=status.HTTP_200_OK
    )

@api_view(["PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def classification_override_view(
    request,
    ticket_id,
):
    """
    Allow an agent to correct AI classification.
    """

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return Response(
            {
                "message":
                    "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if (
            len(parts) != 2
            or parts[0] != "Bearer"
        ):
            return Response(
                {
                    "message":
                        "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = AccessToken(
            parts[1]
        )

        user_id = access_token[
            "user_id"
        ]

    except Exception:
        return Response(
            {
                "message":
                    "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        return Response(
            {
                "message":
                    "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user:
        return Response(
            {
                "message":
                    "User not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.get("role") not in {
        "Agent",
        "Admin",
    }:
        return Response(
            {
                "message":
                    "Agent access required."
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ClassificationOverrideSerializer(
        data=request.data
    )

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    corrected_category = (
        serializer.validated_data.get(
            "category"
        )
    )

    corrected_severity = (
        serializer.validated_data.get(
            "severity"
        )
    )

    if (
        corrected_category is None
        and corrected_severity is None
    ):
        return Response(
            {
                "message":
                    "At least one correction is required."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    override = save_classification_override(
        ticket_id=ticket_id,
        agent_user_id=user_id,
        corrected_category=corrected_category,
        corrected_severity=corrected_severity,
    )

    if override is None:
        return Response(
            {
                "message":
                    "Ticket not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    updated_ticket = apply_classification_override(
        ticket_id=ticket_id,
        corrected_category=corrected_category,
        corrected_severity=corrected_severity,
    )

    return Response(
        {
            "message":
                "Classification override applied.",
            "override": override,
            "updated_classification": updated_ticket,
        },
    status=status.HTTP_200_OK,
    )

@api_view(["PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def transition_ticket_status_view(
    request,
    ticket_id,
):
    """
    Change ticket status using the centralized
    transition rules.
    """

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return Response(
            {
                "message":
                    "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if (
            len(parts) != 2
            or parts[0] != "Bearer"
        ):
            return Response(
                {
                    "message":
                        "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = AccessToken(
            parts[1]
        )

        user_id = access_token[
            "user_id"
        ]

    except Exception:
        return Response(
            {
                "message":
                    "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        return Response(
            {
                "message":
                    "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user:
        return Response(
            {
                "message":
                    "User not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.get("role") not in {
        "Agent",
        "Admin",
    }:
        return Response(
            {
                "message":
                    "Agent access required."
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = StatusTransitionSerializer(
        data=request.data
    )

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    new_status = serializer.validated_data[
        "status"
    ]

    resolution_summary = (
        serializer.validated_data.get(
            "resolution_summary",
            ""
        )
    )

    result = transition_ticket_status(
        ticket_id=ticket_id,
        new_status=new_status,
        actor_user_id=user_id,
        resolution_summary=resolution_summary,
    )

    if not result["success"]:

        if result["error"] == (
            "TICKET_NOT_FOUND"
        ):
            return Response(
                {
                    "message":
                        "Ticket not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if result["error"] == (
            "INVALID_TRANSITION"
        ):
            return Response(
                {
                    "error_code":
                        "INVALID_TRANSITION",

                    "message":
                        "The requested status transition is not allowed.",

                    "current_status":
                        result["current_status"],

                    "requested_status":
                        result["requested_status"],
                },
                status=status.HTTP_409_CONFLICT,
            )

    return Response(
        {
            "message":
                "Ticket status updated.",

            "transition": result,
        },
        status=status.HTTP_200_OK,
    )

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def add_ticket_comment_view(
    request,
    ticket_id,
):
    """
    Add a public or internal comment to a ticket.
    Agent/Admin only.
    """

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return Response(
            {
                "message":
                    "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if (
            len(parts) != 2
            or parts[0] != "Bearer"
        ):
            return Response(
                {
                    "message":
                        "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = AccessToken(
            parts[1]
        )

        user_id = access_token[
            "user_id"
        ]

    except Exception:
        return Response(
            {
                "message":
                    "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        return Response(
            {
                "message":
                    "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user:
        return Response(
            {
                "message":
                    "User not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if user.get("role") not in {
        "Agent",
        "Admin",
    }:
        return Response(
            {
                "message":
                    "Agent access required."
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = TicketCommentSerializer(
        data=request.data
    )

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    comment = add_ticket_comment(
        ticket_id=ticket_id,
        author_user_id=user_id,
        comment=serializer.validated_data[
            "comment"
        ],
        visibility=serializer.validated_data[
            "visibility"
        ],
    )

    if comment is None:
        return Response(
            {
                "message":
                    "Ticket not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "message":
                "Comment added.",
            "comment": comment,
        },
        status=status.HTTP_201_CREATED,
    )

@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ticket_timeline_view(
    request,
    ticket_id,
):
    """
    Return the ticket timeline.

    Employees see:
        status history
        public comments

    Agents/Admins also see:
        internal comments
    """

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return Response(
            {
                "message":
                    "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if (
            len(parts) != 2
            or parts[0] != "Bearer"
        ):
            return Response(
                {
                    "message":
                        "Invalid Authorization header."
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = AccessToken(
            parts[1]
        )

        user_id = access_token[
            "user_id"
        ]

    except Exception:
        return Response(
            {
                "message":
                    "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        return Response(
            {
                "message":
                    "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user:
        return Response(
            {
                "message":
                    "User not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    role = user.get(
        "role",
        "User"
    )

    ticket = tickets_collection.find_one(
        {
            "ticket_id": ticket_id
        }
    )

    if not ticket:
        return Response(
            {
                "message":
                    "Ticket not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if role in {
        "Agent",
        "Admin",
    }:
        include_internal = True

    else:
        if (
            str(
                ticket.get(
                    "requester",
                    {}
                ).get(
                    "user_id"
                )
            )
            != str(user_id)
        ):
            return Response(
                {
                    "message":
                        "Ticket not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        include_internal = False

    timeline = get_ticket_timeline(
        ticket_id=ticket_id,
        include_internal=include_internal,
    )

    return Response(
        {
            "ticket_id": ticket_id,
            "timeline": timeline,
        },
        status=status.HTTP_200_OK,
    )

@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def generate_resolution_view(
    request,
    ticket_id,
):
    """
    Generate and persist an M2 resolution draft.

    Agent/Admin only. Generated M2 responses include internal
    review information and must not be exposed to requesters.
    """

    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return Response(
            {
                "message": (
                    "Authorization header missing."
                )
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if (
            len(parts) != 2
            or parts[0] != "Bearer"
        ):
            return Response(
                {
                    "message": (
                        "Invalid Authorization header."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = AccessToken(
            parts[1]
        )

        user_id = access_token[
            "user_id"
        ]

    except Exception:
        return Response(
            {
                "message": (
                    "Invalid or expired token."
                )
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        user = users_collection.find_one(
            {
                "_id": ObjectId(
                    user_id
                )
            }
        )

    except Exception:
        return Response(
            {
                "message": "Invalid user ID."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user:
        return Response(
            {
                "message": "User not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    ticket = tickets_collection.find_one(
        {
            "ticket_id": ticket_id
        }
    )

    if not ticket:
        return Response(
            {
                "message": "Ticket not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    role = user.get(
        "role",
        "User",
    )

    if role not in {
        "Agent",
        "Admin",
    }:
        return Response(
            {
                "message": (
                    "Only Agent or Admin users can generate "
                    "resolution drafts."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if ticket.get(
        "resolution_status"
    ) == "DRAFT":
        return Response(
            {
                "message": (
                    "A resolution draft already "
                    "exists for this ticket."
                ),
                "resolution_status": "DRAFT",
                "latest_response_id": (
                    str(
                        ticket.get(
                            "latest_response_id"
                        )
                    )
                    if ticket.get(
                        "latest_response_id"
                    )
                    else None
                ),
            },
            status=status.HTTP_409_CONFLICT,
        )

    classification = (
        ticket.get(
            "classification"
        )
        or {}
    )

    category = (
        ticket.get(
            "category"
        )
        or (
            classification.get(
                "category"
            )
            or {}
        ).get(
            "value",
            "",
        )
    )

    severity = (
        ticket.get(
            "severity"
        )
        or (
            classification.get(
                "severity"
            )
            or {}
        ).get(
            "value",
            "",
        )
    )

    category_confidence = float(
        (
            classification.get(
                "category"
            )
            or {}
        ).get(
            "confidence",
            0.0,
        )
        or 0.0
    )

    severity_confidence = float(
        (
            classification.get(
                "severity"
            )
            or {}
        ).get(
            "confidence",
            0.0,
        )
        or 0.0
    )

    classification_confidence = max(
        category_confidence,
        severity_confidence,
    )

    ticket["category"] = category

    ticket["severity"] = severity

    try:
        response_document = (
            generate_and_persist_resolution(
                ticket=ticket,
                classification_confidence=(
                    classification_confidence
                ),
            )
        )

    except Exception as exc:
        return Response(
            {
                "message": (
                    "Resolution generation failed."
                ),
                "error": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            "message": (
                "Resolution draft generated successfully."
            ),
            "response": {
                "id": str(
                    response_document["_id"]
                ),
                "ticket_id": response_document.get(
                    "ticket_number"
                ),
                "status": response_document.get(
                    "status"
                ),
                "sufficient_context": (
                    response_document.get(
                        "sufficient_context"
                    )
                ),
                "summary": response_document.get(
                    "summary"
                ),
                "steps": response_document.get(
                    "steps"
                ),
                "escalation_recommended": (
                    response_document.get(
                        "escalation_recommended"
                    )
                ),
                "escalation_reason": (
                    response_document.get(
                        "escalation_reason"
                    )
                ),
                "confidence": response_document.get(
                    "confidence"
                ),
                "confidence_parts": (
                    response_document.get(
                        "confidence_parts"
                    )
                ),
            },
        },
        status=status.HTTP_201_CREATED,
    )

def _serialize_response_citation(citation):
    article_id = citation.get("article_id")
    chunk_index = citation.get("chunk_index")

    return {
        "article_id": str(article_id) if article_id else None,
        "article_title": citation.get("article_title"),
        "section": citation.get("heading_path", ""),
        "chunk_index": chunk_index,
        "snippet": citation.get("snippet", ""),
        "step_order": citation.get("step_order"),
        "source": (
            f"[SOURCE:{article_id}#{chunk_index}]"
            if article_id is not None and chunk_index is not None
            else None
        ),
    }


def _get_response_citations(response_id):
    citations = response_citations_collection.find(
        {"response_id": ObjectId(str(response_id))}
    ).sort([
        ("step_order", 1),
        ("retrieval_rank", 1),
    ])

    return [
        _serialize_response_citation(citation)
        for citation in citations
    ]


def _serialize_resolution_response(response_document):
    return {
        "id": str(response_document["_id"]),
        "ticket_id": response_document.get("ticket_number"),
        "status": response_document.get("status"),
        "sufficient_context": response_document.get(
            "sufficient_context"
        ),
        "summary": response_document.get("summary"),
        "steps": response_document.get("steps", []),
        "sources": response_document.get("sources", []),
        "citations": _get_response_citations(
            response_document["_id"]
        ),
        "escalation_recommended": response_document.get(
            "escalation_recommended"
        ),
        "escalation_reason": response_document.get(
            "escalation_reason"
        ),
        "confidence": response_document.get("confidence"),
        "confidence_parts": response_document.get(
            "confidence_parts"
        ),
        "steps_dropped": response_document.get(
            "steps_dropped",
            0,
        ),
        "reject_reason": response_document.get("reject_reason"),
    }


def _get_authenticated_user(request):
    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return None, Response(
            {"message": "Authorization header missing."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            raise ValueError()

        access_token = AccessToken(parts[1])

        user_id = access_token["user_id"]

        user = users_collection.find_one(
            {"_id": ObjectId(user_id)}
        )

        if not user:
            return None, Response(
                {"message": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return user, None

    except Exception:
        return None, Response(
            {"message": "Invalid or expired token."},
            status=status.HTTP_401_UNAUTHORIZED,
        )


def _require_agent_or_admin(user):
    role = user.get("role", "User")

    if role not in {
        "Agent",
        "Admin",
    }:
        return Response(
            {
                "message": (
                    "Only Agent or Admin users can "
                    "perform this action."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    return None


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def get_ticket_responses_view(
    request,
    ticket_id,
):
    """
    Return persisted M2 response drafts and review states for an
    agent-visible ticket. Internal resolution data is deliberately
    unavailable to requester-facing views.
    """
    user, error = _get_authenticated_user(request)

    if error:
        return error

    role_error = _require_agent_or_admin(user)

    if role_error:
        return role_error

    ticket = tickets_collection.find_one(
        {"ticket_id": ticket_id}
    )

    if not ticket:
        return Response(
            {"message": "Ticket not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    responses = ticket_responses_collection.find(
        {"ticket_id": ticket["_id"]}
    ).sort("created_at", -1)

    return Response(
        {
            "ticket_id": ticket_id,
            "responses": [
                _serialize_resolution_response(response_document)
                for response_document in responses
            ],
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def get_resolution_response_view(
    request,
    response_id,
):
    user, error = _get_authenticated_user(request)

    if error:
        return error

    try:
        response_document = get_response_for_review(
            response_id=response_id
        )
    except Exception:
        response_document = None

    if not response_document:
        return Response(
            {"message": "Resolution response not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    user_role = user.get("role", "User")
    is_staff = user_role in {"Agent", "Admin"}

    ticket = tickets_collection.find_one({"_id": response_document["ticket_id"]})
    is_requester = (
        ticket
        and str((ticket.get("requester") or {}).get("user_id")) == str(user["_id"])
    )
    is_sent = response_document.get("status") in {"SENT", "EDITED_SENT"}

    if not is_staff and not (is_requester and is_sent):
        return Response(
            {"message": "Only Agent or Admin users can perform this action."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response(
        _serialize_resolution_response(response_document),
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def accept_resolution_view(
    request,
    response_id,
):
    user, error = _get_authenticated_user(request)

    if error:
        return error

    role_error = _require_agent_or_admin(
        user
    )

    if role_error:
        return role_error

    try:
        response_document = accept_response(
            response_id=response_id,
            reviewer_id=user["_id"],
        )

    except ValueError as exc:
        return Response(
            {
                "message": str(exc)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "message": (
                "Resolution accepted and sent."
            ),
            "response": {
                "id": str(
                    response_document["_id"]
                ),
                "status": response_document.get(
                    "status"
                ),
                "ticket_id": response_document.get(
                    "ticket_number"
                ),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def edit_send_resolution_view(
    request,
    response_id,
):
    user, error = _get_authenticated_user(
        request
    )

    if error:
        return error

    role_error = _require_agent_or_admin(
        user
    )

    if role_error:
        return role_error

    edited_summary = request.data.get(
        "summary",
        "",
    )

    edited_steps = request.data.get(
        "steps",
        [],
    )

    if not isinstance(
        edited_steps,
        list,
    ):
        return Response(
            {
                "message": (
                    "steps must be a list."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        response_document = (
            edit_and_send_response(
                response_id=response_id,
                reviewer_id=user["_id"],
                edited_summary=edited_summary,
                edited_steps=edited_steps,
            )
        )

    except ValueError as exc:
        return Response(
            {
                "message": str(exc)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "message": (
                "Edited resolution sent."
            ),
            "response": {
                "id": str(
                    response_document["_id"]
                ),
                "status": response_document.get(
                    "status"
                ),
                "ticket_id": response_document.get(
                    "ticket_number"
                ),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def reject_resolution_view(
    request,
    response_id,
):
    user, error = _get_authenticated_user(
        request
    )

    if error:
        return error

    role_error = _require_agent_or_admin(
        user
    )

    if role_error:
        return role_error

    reason = request.data.get(
        "reason",
        "",
    )

    try:
        response_document = reject_response(
            response_id=response_id,
            reviewer_id=user["_id"],
            reason=reason,
        )

    except ValueError as exc:
        return Response(
            {
                "message": str(exc)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {
            "message": (
                "Resolution rejected."
            ),
            "response": {
                "id": str(
                    response_document["_id"]
                ),
                "status": response_document.get(
                    "status"
                ),
                "ticket_id": response_document.get(
                    "ticket_number"
                ),
                "reject_reason": response_document.get(
                    "reject_reason"
                ),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def resolution_feedback_view(
    request,
    response_id,
):
    user, error = _get_authenticated_user(
        request
    )

    if error:
        return error

    was_helpful = request.data.get(
        "was_helpful"
    )

    if not isinstance(
        was_helpful,
        bool,
    ):
        return Response(
            {
                "message": (
                    "was_helpful must be boolean."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        feedback_result = submit_feedback(
            response_id=response_id,
            user_id=user["_id"],
            was_helpful=was_helpful,
            comment=request.data.get(
                "comment",
                "",
            ),
            resolved_ticket=request.data.get(
                "resolved_ticket",
                False,
            ),
            user_role=user.get("role", "User"),
        )

    except ValueError as exc:
        msg = str(exc)
        status_code = status.HTTP_400_BAD_REQUEST
        if "already been submitted" in msg:
            status_code = status.HTTP_409_CONFLICT
        elif "only submit feedback for your own" in msg:
            status_code = status.HTTP_403_FORBIDDEN

        return Response(
            {
                "message": msg
            },
            status=status_code,
        )

    feedback_doc = feedback_result
    ticket_doc = None
    if isinstance(feedback_result, dict):
        if "feedback" in feedback_result:
            feedback_doc = feedback_result["feedback"]
            ticket_doc = feedback_result.get("ticket")

    feedback_id = (
        str(feedback_doc["_id"])
        if isinstance(feedback_doc, dict) and "_id" in feedback_doc
        else str(feedback_doc)
    )

    response_payload = {
        "message": "Feedback recorded successfully.",
        "feedback_id": feedback_id,
    }

    if ticket_doc and isinstance(ticket_doc, dict):
        response_payload.update({
            "ticket_id": ticket_doc.get("ticket_id"),
            "ticket_status": ticket_doc.get("status"),
            "resolution_status": ticket_doc.get("resolution_status"),
            "confirmed": request.data.get("resolved_ticket", False),
        })

    return Response(
        response_payload,
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def send_manual_resolution_view(
    request,
    ticket_id,
):
    user, error = _get_authenticated_user(
        request
    )

    if error:
        return error

    role_error = _require_agent_or_admin(
        user
    )

    if role_error:
        return role_error

    summary = request.data.get(
        "summary",
        "",
    )

    if isinstance(summary, str):
        summary = summary.strip()

    if not summary:
        return Response(
            {
                "message": "Manual resolution cannot be empty."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        response_document = send_manual_resolution(
            ticket_id=ticket_id,
            reviewer_id=user["_id"],
            summary=summary,
        )

    except ValueError as exc:
        msg = str(exc)
        status_code = status.HTTP_400_BAD_REQUEST
        if "Ticket not found" in msg:
            status_code = status.HTTP_404_NOT_FOUND

        return Response(
            {
                "message": msg
            },
            status=status_code,
        )

    return Response(
        {
            "message": "Manual resolution sent.",
            "response_id": str(response_document["_id"]),
            "ticket_id": response_document.get("ticket_number") or ticket_id,
            "status": response_document.get("status"),
            "resolution_status": "SENT",
            "response": {
                "id": str(response_document["_id"]),
                "status": response_document.get("status"),
                "ticket_id": response_document.get("ticket_number"),
                "summary": response_document.get("summary"),
            },
        },
        status=status.HTTP_200_OK,
    )

