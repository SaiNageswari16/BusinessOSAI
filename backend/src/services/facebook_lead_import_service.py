
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from src.models import (
    Tenant,
    Lead,
)

logger = logging.getLogger(__name__)

# Field-name aliases Facebook commonly uses
_PHONE_KEYS   = ["phone_number", "phone", "mobile", "mobile_number", "contact_number"]
_EMAIL_KEYS   = ["email", "email_address", "work_email", "personal_email"]
_NAME_KEYS    = ["full_name", "name", "first_name", "your_name", "contact_name"]
_FNAME_KEYS   = ["first_name", "fname"]
_LNAME_KEYS   = ["last_name", "lname", "surname"]


def _pick(field_map: dict, keys: list) -> str:
    for k in keys:
        v = field_map.get(k, "").strip()
        if v:
            return v
    return ""


def _flatten_fb_lead(raw: dict, form_id: str = "") -> dict:
    field_map: dict = {"form_id": form_id}
    for field in raw.get("field_data", []):
        values = field.get("values", [])
        field_map[field["name"]] = values[0].strip() if values else ""
    field_map["fb_lead_id"]    = raw.get("id", "")
    field_map["created_time"]  = raw.get("created_time", "")
    field_map["ad_id"]         = raw.get("ad_id", "")
    field_map["adset_id"]      = raw.get("adset_id", "")
    field_map["campaign_id"]   = raw.get("campaign_id", "")
    field_map["form_id"]       = raw.get("form_id", "")
    return field_map


def _extract_name(field_map: dict, fb_lead_id: str) -> str:
    name = _pick(field_map, _NAME_KEYS)
    if name:
        return name
    fname = _pick(field_map, _FNAME_KEYS)
    lname = _pick(field_map, _LNAME_KEYS)
    if fname or lname:
        return f"{fname} {lname}".strip()
    return f"FB Lead #{fb_lead_id}"


class FacebookLeadImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_credentials(
        self,
        tenant_id: UUID,
        fb_access_token: str,
        fb_page_or_form_id: str,
        fb_api_version: str = "v25.0",
    ) -> dict:
        tenant = await self.db.scalar(select(Tenant).where(Tenant.id == tenant_id))
        if not tenant:
            raise ValueError("Tenant not found")

        current_settings = tenant.settings or {}
        current_settings["facebook"] = {
            "fb_access_token":    fb_access_token,
            "fb_page_or_form_id": fb_page_or_form_id,
            "fb_api_version":     fb_api_version,
        }
        tenant.settings = current_settings
        flag_modified(tenant, "settings")
        await self.db.commit()

        logger.info(f"[Tenant {tenant_id}] Facebook credentials saved.")
        return {
            "fb_page_or_form_id": fb_page_or_form_id,
            "fb_api_version":     fb_api_version,
            "has_token":          bool(fb_access_token),
        }

    async def get_credentials(self, tenant_id: UUID) -> Optional[dict]:
        tenant = await self.db.scalar(select(Tenant).where(Tenant.id == tenant_id))
        if not tenant:
            raise ValueError("Tenant not found")

        return (tenant.settings or {}).get("facebook")

    async def delete_credentials(self, tenant_id: UUID) -> bool:
        tenant = await self.db.scalar(select(Tenant).where(Tenant.id == tenant_id))
        if not tenant:
            raise ValueError("Tenant not found")

        settings = tenant.settings or {}
        if "facebook" not in settings:
            return False

        del settings["facebook"]
        tenant.settings = settings
        flag_modified(tenant, "settings")
        await self.db.commit()
        logger.info(f"[Tenant {tenant_id}] Facebook credentials deleted.")
        return True

    async def import_leads(
        self,
        tenant_id: UUID,
        imported_by: UUID,
    ) -> dict:
        fb_cfg = await self.get_credentials(tenant_id)
        if not fb_cfg:
            raise ValueError(
                "Facebook credentials are not configured for this organization. "
                "Please save your credentials first."
            )

        access_token    = fb_cfg.get("fb_access_token", "")
        page_or_form_id = fb_cfg.get("fb_page_or_form_id", "")
        api_version     = fb_cfg.get("fb_api_version", "v25.0")

        if not access_token or not page_or_form_id:
            raise ValueError(
                "Incomplete Facebook credentials — access token and page/form ID are required."
            )

        from src.services.facebook import FacebookClient

        client = FacebookClient(
            access_token=access_token,
            page_or_form_id=page_or_form_id,
            api_version=api_version,
        )

        logger.info(f"[Tenant {tenant_id}] Starting Facebook lead fetch ...")
        # Since calls are synchronous, run in executor to keep event loop free
        import anyio
        form_leads_pairs = await anyio.to_thread.run_sync(client.fetch_all_leads)

        total_fetched = sum(len(leads) for _, leads in form_leads_pairs)
        logger.info(f"[Tenant {tenant_id}] Fetched {total_fetched} leads from Facebook.")

        imported_count = 0
        skipped_count  = 0
        errors         = []

        for form_id, raw_leads in form_leads_pairs:
            for raw_lead in raw_leads:
                try:
                    field_map   = _flatten_fb_lead(raw_lead, form_id)
                    fb_lead_id  = field_map.get("fb_lead_id", "")

                    if not fb_lead_id:
                        skipped_count += 1
                        continue

                    # Deduplication check
                    exists = await self.db.scalar(
                        select(Lead.id)
                        .where(
                            Lead.external_id     == fb_lead_id,
                            Lead.external_source == "facebook",
                            Lead.tenant_id       == tenant_id,
                        )
                    )
                    if exists:
                        skipped_count += 1
                        continue

                    # Build lead fields
                    name  = _extract_name(field_map, fb_lead_id)
                    phone = _pick(field_map, _PHONE_KEYS) or "0000000000"
                    email = _pick(field_map, _EMAIL_KEYS) or None

                    created_at_fb: Optional[datetime] = None
                    if field_map.get("created_time"):
                        try:
                            created_at_fb = datetime.fromisoformat(
                                field_map["created_time"].replace("Z", "+00:00")
                            )
                        except ValueError:
                            pass

                    meta_payload = {k: v for k, v in field_map.items()
                                    if k not in ("fb_lead_id",)}

                    lead = Lead(
                        name            = name,
                        phone           = phone,
                        email           = email,
                        source          = "Social Media",
                        status          = "New",
                        tenant_id       = tenant_id,
                        owner_user_id  = imported_by,
                        external_id     = fb_lead_id,
                        external_source = "facebook",
                        meta            = meta_payload,
                    )
                    self.db.add(lead)
                    imported_count += 1

                except Exception as exc:
                    logger.warning(f"[Tenant {tenant_id}] Failed to process FB lead: {exc}")
                    errors.append(str(exc))
                    skipped_count += 1

        await self.db.commit()

        result = {
            "imported": imported_count,
            "skipped":  skipped_count,
            "total":    total_fetched,
            "errors":   errors[:10],
            "message":  (
                f"Successfully imported {imported_count} new leads. "
                f"{skipped_count} leads were skipped (duplicates or errors)."
            ),
        }
        logger.info(f"[Tenant {tenant_id}] Import complete: {result['message']}")
        return result
