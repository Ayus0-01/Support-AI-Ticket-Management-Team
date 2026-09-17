"""
M3 Jira Integration Service Layer.

Provides Jira REST API integration for:
- Creating Jira issues
- Reading Jira issue details
- Updating Jira issues
- Updating Jira status through Jira transitions
- Synchronizing Jira status back to SupportPilot
- Saving Jira <-> SupportPilot ticket mapping

Configured through environment variables:
JIRA_URL
JIRA_EMAIL
JIRA_USERNAME
JIRA_API_TOKEN
JIRA_PROJECT_KEY
JIRA_ISSUE_TYPE

The service never fabricates Jira credentials or fake SUCCESS responses.
"""

import base64
import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from decouple import config

from AIticket.db import tickets_collection

logger = logging.getLogger(__name__)


# ============================================================
# JIRA CONFIGURATION
# ============================================================

def get_jira_config() -> Dict[str, str]:
    """
    Read Jira configuration from environment variables.
    Supports JIRA_EMAIL or JIRA_USERNAME.
    """
    email_or_user = config(
        "JIRA_EMAIL",
        default=config("JIRA_USERNAME", default="")
    )

    return {
        "url": config("JIRA_URL", default="").rstrip("/"),
        "email": email_or_user,
        "api_token": config("JIRA_API_TOKEN", default=""),
        "project_key": config("JIRA_PROJECT_KEY", default=""),
        "issue_type": config("JIRA_ISSUE_TYPE", default="Task"),
    }


def is_jira_configured(
    config_dict: Optional[Dict[str, str]] = None
) -> bool:
    """
    Check whether the minimum Jira configuration is available.
    """
    cfg = (
        config_dict
        if config_dict is not None
        else get_jira_config()
    )

    return bool(
        cfg.get("url")
        and cfg.get("email")
        and cfg.get("api_token")
        and cfg.get("project_key")
    )


# ============================================================
# AUTHENTICATION / HTTP HELPERS
# ============================================================

def _build_auth_header(
    email: str,
    api_token: str
) -> str:
    """
    Build Jira Basic Authentication header.
    """
    auth_string = f"{email}:{api_token}"

    encoded = base64.b64encode(
        auth_string.encode("utf-8")
    ).decode("utf-8")

    return f"Basic {encoded}"


