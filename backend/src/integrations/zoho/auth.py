from datetime import datetime, timedelta, timezone
import uuid
from jose import jwt, JWTError
from src.config import get_settings
from src.integrations.zoho.exceptions import ZohoOAuthException

settings = get_settings()

ALGORITHM = "HS256"

def generate_state(organization_id: uuid.UUID) -> str:
    """
    Generates a signed, tamper-proof state parameter containing
    the organization ID and an expiration timestamp (15 minutes).
    Acts as a lightweight CSRF token.
    """
    payload = {
        "org_id": str(organization_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)

def verify_state(signed_state: str) -> uuid.UUID:
    """
    Verifies the signature and expiration of the state parameter.
    Returns the validated organization_id.
    """
    try:
        payload = jwt.decode(signed_state, settings.secret_key, algorithms=[ALGORITHM])
        org_id_str = payload.get("org_id")
        if not org_id_str:
            raise ZohoOAuthException("Invalid state payload: missing org_id.")
        return uuid.UUID(org_id_str)
    except JWTError as e:
        raise ZohoOAuthException(f"OAuth State verification failed (possible CSRF or expired request): {e}")
    except ValueError:
        raise ZohoOAuthException("Invalid organization ID format in state parameter.")
