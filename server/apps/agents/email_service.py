"""
M3 Email Integration Service Layer.
Provides functionality to send ticket escalation email notifications via SMTP / Django email backend.
Configured via environment variables:
EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS, EMAIL_USE_SSL, DEFAULT_FROM_EMAIL, SUPPORT_TEAM_EMAIL.
Does NOT fabricate credentials or mock successful email delivery when email is unconfigured.
"""
import logging
from typing import Dict, Any, Optional
from decouple import config
from django.core.mail import get_connection, EmailMultiAlternatives

logger = logging.getLogger(__name__)


def get_email_config() -> Dict[str, Any]:
    """
    Retrieves Email/SMTP configuration from environment variables.
    """
    return {
        "smtp_host": config("EMAIL_HOST", default=""),
        "smtp_port": config("EMAIL_PORT", default=587, cast=int),
        "smtp_user": config("EMAIL_HOST_USER", default=""),
        "smtp_password": config("EMAIL_HOST_PASSWORD", default=""),
        "use_tls": config("EMAIL_USE_TLS", default=True, cast=bool),
        "use_ssl": config("EMAIL_USE_SSL", default=False, cast=bool),
        "from_email": config("DEFAULT_FROM_EMAIL", default=config("EMAIL_HOST_USER", default="noreply@support.ai")),
        "support_email": config("SUPPORT_TEAM_EMAIL", default=""),
    }


def is_email_configured(config_dict: Optional[Dict[str, Any]] = None) -> bool:
    """
    Returns True if required SMTP host, user, password, and support recipient email are configured.
    """
    cfg = config_dict if config_dict is not None else get_email_config()
    return bool(
        cfg.get("smtp_host")
        and cfg.get("smtp_user")
        and cfg.get("smtp_password")
        and (cfg.get("support_email") or cfg.get("from_email"))
    )


