import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
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
    message["From"] = formataddr(("Type Club", settings.smtp_from))
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(html, "html", "utf-8"))

    # TLS mode:
    #   - implicit TLS  -> port 465  (use_tls=True)
    #   - STARTTLS      -> port 587/2525 (start_tls=True)
    # Passing both to aiosmtplib is an error, so pick one explicitly.
    tls_kwargs: dict = {}
    if settings.smtp_use_tls and not settings.smtp_start_tls:
        tls_kwargs["use_tls"] = True
    elif settings.smtp_start_tls:
        tls_kwargs["use_tls"] = False
        tls_kwargs["start_tls"] = True

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_pass or None,
            timeout=30,
            **tls_kwargs,
        )
        logger.info("Email sent to %s", to)
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        raise


async def send_verification_email(to: str, nickname: str, code: str) -> None:
    html = _render("verify_email.html", nickname=nickname, code=code)
    await send_email(to, f"Код подтверждения Type Club: {code}", html)


async def send_reset_password_email(to: str, nickname: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    html = _render("reset_password.html", nickname=nickname, link=link)
    await send_email(to, "Reset your password — Type Club", html)
