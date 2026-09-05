"""
M3 Jira Integration Service Layer.
Provides functionality to create Jira issues from M3 escalation and workflow results via Jira REST API.
Configured via environment variables: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY, JIRA_ISSUE_TYPE.
Does NOT fabricate credentials or mock successful issue creation when Jira is unconfigured.
"""
import json
import base64
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from decouple import config


def get_jira_config() -> Dict[str, str]:
    """
    Retrieves Jira configuration from environment variables.
    Supports JIRA_EMAIL or JIRA_USERNAME as the API authentication user identity.
    """
    email_or_user = config("JIRA_EMAIL", default=config("JIRA_USERNAME", default=""))
    return {
        "url": config("JIRA_URL", default="").rstrip("/"),
        "email": email_or_user,
        "api_token": config("JIRA_API_TOKEN", default=""),
        "project_key": config("JIRA_PROJECT_KEY", default=""),
        "issue_type": config("JIRA_ISSUE_TYPE", default="Task"),
    }


def is_jira_configured(config_dict: Optional[Dict[str, str]] = None) -> bool:
    """
    Returns True if all required Jira environment variables are present and configured.
    """
    cfg = config_dict if config_dict is not None else get_jira_config()
    return bool(cfg.get("url") and cfg.get("email") and cfg.get("api_token") and cfg.get("project_key"))


def map_priority_to_jira(priority_str: Optional[str]) -> str:
    """
    Maps M1 IT priority (P1, P2, P3, P4) to standard Jira priority names.
    """
    if not priority_str:
        return "Medium"
    p = str(priority_str).upper()
    if "P1" in p:
        return "Highest"
    elif "P2" in p:
        return "High"
    elif "P3" in p:
        return "Medium"
    elif "P4" in p:
        return "Low"
    return "Medium"


def build_jira_description(
    ticket: Dict[str, Any],
    diagnosis: Dict[str, Any],
    validation: Dict[str, Any],
    escalation_reason: str,
    recommended_action: str = ""
) -> str:
    """
    Builds a structured description for the Jira issue preserving ticket context,
    diagnosis outputs, validation findings, and escalation details.
    """
    ticket_id = ticket.get("ticket_id", "N/A")
    subject = ticket.get("subject", "N/A")
    desc = ticket.get("description", "N/A")
    category = ticket.get("category", "N/A")
    subcategory = ticket.get("subcategory", "N/A")
    severity = ticket.get("severity", "N/A")
    priority = ticket.get("priority", "N/A")

    problem = diagnosis.get("problem_understanding", "N/A") if isinstance(diagnosis, dict) else "N/A"
    affected = diagnosis.get("affected_system", "N/A") if isinstance(diagnosis, dict) else "N/A"
    causes = ", ".join(diagnosis.get("likely_causes", [])) if isinstance(diagnosis, dict) and isinstance(diagnosis.get("likely_causes"), list) else "N/A"

    reasons = validation.get("reasons", []) if isinstance(validation, dict) and isinstance(validation.get("reasons"), list) else []
    conf = validation.get("confidence_score", 0.0) if isinstance(validation, dict) else 0.0

    return (
        f"h2. M3 Ticket Escalation Details\n\n"
        f"*Ticket ID:* {ticket_id}\n"
        f"*Subject:* {subject}\n"
        f"*Category:* {category} / {subcategory}\n"
        f"*Severity:* {severity}\n"
        f"*Priority:* {priority}\n\n"
        f"h3. User Description\n{desc}\n\n"
        f"h3. AI Technical Diagnosis\n"
        f"*Problem Understanding:* {problem}\n"
        f"*Affected System:* {affected}\n"
        f"*Likely Causes:* {causes if causes else 'None identified'}\n\n"
        f"h3. Validation & Escalation Context\n"
        f"*Escalation Reason:* {escalation_reason}\n"
        f"*Validation Composite Confidence:* {conf}\n"
        f"*Validation Findings:* {', '.join(reasons) if reasons else 'N/A'}\n"
        f"*Recommended Action:* {recommended_action if recommended_action else 'Assign to support team for manual review'}\n"
    )


def create_jira_issue(
    escalation_input: Dict[str, Any],
    jira_config_override: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Creates a real Jira issue via Jira REST API from M3 escalation context.
    If Jira configuration is missing, returns UNCONFIGURED status cleanly without fake success.
    """
    cfg = jira_config_override if jira_config_override is not None else get_jira_config()

    url = cfg.get("url", "").rstrip("/")
    email = cfg.get("email", "")
    api_token = cfg.get("api_token", "")
    project_key = cfg.get("project_key", "")
    issue_type = cfg.get("issue_type", "Task")

    if not is_jira_configured(cfg):
        return {
            "status": "UNCONFIGURED",
            "created": False,
            "jira_issue_key": None,
            "jira_issue_url": None,
            "reason": "Jira environment configuration (JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY) is missing or incomplete.",
        }

    # Extract ticket & context details
    ticket = escalation_input.get("ticket") or escalation_input.get("ticket_info") or {}
    diagnosis = escalation_input.get("diagnosis") or {}
    validation = escalation_input.get("validation") or {}
    escalation_reason = escalation_input.get("escalation_reason") or escalation_input.get("reason", "Validation failed / Escalation required")
    recommended_action = escalation_input.get("recommended_action", "")

    ticket_id = ticket.get("ticket_id", "")
    subject = ticket.get("subject", "IT Ticket Escalation")
    summary_text = f"[{ticket_id}] {subject}" if ticket_id else f"[ESCALATION] {subject}"

    description_text = build_jira_description(
        ticket=ticket,
        diagnosis=diagnosis,
        validation=validation,
        escalation_reason=escalation_reason,
        recommended_action=recommended_action,
    )

    jira_priority = map_priority_to_jira(ticket.get("priority"))

    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": summary_text,
            "description": description_text,
            "issuetype": {"name": issue_type},
            "priority": {"name": jira_priority},
        }
    }

    # HTTP Basic Authentication Header
    auth_str = f"{email}:{api_token}"
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

    endpoint = f"{url}/rest/api/2/issue"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {b64_auth}",
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            issue_key = resp_data.get("key", "")
            issue_url = f"{url}/browse/{issue_key}" if issue_key else None

            return {
                "status": "SUCCESS",
                "created": True,
                "jira_issue_key": issue_key,
                "jira_issue_id": resp_data.get("id"),
                "jira_issue_url": issue_url,
                "reason": "Jira issue created successfully.",
            }
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            pass
        return {
            "status": "FAILED",
            "created": False,
            "jira_issue_key": None,
            "jira_issue_url": None,
            "http_code": e.code,
            "reason": f"Jira API request failed (HTTP {e.code}): {err_body or e.reason}",
        }
    except Exception as e:
        return {
            "status": "FAILED",
            "created": False,
            "jira_issue_key": None,
            "jira_issue_url": None,
            "reason": f"Jira connection error: {str(e)}",
        }