def build_escalation_email_content(
    ticket: Dict[str, Any],
    diagnosis: Dict[str, Any],
    validation: Dict[str, Any],
    escalation_reason: str,
    jira_result: Optional[Dict[str, Any]] = None,
    recommended_action: str = ""
) -> Dict[str, str]:
    """
    Builds subject, plain text, and HTML formatted email body containing complete ticket details,
    AI technical diagnosis, validation failure context, and Jira issue details.
    """
    ticket_id = ticket.get("ticket_id", "N/A")
    subject_line = ticket.get("subject", "N/A")
    desc = ticket.get("description", "N/A")
    category = ticket.get("category", "N/A")
    subcategory = ticket.get("subcategory", "N/A")
    severity = ticket.get("severity", "N/A")
    priority = ticket.get("priority", "N/A")

    problem = diagnosis.get("problem_understanding", "N/A") if isinstance(diagnosis, dict) else "N/A"
    affected = diagnosis.get("affected_system", "N/A") if isinstance(diagnosis, dict) else "N/A"
    causes_list = diagnosis.get("likely_causes", []) if isinstance(diagnosis, dict) and isinstance(diagnosis.get("likely_causes"), list) else []
    causes = ", ".join(causes_list) if causes_list else "None identified"

    reasons = validation.get("reasons", []) if isinstance(validation, dict) and isinstance(validation.get("reasons"), list) else []
    conf = validation.get("confidence_score", 0.0) if isinstance(validation, dict) else 0.0

    jira_key = jira_result.get("jira_issue_key") if isinstance(jira_result, dict) else None
    jira_url = jira_result.get("jira_issue_url") if isinstance(jira_result, dict) else None

    email_subject = f"[ESCALATION REQUIRED] Ticket #{ticket_id}: {subject_line}"

    # Plain text content
    text_parts = [
        f"M3 TICKET ESCALATION NOTIFICATION",
        f"----------------------------------------",
        f"Ticket ID: {ticket_id}",
        f"Subject: {subject_line}",
        f"Category: {category} / {subcategory}",
        f"Severity: {severity}",
        f"Priority: {priority}",
        f"\nUSER DESCRIPTION:",
        f"{desc}",
        f"\nAI TECHNICAL DIAGNOSIS:",
        f"- Problem Understanding: {problem}",
        f"- Affected System: {affected}",
        f"- Likely Causes: {causes}",
        f"\nVALIDATION & ESCALATION CONTEXT:",
        f"- Escalation Reason: {escalation_reason}",
        f"- Composite Confidence: {conf}",
        f"- Validation Findings: {', '.join(reasons) if reasons else 'N/A'}",
        f"- Recommended Action: {recommended_action if recommended_action else 'Assign to support team for manual review'}",
    ]

    if jira_key:
        text_parts.extend([
            f"\nJIRA ISSUE DETAILS:",
            f"- Jira Issue Key: {jira_key}",
            f"- Jira Issue URL: {jira_url or 'N/A'}",
        ])

    text_body = "\n".join(text_parts)

    # HTML content
    jira_html = ""
    if jira_key:
        jira_html = f"""
        <h3>Jira Issue Details</h3>
        <p><strong>Jira Key:</strong> {jira_key}<br>
        <strong>Jira URL:</strong> <a href="{jira_url}">{jira_url}</a></p>
        """

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #d9534f;">M3 Ticket Escalation Notification</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px; font-weight: bold; width: 140px;">Ticket ID:</td><td style="padding: 6px;">{ticket_id}</td></tr>
          <tr><td style="padding: 6px; font-weight: bold;">Subject:</td><td style="padding: 6px;">{subject_line}</td></tr>
          <tr><td style="padding: 6px; font-weight: bold;">Category:</td><td style="padding: 6px;">{category} / {subcategory}</td></tr>
          <tr><td style="padding: 6px; font-weight: bold;">Severity:</td><td style="padding: 6px;">{severity}</td></tr>
          <tr><td style="padding: 6px; font-weight: bold;">Priority:</td><td style="padding: 6px;">{priority}</td></tr>
        </table>
        
        <h3>User Description</h3>
        <p style="background: #f8f9fa; padding: 10px; border-left: 4px solid #0275d8;">{desc}</p>
        
        <h3>AI Technical Diagnosis</h3>
        <ul>
          <li><strong>Problem Understanding:</strong> {problem}</li>
          <li><strong>Affected System:</strong> {affected}</li>
          <li><strong>Likely Causes:</strong> {causes}</li>
        </ul>
        
        <h3>Validation & Escalation Context</h3>
        <ul>
          <li><strong>Escalation Reason:</strong> {escalation_reason}</li>
          <li><strong>Composite Confidence:</strong> {conf}</li>
          <li><strong>Validation Findings:</strong> {', '.join(reasons) if reasons else 'N/A'}</li>
          <li><strong>Recommended Action:</strong> {recommended_action if recommended_action else 'Assign to support team for manual review'}</li>
        </ul>
        {jira_html}
      </body>
    </html>
    """

    return {
        "subject": email_subject,
        "text_body": text_body,
        "html_body": html_body,
    }


def send_escalation_email(
    escalation_input: Dict[str, Any],
    recipient_email: Optional[str] = None,
    email_config_override: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Sends an escalation notification email via SMTP using Django's email infrastructure.
    If SMTP/Email configuration is missing, returns UNCONFIGURED status cleanly without fake success.
    """
    cfg = email_config_override if email_config_override is not None else get_email_config()

    target_recipient = recipient_email or cfg.get("support_email") or cfg.get("from_email")

    if not is_email_configured(cfg) or not target_recipient:
        return {
            "status": "UNCONFIGURED",
            "sent": False,
            "recipient": target_recipient,
            "reason": "SMTP email configuration (EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD) is missing or incomplete.",
        }

    ticket = escalation_input.get("ticket") or escalation_input.get("ticket_info") or {}
    diagnosis = escalation_input.get("diagnosis") or {}
    validation = escalation_input.get("validation") or {}
    escalation_reason = escalation_input.get("escalation_reason") or escalation_input.get("reason", "Validation failed / Escalation required")
    jira_result = escalation_input.get("jira_result") or escalation_input.get("jira") or {}
    recommended_action = escalation_input.get("recommended_action", "")

    content = build_escalation_email_content(
        ticket=ticket,
        diagnosis=diagnosis,
        validation=validation,
        escalation_reason=escalation_reason,
        jira_result=jira_result,
        recommended_action=recommended_action,
    )

    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=cfg.get("smtp_host"),
            port=cfg.get("smtp_port", 587),
            username=cfg.get("smtp_user"),
            password=cfg.get("smtp_password"),
            use_tls=cfg.get("use_tls", True),
            use_ssl=cfg.get("use_ssl", False),
            fail_silently=False,
        )

        msg = EmailMultiAlternatives(
            subject=content["subject"],
            body=content["text_body"],
            from_email=cfg.get("from_email"),
            to=[target_recipient],
            connection=connection,
        )
        msg.attach_alternative(content["html_body"], "text/html")

        sent_count = msg.send(fail_silently=False)

        if sent_count > 0:
            return {
                "status": "SUCCESS",
                "sent": True,
                "recipient": target_recipient,
                "subject": content["subject"],
                "reason": "Escalation notification email sent successfully.",
            }
        else:
            return {
                "status": "FAILED",
                "sent": False,
                "recipient": target_recipient,
                "reason": "Email backend reported zero messages sent.",
            }

    except Exception as e:
        logger.error(f"Failed to send escalation email: {str(e)}")
        return {
            "status": "FAILED",
            "sent": False,
            "recipient": target_recipient,
            "reason": f"SMTP Email connection error: {str(e)}",
        }


