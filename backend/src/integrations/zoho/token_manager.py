import base64
import hashlib
from datetime import datetime, timezone, timedelta
import uuid
from typing import Optional
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import OrganizationIntegration
from src.integrations.zoho.exceptions import ZohoOAuthException
import requests

settings = get_settings()

def _get_fernet() -> Fernet:
    # Derive a valid 32-byte key from our application SECRET_KEY
    key_bytes = hashlib.sha256(settings.secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)

def encrypt_token(token: str) -> str:
    if not token:
        return ""
    fernet = _get_fernet()
    return fernet.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return ""
    fernet = _get_fernet()
    return fernet.decrypt(encrypted_token.encode()).decode()


class ZohoTokenManager:
    @staticmethod
    async def get_integration(db: AsyncSession, organization_id: uuid.UUID) -> Optional[OrganizationIntegration]:
        stmt = select(OrganizationIntegration).where(
            OrganizationIntegration.organization_id == organization_id,
            OrganizationIntegration.provider == "zoho"
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def get_access_token(cls, db: AsyncSession, organization_id: uuid.UUID) -> str:
        """
        Retrieves a valid, decrypted access token.
        Automatically triggers a token refresh if the access token has expired or is about to expire.
        """
        integration = await cls.get_integration(db, organization_id)
        if not integration or not integration.connected:
            raise ZohoOAuthException("Zoho Recruit is not connected for this organization.")

        # Check if expired (or within 5 minutes of expiry)
        now = datetime.now(timezone.utc)
        if (
            not integration.access_token
            or not integration.token_expiry
            or integration.token_expiry <= now + timedelta(minutes=5)
        ):
            # Needs refresh
            return await cls.refresh_access_token(db, organization_id)

        try:
            return decrypt_token(integration.access_token)
        except Exception as e:
            raise ZohoOAuthException(f"Failed to decrypt Zoho access token: {e}")

    @classmethod
    async def refresh_access_token(cls, db: AsyncSession, organization_id: uuid.UUID) -> str:
        """
        Uses the refresh token to request a new access token from Zoho,
        saves the encrypted token to the DB, and returns the decrypted access token.
        """
        integration = await cls.get_integration(db, organization_id)
        if not integration or not integration.refresh_token:
            raise ZohoOAuthException("No refresh token found. Re-authorization required.")

        try:
            refresh_token_dec = decrypt_token(integration.refresh_token)
        except Exception as e:
            raise ZohoOAuthException(f"Failed to decrypt Zoho refresh token: {e}")

        # Determine region domain
        region = settings.zoho_region.upper()
        # Fallback to config keys
        zoho_region_domains = {
            "US": "accounts.zoho.com",
            "EU": "accounts.zoho.eu",
            "IN": "accounts.zoho.in",
            "AU": "accounts.zoho.com.au",
            "CN": "accounts.zoho.com.cn",
            "JP": "accounts.zoho.jp",
        }
        domain = zoho_region_domains.get(region, "accounts.zoho.com")

        # Call Zoho refresh endpoint
        url = f"https://{domain}/oauth/v2/token"
        payload = {
            "refresh_token": refresh_token_dec,
            "client_id": settings.zoho_client_id,
            "client_secret": settings.zoho_client_secret,
            "grant_type": "refresh_token",
        }

        try:
            res = requests.post(url, data=payload, timeout=15)
            if res.status_code != 200:
                raise ZohoOAuthException(f"Zoho token refresh failed with code {res.status_code}: {res.text}")
            
            data = res.json()
            if "error" in data:
                raise ZohoOAuthException(f"Zoho token refresh API error: {data.get('error')}")

            access_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)  # in seconds
            expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            # Store encrypted
            integration.access_token = encrypt_token(access_token)
            integration.token_expiry = expiry
            if "api_domain" in data:
                integration.api_domain = data["api_domain"]

            await db.commit()
            return access_token
        except Exception as e:
            if not isinstance(e, ZohoOAuthException):
                raise ZohoOAuthException(f"Zoho token refresh request failed: {e}")
            raise

    @classmethod
    async def store_tokens(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        access_token: str,
        refresh_token: str,
        expires_in: int,
        api_domain: str,
        organization_name: Optional[str] = None
    ) -> None:
        """Stores new credentials securely in the database."""
        expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        enc_access = encrypt_token(access_token)
        enc_refresh = encrypt_token(refresh_token)

        integration = await cls.get_integration(db, organization_id)
        if not integration:
            integration = OrganizationIntegration(
                organization_id=organization_id,
                provider="zoho",
                connected=True,
                connected_at=datetime.now(timezone.utc)
            )
            db.add(integration)

        integration.access_token = enc_access
        integration.refresh_token = enc_refresh
        integration.token_expiry = expiry
        integration.api_domain = api_domain
        integration.connected = True
        integration.connected_at = datetime.now(timezone.utc)
        if organization_name:
            integration.organization_name = organization_name

        await db.commit()
