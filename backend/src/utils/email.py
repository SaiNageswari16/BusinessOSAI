import asyncio
import logging
import smtplib
import socket
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


@dataclass
class EmailConfig:
    mail_server: str
    mail_port: int = 587
    mail_username: str | None = None
    mail_password: str | None = None
    mail_from: str = "noreply@businessos.ai"
    sender_name: str | None = "BusinessOS AI"
    use_tls: bool = True
    use_ssl: bool = False
    reply_to: str | None = None
    enabled: bool = True


async def resolve_email_config(
    db: AsyncSession | None = None,
    tenant_id: uuid.UUID | str | None = None,
    company_id: uuid.UUID | str | None = None,
    custom_config: dict | None = None,
) -> EmailConfig:
    """
    Resolves the applicable SMTP configuration following hierarchy:
    1. Direct custom_config dictionary (if passed, e.g. for connection testing).
    2. Company-specific email_settings (if company_id is provided and enabled).
    3. Tenant-level email_settings or first active Company with configured SMTP.
    4. Default server credentials from environment variables (.env).
    """
    # 1. Direct explicit configuration
    if custom_config:
        return EmailConfig(
            mail_server=str(custom_config.get("mail_server") or "").strip(),
            mail_port=int(custom_config.get("mail_port") or 587),
            mail_username=str(custom_config.get("mail_username") or "").strip() or None,
            mail_password=str(custom_config.get("mail_password") or "").strip() or None,
            mail_from=str(custom_config.get("mail_from") or custom_config.get("mail_username") or "noreply@businessos.ai").strip(),
            sender_name=str(custom_config.get("sender_name") or "").strip() or None,
            use_tls=bool(custom_config.get("use_tls", True)),
            use_ssl=bool(custom_config.get("use_ssl", False)),
            reply_to=str(custom_config.get("reply_to") or "").strip() or None,
            enabled=bool(custom_config.get("enabled", True)),
        )

    # 2. Company-specific configuration
    if db and company_id:
        try:
            from src.models import Company
            c_uuid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
            company = await db.get(Company, c_uuid)
            if company and company.email_settings and isinstance(company.email_settings, dict):
                cfg = company.email_settings
                if cfg.get("enabled", True) and cfg.get("mail_server"):
                    return EmailConfig(
                        mail_server=str(cfg.get("mail_server")).strip(),
                        mail_port=int(cfg.get("mail_port") or 587),
                        mail_username=str(cfg.get("mail_username") or "").strip() or None,
                        mail_password=str(cfg.get("mail_password") or "").strip() or None,
                        mail_from=str(cfg.get("mail_from") or cfg.get("mail_username") or company.email or "noreply@businessos.ai").strip(),
                        sender_name=str(cfg.get("sender_name") or company.name).strip() or None,
                        use_tls=bool(cfg.get("use_tls", True)),
                        use_ssl=bool(cfg.get("use_ssl", False)),
                        reply_to=str(cfg.get("reply_to") or company.email or "").strip() or None,
                        enabled=True,
                    )
        except Exception as e:
            logger.warning(f"Error resolving company email config: {e}")

    # 3. Tenant-level configuration or tenant primary company
    if db and tenant_id:
        try:
            from src.models import Tenant, Company
            t_uuid = uuid.UUID(str(tenant_id)) if not isinstance(tenant_id, uuid.UUID) else tenant_id
            
            # Check tenant.settings["email_settings"]
            tenant = await db.scalar(select(Tenant).where(Tenant.id == t_uuid))
            if tenant and tenant.settings and isinstance(tenant.settings, dict):
                t_cfg = tenant.settings.get("email_settings")
                if isinstance(t_cfg, dict) and t_cfg.get("enabled", True) and t_cfg.get("mail_server"):
                    return EmailConfig(
                        mail_server=str(t_cfg.get("mail_server")).strip(),
                        mail_port=int(t_cfg.get("mail_port") or 587),
                        mail_username=str(t_cfg.get("mail_username") or "").strip() or None,
                        mail_password=str(t_cfg.get("mail_password") or "").strip() or None,
                        mail_from=str(t_cfg.get("mail_from") or t_cfg.get("mail_username") or "noreply@businessos.ai").strip(),
                        sender_name=str(t_cfg.get("sender_name") or tenant.name).strip() or None,
                        use_tls=bool(t_cfg.get("use_tls", True)),
                        use_ssl=bool(t_cfg.get("use_ssl", False)),
                        reply_to=str(t_cfg.get("reply_to") or "").strip() or None,
                        enabled=True,
                    )

            # Check primary active company under this tenant
            comp_stmt = (
                select(Company)
                .where(Company.tenant_id == t_uuid, Company.status == "active")
                .order_by(Company.created_at.asc())
            )
            comps = (await db.execute(comp_stmt)).scalars().all()
            for comp in comps:
                if comp.email_settings and isinstance(comp.email_settings, dict):
                    cfg = comp.email_settings
                    if cfg.get("enabled", True) and cfg.get("mail_server"):
                        return EmailConfig(
                            mail_server=str(cfg.get("mail_server")).strip(),
                            mail_port=int(cfg.get("mail_port") or 587),
                            mail_username=str(cfg.get("mail_username") or "").strip() or None,
                            mail_password=str(cfg.get("mail_password") or "").strip() or None,
                            mail_from=str(cfg.get("mail_from") or cfg.get("mail_username") or comp.email or "noreply@businessos.ai").strip(),
                            sender_name=str(cfg.get("sender_name") or comp.name).strip() or None,
                            use_tls=bool(cfg.get("use_tls", True)),
                            use_ssl=bool(cfg.get("use_ssl", False)),
                            reply_to=str(cfg.get("reply_to") or comp.email or "").strip() or None,
                            enabled=True,
                        )
        except Exception as e:
            logger.warning(f"Error resolving tenant email config: {e}")

    # 4. Fallback to system .env configuration
    env_server = getattr(settings, "mail_server", None) or ""
    env_port = getattr(settings, "mail_port", None) or 587
    env_user = getattr(settings, "mail_username", None) or ""
    env_pwd = getattr(settings, "mail_password", None) or ""
    env_from = getattr(settings, "mail_from", None) or env_user or "recruitment@businessos.ai"

    return EmailConfig(
        mail_server=str(env_server).strip(),
        mail_port=int(env_port) if env_port else 587,
        mail_username=str(env_user).strip() or None,
        mail_password=str(env_pwd).strip() or None,
        mail_from=str(env_from).strip(),
        sender_name="BusinessOS Global",
        use_tls=True,
        use_ssl=False,
        enabled=bool(env_server),
    )