def build_resolution_email_content(
    ticket: Dict[str, Any],
    response: Dict[str, Any],
) -> Dict[str, str]:
    """
    Builds subject, plain text, and HTML formatted email body containing user-facing
    resolution details for the ticket requester.
    """
    ticket_id = ticket.get("ticket_id") or ticket.get("ticket_number") or "N/A"
    subject_line = ticket.get("subject", "N/A")

    summary = response.get("summary", "N/A") if isinstance(response, dict) else "N/A"
    steps = response.get("steps", []) if isinstance(response, dict) and isinstance(response.get("steps"), list) else []

    email_subject = f"[Resolution Provided] Ticket #{ticket_id}: {subject_line}"

    steps_text_list = []
    steps_html_list = []
    for step in steps:
        order = step.get("order", "") if isinstance(step, dict) else ""
        instruction = step.get("instruction", "") if isinstance(step, dict) else str(step)
        prefix = f"{order}. " if order else "- "
        steps_text_list.append(f"{prefix}{instruction}")
        steps_html_list.append(f"<li>{instruction}</li>")

    steps_text = "\n".join(steps_text_list) if steps_text_list else "No detailed steps provided."
    steps_html = f"<ol style=\"padding-left: 20px;\">{''.join(steps_html_list)}</ol>" if steps_html_list else "<p>No detailed steps provided.</p>"

    text_parts = [
        "TICKET RESOLUTION NOTIFICATION",
        "----------------------------------------",
        f"Ticket ID: {ticket_id}",
        f"Subject: {subject_line}",
        "\nRESOLUTION SUMMARY:",
        f"{summary}",
        "\nRECOMMENDED STEPS:",
        f"{steps_text}",
    ]
    text_body = "\n".join(text_parts)

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #0275d8;">Resolution Provided for Ticket #{ticket_id}</h2>
        <p><strong>Subject:</strong> {subject_line}</p>
        
        <h3>Resolution Summary</h3>
        <p style="background: #f8f9fa; padding: 10px; border-left: 4px solid #5cb85c;">{summary}</p>
        
        <h3>Recommended Steps</h3>
        {steps_html}
      </body>
    </html>
    """

    return {
        "subject": email_subject,
        "text_body": text_body,
        "html_body": html_body,
    }


def send_resolution_email(
    ticket: Dict[str, Any],
    response: Dict[str, Any],
    recipient_email: Optional[str] = None,
    email_config_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Sends an accepted resolution notification email to the ticket requester via SMTP using Django's email infrastructure.
    If SMTP configuration or recipient email is missing, returns UNCONFIGURED status cleanly.
    """
    cfg = email_config_override if email_config_override is not None else get_email_config()

    requester = ticket.get("requester") if isinstance(ticket, dict) else {}
    requester_email = requester.get("email") if isinstance(requester, dict) else None
    target_recipient = recipient_email or requester_email

    if not is_email_configured(cfg) or not target_recipient:
        return {
            "status": "UNCONFIGURED",
            "sent": False,
            "recipient": target_recipient,
            "reason": "SMTP email configuration is missing or recipient email is unconfigured.",
        }

    content = build_resolution_email_content(ticket=ticket, response=response)

    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=cfg.get("smtp_host"),
            port=cfg.get("smtp_port", 587),
            username=cfg.get("smtp_user"),
            password=cfg.get("smtp_password"),
            use_tls=cfg.get("use_tls", True),
            use_ssl=cfg.get("use_ssl", False),
            fail_silently=False,
        )

        msg = EmailMultiAlternatives(
            subject=content["subject"],
            body=content["text_body"],
            from_email=cfg.get("from_email"),
            to=[target_recipient],
            connection=connection,
        )
        msg.attach_alternative(content["html_body"], "text/html")

        sent_count = msg.send(fail_silently=False)

        if sent_count > 0:
            return {
                "status": "SUCCESS",
                "sent": True,
                "recipient": target_recipient,
                "subject": content["subject"],
                "reason": "Resolution notification email sent successfully.",
            }
        else:
            return {
                "status": "FAILED",
                "sent": False,
                "recipient": target_recipient,
                "reason": "Email backend reported zero messages sent.",
            }

    except Exception as e:
        logger.error(f"Failed to send resolution email: {str(e)}")
        return {
            "status": "FAILED",
            "sent": False,
            "recipient": target_recipient,
            "reason": f"SMTP Email connection error: {str(e)}",
        }


