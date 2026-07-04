import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Iterable

from src.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _build_message(subject: str, recipients: Iterable[str], html: str | None = None, text: str | None = None, sender: str | None = None) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender or settings.mail_from or settings.mail_username
    msg["To"] = ", ".join(recipients)
    if html and text:
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
    elif html:
        msg.add_alternative(html, subtype="html")
    else:
        msg.set_content(text or "")
    return msg


def _send_sync(msg: EmailMessage) -> None:
    server = settings.mail_server
    port = settings.mail_port
    username = settings.mail_username
    password = settings.mail_password
    if not server or not port:
        raise RuntimeError("SMTP server configuration is missing")

    with smtplib.SMTP(server, int(port), timeout=10) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(msg)


async def send_email(subject: str, recipients: Iterable[str], html: str | None = None, text: str | None = None, sender: str | None = None) -> None:
    msg = _build_message(subject, recipients, html=html, text=text, sender=sender)
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _send_sync, msg)
    except Exception:
        logger.exception("Failed to send email")