def _send_sync(
    config: EmailConfig,
    to_emails: list[str],
    subject: str,
    body_text: str,
    html_body: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
) -> None:
    """Executes the synchronous SMTP connection, TLS handshake, and dispatch."""
    if not config.mail_server:
        raise RuntimeError("No SMTP server configured. Dispatch cannot be completed.")

    # Format From header with friendly display name if available
    from_header = config.mail_from
    if config.sender_name and "<" not in config.mail_from:
        from_header = f'"{config.sender_name}" <{config.mail_from}>'

    if attachment_bytes and attachment_filename:
        msg = MIMEMultipart("mixed")
        msg["From"] = from_header
        msg["To"] = ", ".join(to_emails)
        msg["Subject"] = subject
        if config.reply_to:
            msg["Reply-To"] = config.reply_to

        alt_part = MIMEMultipart("alternative")
        alt_part.attach(MIMEText(body_text or "", "plain"))
        if html_body:
            alt_part.attach(MIMEText(html_body, "html"))
        msg.attach(alt_part)

        pdf_part = MIMEApplication(attachment_bytes, _subtype="pdf")
        pdf_part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
        msg.attach(pdf_part)
    else:
        msg = MIMEMultipart("alternative")
        msg["From"] = from_header
        msg["To"] = ", ".join(to_emails)
        msg["Subject"] = subject
        if config.reply_to:
            msg["Reply-To"] = config.reply_to

        msg.attach(MIMEText(body_text or "", "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))

    # Establish connection (SSL vs STARTTLS)
    if config.use_ssl:
        server = smtplib.SMTP_SSL(config.mail_server, int(config.mail_port), timeout=15)
    else:
        server = smtplib.SMTP(config.mail_server, int(config.mail_port), timeout=15)
        server.ehlo()
        if config.use_tls:
            server.starttls()
            server.ehlo()

    if config.mail_username and config.mail_password:
        server.login(config.mail_username, config.mail_password)

    server.send_message(msg)
    server.quit()


async def send_email(
    subject: str,
    recipients: Iterable[str] | str,
    html: str | None = None,
    text: str | None = None,
    sender: str | None = None,
    company_id: uuid.UUID | str | None = None,
    tenant_id: uuid.UUID | str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
    db: AsyncSession | None = None,
    custom_config: dict | None = None,
) -> bool:
    """
    Dispatches an email utilizing the appropriate organization/company SMTP credentials.
    Supports attachments, HTML, and rich sender names.
    """
    if isinstance(recipients, str):
        to_list = [r.strip() for r in recipients.split(",") if r.strip()]
    else:
        to_list = [str(r).strip() for r in recipients if str(r).strip()]

    if not to_list:
        logger.warning("send_email called with empty recipient list.")
        return False

    config = await resolve_email_config(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        custom_config=custom_config,
    )

    if sender:
        config.mail_from = sender

    if not config.mail_server or not config.enabled:
        print(f"\n=================== REALTIME SMTP DISPATCH (FALLBACK / LOG ONLY) ===================")
        print(f"FROM: {config.mail_from} ({config.sender_name})")
        print(f"TO: {', '.join(to_list)}")
        print(f"SUBJECT: {subject}")
        if attachment_filename:
            print(f"ATTACHMENT: {attachment_filename} ({len(attachment_bytes or b'')} bytes)")
        print(f"BODY:\n{(text or html or '')[:300]}...")
        print(f"====================================================================================\n")
        return True

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None,
            _send_sync,
            config,
            to_list,
            subject,
            text or "",
            html,
            attachment_bytes,
            attachment_filename,
        )
        logger.info(f"[SMTP SUCCESS] Dispatched email '{subject}' to {to_list} via {config.mail_server} ({config.mail_from})")
        print(f"[SMTP SUCCESS] Successfully sent email to {', '.join(to_list)} using organization credentials ({config.mail_from})")
        return True
    except Exception as e:
        logger.exception(f"[SMTP ERROR] Failed sending email to {to_list} via {config.mail_server}: {e}")
        print(f"[SMTP ERROR] Failed sending email to {', '.join(to_list)}: {e}")
        return False


def test_smtp_connection_sync(config_dict: dict, recipient_email: str) -> dict:
    """Synchronous test of SMTP handshake, authentication, and test message dispatch."""
    server_host = str(config_dict.get("mail_server") or "").strip()
    port = int(config_dict.get("mail_port") or 587)
    username = str(config_dict.get("mail_username") or "").strip()
    password = str(config_dict.get("mail_password") or "").strip()
    mail_from = str(config_dict.get("mail_from") or username or "test@businessos.ai").strip()
    sender_name = str(config_dict.get("sender_name") or "BusinessOS SMTP Test").strip()
    use_tls = bool(config_dict.get("use_tls", True))
    use_ssl = bool(config_dict.get("use_ssl", False))

    if not server_host:
        return {"success": False, "error": "SMTP server host is required."}

    from_header = f'"{sender_name}" <{mail_from}>' if "<" not in mail_from else mail_from

    msg = MIMEMultipart("alternative")
    msg["From"] = from_header
    msg["To"] = recipient_email
    msg["Subject"] = f"✅ Verified: Organization SMTP Active for {sender_name}"

    plain_text = (
        f"Hello,\n\n"
        f"This is a verified test email confirming that your organization's custom SMTP server "
        f"({server_host}:{port}) is successfully connected and authenticated.\n\n"
        f"Sender: {from_header}\n"
        f"Timestamp: UTC Live Verification\n\n"
        f"BusinessOS Multi-Tenant Email Service"
    )

    html_text = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">✅ SMTP Connection Successful</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.85; font-size: 13px;">Organization Custom Outgoing Mail Verified</p>
        </div>
        <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
          <p>Your custom SMTP server configuration has been validated and is ready for production dispatch.</p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px;">
            <div><strong>SMTP Host:</strong> {server_host}:{port}</div>
            <div><strong>Sender Address:</strong> {from_header}</div>
            <div><strong>Security:</strong> {"SSL/TLS" if use_ssl else ("STARTTLS" if use_tls else "Plain")}</div>
            <div><strong>Recipient:</strong> {recipient_email}</div>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">All official communications (offer letters, invoices, quotations) from this company will now be dispatched from this verified account.</p>
        </div>
      </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_text, "html"))

    try:
        if use_ssl:
            server = smtplib.SMTP_SSL(server_host, port, timeout=12)
        else:
            server = smtplib.SMTP(server_host, port, timeout=12)
            server.ehlo()
            if use_tls:
                server.starttls()
                server.ehlo()

        if username and password:
            server.login(username, password)

        server.send_message(msg)
        server.quit()
        return {
            "success": True,
            "message": f"Successfully connected to '{server_host}' and delivered test email to '{recipient_email}'.",
        }
    except smtplib.SMTPAuthenticationError as e:
        return {"success": False, "error": f"SMTP Authentication failed (check username and app password): {e.smtp_error.decode(errors='ignore') if hasattr(e, 'smtp_error') else str(e)}"}
    except (smtplib.SMTPConnectError, socket.timeout, TimeoutError) as e:
        return {"success": False, "error": f"Connection timed out or failed to reach {server_host}:{port}. Check host, port, and firewall rules."}
    except Exception as e:
        return {"success": False, "error": f"SMTP dispatch failed: {str(e)}"}


async def test_smtp_connection(config_dict: dict, recipient_email: str) -> dict:
    """Asynchronous wrapper for test_smtp_connection_sync."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, test_smtp_connection_sync, config_dict, recipient_email)