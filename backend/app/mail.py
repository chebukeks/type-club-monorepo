import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader

from app.config import settings

logger = logging.getLogger(__name__)

_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parent / "templates"),
    autoescape=True,
)


def _render(template_name: str, **kwargs) -> str:
    return _templates.get_template(template_name).render(**kwargs)


async def send_email(to: str, subject: str, html: str) -> None:
    message = MIMEMultipart("alternative")
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_pass,
            use_tls=settings.smtp_use_tls,
        )
        logger.info("Email sent to %s", to)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        raise


async def send_verification_email(to: str, nickname: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    html = _render("verify_email.html", nickname=nickname, link=link)
    await send_email(to, "Verify your email — Type Club", html)


async def send_reset_password_email(to: str, nickname: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    html = _render("reset_password.html", nickname=nickname, link=link)
    await send_email(to, "Reset your password — Type Club", html)