def _jira_request(
    method: str,
    endpoint: str,
    payload: Optional[Dict[str, Any]] = None,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Generic Jira REST API request helper.
    """
    cfg = (
        jira_config_override
        if jira_config_override is not None
        else get_jira_config()
    )

    if not is_jira_configured(cfg):
        return {
            "status": "UNCONFIGURED",
            "success": False,
            "reason": (
                "Jira environment configuration is missing or incomplete."
            ),
        }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": _build_auth_header(
            cfg["email"],
            cfg["api_token"],
        ),
    }

    request_data = None

    if payload is not None:
        request_data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        endpoint,
        data=request_data,
        headers=headers,
        method=method.upper(),
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=30,
        ) as response:

            raw_body = response.read().decode("utf-8")

            if raw_body:
                try:
                    response_data = json.loads(raw_body)
                except json.JSONDecodeError:
                    response_data = {
                        "raw": raw_body
                    }
            else:
                response_data = {}

            return {
                "status": "SUCCESS",
                "success": True,
                "http_code": response.status,
                "data": response_data,
            }

    except urllib.error.HTTPError as exc:

        error_body = ""

        try:
            error_body = exc.read().decode("utf-8")
        except Exception:
            pass

        return {
            "status": "FAILED",
            "success": False,
            "http_code": exc.code,
            "reason": (
                f"Jira API request failed "
                f"(HTTP {exc.code}): "
                f"{error_body or exc.reason}"
            ),
        }

    except Exception as exc:

        logger.exception("Jira API request failed")

        return {
            "status": "FAILED",
            "success": False,
            "reason": f"Jira connection error: {str(exc)}",
        }


# ============================================================
# PRIORITY MAPPING
# ============================================================

def map_priority_to_jira(
    priority_str: Optional[str]
) -> str:
    """
    Map SupportPilot priorities to Jira priority names.
    """
    if not priority_str:
        return "Medium"

    priority = str(priority_str).upper()

    if "P1" in priority:
        return "Highest"

    if "P2" in priority:
        return "High"

    if "P3" in priority:
        return "Medium"

    if "P4" in priority:
        return "Low"

    return "Medium"


# ============================================================
# SUPPORTPILOT -> JIRA STATUS MAPPING
# ============================================================

def map_supportpilot_status_to_jira(
    status_value: Optional[str]
) -> str:
    """
    Convert SupportPilot ticket status into a Jira status name.
    """
    status_value = str(
        status_value or "Open"
    ).strip().lower()

    mapping = {
    "open": "Open",
    "in progress": "In Progress",
    "resolved": "Done",
    "closed": "Done",
    "escalated": "In Progress",
}
        
        
        
        
        
    

    return mapping.get(
        status_value,
        "Open",
    )


# ============================================================
# JIRA -> SUPPORTPILOT STATUS MAPPING
# ============================================================

def map_jira_status_to_supportpilot(
    jira_status: Optional[str]
) -> str:
    """
    Convert Jira status into SupportPilot status.
    """
    status_value = str(
        jira_status or ""
    ).strip().lower()

    if status_value in {
        "resolved",
        "closed",
        "done",
    }:
        return "Resolved"

    if status_value in {
        "in progress",
        "in development",
        "escalated",
    }:
        return "In Progress"

    return "Open"


# ============================================================
# JIRA DESCRIPTION
# ============================================================

def build_jira_description(
    ticket: Dict[str, Any],
    diagnosis: Dict[str, Any],
    validation: Dict[str, Any],
    escalation_reason: str,
    recommended_action: str = "",
) -> str:
    """
    Build a structured Jira description.
    """

    ticket_id = ticket.get(
        "ticket_id",
        "N/A",
    )

    subject = ticket.get(
        "subject",
        "N/A",
    )

    description = ticket.get(
        "description",
        "N/A",
    )

    category = ticket.get(
        "category",
        "N/A",
    )

    subcategory = ticket.get(
        "subcategory",
        "N/A",
    )

    severity = ticket.get(
        "severity",
        "N/A",
    )

    priority = ticket.get(
        "priority",
        "N/A",
    )

    problem = (
        diagnosis.get(
            "problem_understanding",
            "N/A",
        )
        if isinstance(diagnosis, dict)
        else "N/A"
    )

    affected = (
        diagnosis.get(
            "affected_system",
            "N/A",
        )
        if isinstance(diagnosis, dict)
        else "N/A"
    )

    likely_causes = (
        diagnosis.get(
            "likely_causes",
            [],
        )
        if isinstance(diagnosis, dict)
        else []
    )

    if isinstance(likely_causes, list):
        causes = ", ".join(
            str(item)
            for item in likely_causes
        )
    else:
        causes = str(likely_causes)

    reasons = (
        validation.get(
            "reasons",
            [],
        )
        if isinstance(validation, dict)
        else []
    )

    confidence = (
        validation.get(
            "confidence_score",
            0.0,
        )
        if isinstance(validation, dict)
        else 0.0
    )

    if isinstance(reasons, list):
        validation_reasons = ", ".join(
            str(item)
            for item in reasons
        )
    else:
        validation_reasons = str(reasons)

    return (
        "h2. M3 Ticket Escalation Details\n\n"
        f"*Ticket ID:* {ticket_id}\n"
        f"*Subject:* {subject}\n"
        f"*Category:* {category} / {subcategory}\n"
        f"*Severity:* {severity}\n"
        f"*Priority:* {priority}\n\n"
        "h3. User Description\n"
        f"{description}\n\n"
        "h3. AI Technical Diagnosis\n"
        f"*Problem Understanding:* {problem}\n"
        f"*Affected System:* {affected}\n"
        f"*Likely Causes:* "
        f"{causes or 'None identified'}\n\n"
        "h3. Validation & Escalation Context\n"
        f"*Escalation Reason:* "
        f"{escalation_reason}\n"
        f"*Validation Composite Confidence:* "
        f"{confidence}\n"
        f"*Validation Findings:* "
        f"{validation_reasons or 'N/A'}\n"
        f"*Recommended Action:* "
        f"{recommended_action or 'Assign to support team for manual review'}\n"
    )


# ============================================================
# SAVE JIRA MAPPING
# ============================================================

def _save_jira_mapping(
    ticket_id: str,
    jira_issue_key: str,
    jira_issue_id: Optional[str],
    jira_status: str = "Open",
) -> Dict[str, Any]:
    """
    Save Jira mapping directly on the SupportPilot ticket.

    This avoids requiring a new Mongo collection before we finish
    the integration. A dedicated Jira_Tickets collection can be added
    later without breaking this mapping.
    """

    if not ticket_id or not jira_issue_key:
        return {
            "saved": False,
            "reason": "ticket_id and jira_issue_key are required.",
        }

    now = datetime.now(timezone.utc)

    result = tickets_collection.update_one(
        {
            "ticket_id": ticket_id,
        },
        {
            "$set": {
                "jira": {
                    "jira_issue_key": jira_issue_key,
                    "jira_issue_id": jira_issue_id,
                    "jira_status": jira_status,
                    "last_updated": now,
                },
                "updated_at": now,
            }
        },
    )

    return {
        "saved": result.modified_count > 0
        or result.matched_count > 0,
        "ticket_id": ticket_id,
        "jira_issue_key": jira_issue_key,
        "jira_issue_id": jira_issue_id,
        "jira_status": jira_status,
    }


# ============================================================
# CREATE JIRA ISSUE
# ============================================================

def create_jira_issue(
    escalation_input: Dict[str, Any],
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Create a real Jira issue from M3 escalation context.
    """

    cfg = (
        jira_config_override
        if jira_config_override is not None
        else get_jira_config()
    )

    if not is_jira_configured(cfg):
        return {
            "status": "UNCONFIGURED",
            "created": False,
            "jira_issue_key": None,
            "jira_issue_id": None,
            "jira_issue_url": None,
            "reason": (
                "Jira environment configuration "
                "(JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN, "
                "JIRA_PROJECT_KEY) is missing or incomplete."
            ),
        }

    ticket = (
        escalation_input.get("ticket")
        or escalation_input.get("ticket_info")
        or {}
    )

    diagnosis = (
        escalation_input.get("diagnosis")
        or {}
    )

    validation = (
        escalation_input.get("validation")
        or {}
    )

    escalation_reason = (
        escalation_input.get(
            "escalation_reason"
        )
        or escalation_input.get(
            "reason",
            "Validation failed / Escalation required",
        )
    )

    recommended_action = escalation_input.get(
        "recommended_action",
        "",
    )

    ticket_id = ticket.get(
        "ticket_id",
        "",
    )

    subject = ticket.get(
        "subject",
        "IT Ticket Escalation",
    )

    summary = (
        f"[{ticket_id}] {subject}"
        if ticket_id
        else f"[ESCALATION] {subject}"
    )

    description = build_jira_description(
        ticket=ticket,
        diagnosis=diagnosis,
        validation=validation,
        escalation_reason=escalation_reason,
        recommended_action=recommended_action,
    )

    payload = {
        "fields": {
            "project": {
                "key": cfg["project_key"],
            },
            "summary": summary,
            "description": description,
            "issuetype": {
                "name": cfg.get(
                    "issue_type",
                    "Task",
                ),
            },
            "priority": {
                "name": map_priority_to_jira(
                    ticket.get("priority")
                ),
            },
        }
    }

    endpoint = (
        f"{cfg['url']}/rest/api/2/issue"
    )

    result = _jira_request(
        method="POST",
        endpoint=endpoint,
        payload=payload,
        jira_config_override=cfg,
    )

    if result.get("status") != "SUCCESS":

        return {
            "status": result.get(
                "status",
                "FAILED",
            ),
            "created": False,
            "jira_issue_key": None,
            "jira_issue_id": None,
            "jira_issue_url": None,
            "http_code": result.get(
                "http_code"
            ),
            "reason": result.get(
                "reason",
                "Failed to create Jira issue.",
            ),
        }

    jira_data = result.get(
        "data",
        {}
    )

    issue_key = jira_data.get(
        "key"
    )

    issue_id = jira_data.get(
        "id"
    )

    issue_url = (
        f"{cfg['url']}/browse/{issue_key}"
        if issue_key
        else None
    )

    mapping_result = None

    if issue_key and ticket_id:

        mapping_result = _save_jira_mapping(
            ticket_id=ticket_id,
            jira_issue_key=issue_key,
            jira_issue_id=issue_id,
            jira_status="Open",
        )

    return {
        "status": "SUCCESS",
        "created": True,
        "jira_issue_key": issue_key,
        "jira_issue_id": issue_id,
        "jira_issue_url": issue_url,
        "ticket_id": ticket_id,
        "jira_status": "Open",
        "mapping": mapping_result,
        "reason": "Jira issue created successfully.",
    }


# ============================================================
# GET JIRA ISSUE
# ============================================================

def get_jira_issue(
    ticket_id: Optional[str] = None,
    jira_issue_key: Optional[str] = None,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Retrieve Jira issue details.

    Either ticket_id or jira_issue_key can be supplied.
    """

    cfg = (
        jira_config_override
        if jira_config_override is not None
        else get_jira_config()
    )

    if not is_jira_configured(cfg):
        return {
            "status": "UNCONFIGURED",
            "success": False,
            "reason": "Jira configuration is missing.",
        }

    key = jira_issue_key

    if not key and ticket_id:

        ticket = tickets_collection.find_one(
            {
                "ticket_id": ticket_id,
            }
        )

        if ticket:
            jira_data = ticket.get(
                "jira",
                {}
            )

            if isinstance(jira_data, dict):
                key = jira_data.get(
                    "jira_issue_key"
                )

    if not key:
        return {
            "status": "NOT_FOUND",
            "success": False,
            "reason": (
                "No Jira issue mapping found "
                "for the requested ticket."
            ),
        }

    endpoint = (
        f"{cfg['url']}/rest/api/2/issue/{key}"
    )

    result = _jira_request(
        method="GET",
        endpoint=endpoint,
        jira_config_override=cfg,
    )

    if result.get("status") != "SUCCESS":
        return result

    data = result.get(
        "data",
        {}
    )

    fields = data.get(
        "fields",
        {}
    )

    jira_status = (
        fields.get(
            "status",
            {}
        ).get(
            "name"
        )
        if isinstance(
            fields.get("status"),
            dict
        )
        else None
    )

    return {
        "status": "SUCCESS",
        "success": True,
        "ticket_id": ticket_id,
        "jira_issue_key": data.get(
            "key",
            key,
        ),
        "jira_issue_id": data.get(
            "id"
        ),
        "jira_status": jira_status,
        "summary": fields.get(
            "summary"
        ),
        "description": fields.get(
            "description"
        ),
        "priority": (
            fields.get(
                "priority",
                {}
            ).get("name")
            if isinstance(
                fields.get("priority"),
                dict
            )
            else None
        ),
        "url": (
            f"{cfg['url']}/browse/{data.get('key', key)}"
        ),
        "data": data,
    }


# ============================================================
# UPDATE JIRA ISSUE
# ============================================================

def update_jira_issue(
    ticket_id: Optional[str] = None,
    jira_issue_key: Optional[str] = None,
    fields: Optional[Dict[str, Any]] = None,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Update Jira issue fields.
    """

    cfg = (
        jira_config_override
        if jira_config_override is not None
        else get_jira_config()
    )

    if not is_jira_configured(cfg):
        return {
            "status": "UNCONFIGURED",
            "updated": False,
            "reason": "Jira configuration is missing.",
        }

    key = jira_issue_key

    if not key and ticket_id:

        ticket = tickets_collection.find_one(
            {
                "ticket_id": ticket_id,
            }
        )

        if ticket:
            jira_data = ticket.get(
                "jira",
                {}
            )

            if isinstance(jira_data, dict):
                key = jira_data.get(
                    "jira_issue_key"
                )

    if not key:
        return {
            "status": "NOT_FOUND",
            "updated": False,
            "reason": "Jira issue mapping not found.",
        }

    payload = {
        "fields": fields or {}
    }

    endpoint = (
        f"{cfg['url']}/rest/api/2/issue/{key}"
    )

    result = _jira_request(
        method="PUT",
        endpoint=endpoint,
        payload=payload,
        jira_config_override=cfg,
    )

    if result.get("status") != "SUCCESS":
        return {
            **result,
            "updated": False,
            "jira_issue_key": key,
        }

    return {
        "status": "SUCCESS",
        "updated": True,
        "jira_issue_key": key,
        "ticket_id": ticket_id,
        "reason": "Jira issue updated successfully.",
    }


# ============================================================
# GET JIRA TRANSITIONS
# ============================================================

def get_jira_transitions(
    jira_issue_key: str,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Get available Jira workflow transitions.
    """

    cfg = (
        jira_config_override
        if jira_config_override is not None
        else get_jira_config()
    )

    if not jira_issue_key:
        return {
            "status": "FAILED",
            "success": False,
            "reason": "jira_issue_key is required.",
        }

    endpoint = (
        f"{cfg['url']}/rest/api/2/issue/"
        f"{jira_issue_key}/transitions"
    )

    return _jira_request(
        method="GET",
        endpoint=endpoint,
        jira_config_override=cfg,
    )


# ============================================================
# TRANSITION JIRA STATUS
# ============================================================

def transition_jira_issue(
    jira_issue_key: str,
    target_status: str,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Change Jira issue status using an available Jira transition.

    Jira workflows use transition IDs rather than allowing a
    simple arbitrary status field update.
    """

    cfg = (
        jira_config_override
        if jira_config_override is not None
        else get_jira_config()
    )

    if not jira_issue_key:
        return {
            "status": "FAILED",
            "transitioned": False,
            "reason": "jira_issue_key is required.",
        }

    transitions_result = get_jira_transitions(
        jira_issue_key=jira_issue_key,
        jira_config_override=cfg,
    )

    if transitions_result.get(
        "status"
    ) != "SUCCESS":

        return {
            "status": transitions_result.get(
                "status",
                "FAILED",
            ),
            "transitioned": False,
            "reason": transitions_result.get(
                "reason",
                "Could not read Jira transitions.",
            ),
        }

    transitions_data = transitions_result.get(
        "data",
        {}
    )

    transitions = transitions_data.get(
        "transitions",
        []
    )

    target_normalized = str(
        target_status
    ).strip().lower()

    selected_transition = None

    for transition in transitions:

        transition_name = str(
            transition.get(
                "name",
                ""
            )
        ).strip().lower()

        to_status = (
            transition.get(
                "to",
                {}
            ).get(
                "name",
                ""
            )
            if isinstance(
                transition.get("to"),
                dict
            )
            else ""
        )

        to_status = str(
            to_status
        ).strip().lower()

        if (
            transition_name == target_normalized
            or to_status == target_normalized
        ):
            selected_transition = transition
            break

    if not selected_transition:

        available = [
            transition.get(
                "name"
            )
            for transition in transitions
        ]

        return {
            "status": "FAILED",
            "transitioned": False,
            "reason": (
                f"No Jira transition found for "
                f"target status '{target_status}'."
            ),
            "available_transitions": available,
        }

    transition_id = selected_transition.get(
        "id"
    )

    endpoint = (
        f"{cfg['url']}/rest/api/2/issue/"
        f"{jira_issue_key}/transitions"
    )

    payload = {
        "transition": {
            "id": transition_id,
        }
    }

    result = _jira_request(
        method="POST",
        endpoint=endpoint,
        payload=payload,
        jira_config_override=cfg,
    )

    if result.get("status") != "SUCCESS":

        return {
            **result,
            "transitioned": False,
            "jira_issue_key": jira_issue_key,
        }

    return {
        "status": "SUCCESS",
        "transitioned": True,
        "jira_issue_key": jira_issue_key,
        "target_status": target_status,
        "transition_id": transition_id,
        "reason": "Jira status transitioned successfully.",
    }


# ============================================================
# UPDATE JIRA STATUS FROM SUPPORTPILOT
# ============================================================

def update_jira_status_for_ticket(
    ticket_id: str,
    supportpilot_status: str,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Update Jira status based on SupportPilot ticket status.
    """

    target_jira_status = map_supportpilot_status_to_jira(
        supportpilot_status
    )

    ticket = tickets_collection.find_one(
        {
            "ticket_id": ticket_id,
        }
    )

    if not ticket:
        return {
            "status": "NOT_FOUND",
            "updated": False,
            "reason": (
                f"SupportPilot ticket '{ticket_id}' "
                "was not found."
            ),
        }

    jira_data = ticket.get(
        "jira",
        {}
    )

    jira_issue_key = (
        jira_data.get(
            "jira_issue_key"
        )
        if isinstance(jira_data, dict)
        else None
    )

    if not jira_issue_key:
        return {
            "status": "NOT_FOUND",
            "updated": False,
            "ticket_id": ticket_id,
            "reason": (
                "No Jira issue is mapped to this "
                "SupportPilot ticket."
            ),
        }

    result = transition_jira_issue(
        jira_issue_key=jira_issue_key,
        target_status=target_jira_status,
        jira_config_override=jira_config_override,
    )

    if result.get("status") == "SUCCESS":

        now = datetime.now(timezone.utc)

        tickets_collection.update_one(
            {
                "ticket_id": ticket_id,
            },
            {
                "$set": {
                    "jira.jira_status": target_jira_status,
                    "jira.last_updated": now,
                    "updated_at": now,
                }
            },
        )

    return {
        **result,
        "ticket_id": ticket_id,
        "jira_issue_key": jira_issue_key,
        "jira_status": target_jira_status,
    }


# ============================================================
# SYNC JIRA STATUS -> SUPPORTPILOT
# ============================================================

def sync_jira_status_for_ticket(
    ticket_id: str,
    jira_config_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Read Jira status and synchronize it into SupportPilot.
    """

    ticket = tickets_collection.find_one(
        {
            "ticket_id": ticket_id,
        }
    )

    if not ticket:
        return {
            "status": "NOT_FOUND",
            "synced": False,
            "reason": (
                f"SupportPilot ticket '{ticket_id}' "
                "was not found."
            ),
        }

    jira_data = ticket.get(
        "jira",
        {}
    )

    jira_issue_key = (
        jira_data.get(
            "jira_issue_key"
        )
        if isinstance(jira_data, dict)
        else None
    )

    if not jira_issue_key:
        return {
            "status": "NOT_FOUND",
            "synced": False,
            "reason": (
                "No Jira issue mapping exists "
                "for this ticket."
            ),
        }

    jira_result = get_jira_issue(
        ticket_id=ticket_id,
        jira_issue_key=jira_issue_key,
        jira_config_override=jira_config_override,
    )

    if jira_result.get(
        "status"
    ) != "SUCCESS":

        return {
            **jira_result,
            "synced": False,
        }

    jira_status = jira_result.get(
        "jira_status"
    )

    supportpilot_status = (
        map_jira_status_to_supportpilot(
            jira_status
        )
    )

    now = datetime.now(timezone.utc)

    tickets_collection.update_one(
        {
            "ticket_id": ticket_id,
        },
        {
            "$set": {
                "jira.jira_status": jira_status,
                "jira.last_updated": now,
                "status": supportpilot_status,
                "updated_at": now,
            }
        },
    )

    return {
        "status": "SUCCESS",
        "synced": True,
        "ticket_id": ticket_id,
        "jira_issue_key": jira_issue_key,
        "jira_status": jira_status,
        "supportpilot_status": supportpilot_status,
        "last_updated": now.isoformat(),
    }