def build_not_solved_email_content(
    ticket: Dict[str, Any],
    feedback: Any,
) -> Dict[str, str]:
    """
    Builds subject, plain text, and HTML formatted email body notifying support team
    that the requester reported the provided resolution did not solve the issue.
    """
    ticket_id = (ticket.get("ticket_id") or ticket.get("ticket_number") or "N/A") if isinstance(ticket, dict) else "N/A"
    subject_line = ticket.get("subject", "N/A") if isinstance(ticket, dict) else "N/A"

    if isinstance(feedback, dict):
        comment = (
            feedback.get("comment")
            or feedback.get("feedback_comment")
            or feedback.get("feedback")
            or feedback.get("reason")
            or feedback.get("user_comment")
            or "No feedback comment provided."
        )
    elif isinstance(feedback, str) and feedback.strip():
        comment = feedback.strip()
    else:
        comment = "No feedback comment provided."

    email_subject = f"[Resolution Not Solved] Ticket #{ticket_id}: {subject_line}"

    text_parts = [
        "RESOLUTION NOT SOLVED NOTIFICATION",
        "----------------------------------------",
        f"Ticket ID: {ticket_id}",
        f"Subject: {subject_line}",
        "\nREQUESTER FEEDBACK:",
        f"{comment}",
        "\nNOTICE:",
        "The requester reported that the provided resolution did not solve the issue. Manual follow-up is required.",
    ]
    text_body = "\n".join(text_parts)

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #d9534f;">Resolution Not Solved - Ticket #{ticket_id}</h2>
        <p><strong>Subject:</strong> {subject_line}</p>
        <p>The requester reported that the provided resolution did not solve the issue. Manual follow-up is required.</p>
        
        <h3>Requester Feedback</h3>
        <p style="background: #f8f9fa; padding: 10px; border-left: 4px solid #d9534f;">{comment}</p>
      </body>
    </html>
    """

    return {
        "subject": email_subject,
        "text_body": text_body,
        "html_body": html_body,
    }


def send_not_solved_email(
    ticket: Dict[str, Any],
    feedback: Any,
    recipient_email: Optional[str] = None,
    email_config_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Sends a notification email to the support team when a user reports that a resolution did not solve their issue.
    If SMTP configuration or recipient email is missing, returns UNCONFIGURED status cleanly.
    """
    cfg = email_config_override if email_config_override is not None else get_email_config()

    target_recipient = recipient_email or cfg.get("support_email") or cfg.get("from_email")

    if not is_email_configured(cfg) or not target_recipient:
        return {
            "status": "UNCONFIGURED",
            "sent": False,
            "recipient": target_recipient,
            "reason": "SMTP email configuration is missing or recipient email is unconfigured.",
        }

    content = build_not_solved_email_content(ticket=ticket, feedback=feedback)

    try:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=cfg.get("smtp_host"),
            port=cfg.get("smtp_port", 587),
            username=cfg.get("smtp_user"),
            password=cfg.get("smtp_password"),
            use_tls=cfg.get("use_tls", True),
            use_ssl=cfg.get("use_ssl", False),
            fail_silently=False,
        )

        msg = EmailMultiAlternatives(
            subject=content["subject"],
            body=content["text_body"],
            from_email=cfg.get("from_email"),
            to=[target_recipient],
            connection=connection,
        )
        msg.attach_alternative(content["html_body"], "text/html")

        sent_count = msg.send(fail_silently=False)

        if sent_count > 0:
            return {
                "status": "SUCCESS",
                "sent": True,
                "recipient": target_recipient,
                "subject": content["subject"],
                "reason": "Resolution not solved notification email sent successfully.",
            }
        else:
            return {
                "status": "FAILED",
                "sent": False,
                "recipient": target_recipient,
                "reason": "Email backend reported zero messages sent.",
            }

    except Exception as e:
        logger.error(f"Failed to send resolution not solved email: {str(e)}")
        return {
            "status": "FAILED",
            "sent": False,
            "recipient": target_recipient,
            "reason": f"SMTP Email connection error: {str(e)}",
        }


