import logging
import base64
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_GRAPH_BASE = "https://graph.facebook.com/v25.0"


class MetaAdsClient:
    """
    Wraps Meta Marketing API calls with runtime-supplied credentials.

    Every call goes directly to the Graph API via synchronous ``requests`` calls —
    exactly the same pattern used in facebook.py / crm.py.

    Usage:
        client = MetaAdsClient(
            access_token="EAA...",   # user token with ads_management scope
            ad_account_id="act_1234",
            page_id="796857356850335",
        )
        creative_id = client.create_ad_creative(image_hash, name, page_id, message, ...)
    """

    def __init__(
        self,
        access_token: str,
        ad_account_id: str,
        page_id: str,
        api_version: str = "v25.0",
    ) -> None:
        self.access_token = access_token
        self.ad_account_id = (
            ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"
        )
        self.page_id = page_id
        self.api_version = api_version
        self.graph_base = f"https://graph.facebook.com/{api_version}"

    # ── low-level HTTP ────────────────────────────────────────────────────────

    def _post(self, path: str, payload: dict | None = None, params: dict | None = None) -> dict:
        url = f"{self.graph_base}/{path.lstrip('/')}"
        p = dict(params or {})
        p["access_token"] = self.access_token
        resp = requests.post(url, json=payload, params=p, timeout=30)
        data = resp.json()
        if "error" in data:
            err = data["error"]
            raise RuntimeError(
                f"Graph API POST [{path}] error [{err.get('code', 0)}]: "
                f"{err.get('message', 'unknown')}"
            )
        resp.raise_for_status()
        return data

    def _get(self, path: str, params: dict) -> dict:
        url = f"{self.graph_base}/{path.lstrip('/')}"
        p = dict(params)
        p["access_token"] = self.access_token
        resp = requests.get(url, params=p, timeout=30)
        data = resp.json()
        if "error" in data:
            err = data["error"]
            raise RuntimeError(
                f"Graph API GET [{path}] error [{err.get('code', 0)}]: "
                f"{err.get('message', 'unknown')}"
            )
        resp.raise_for_status()
        return data

    # ── Image upload ──────────────────────────────────────────────────────────

    def upload_ad_image(self, image_bytes: bytes, name: str = "ad_image") -> str:
        """
        Upload image bytes to the ad account image library.
        Returns the image_hash string (e.g. "a1b2c3d4...").
        """
        url = f"{self.graph_base}/{self.ad_account_id}/adimages"
        resp = requests.post(
            url,
            files={"source": (f"{name}.jpg", image_bytes, "image/jpeg")},
            data={"access_token": self.access_token},
            timeout=30,
        )
        data = resp.json()
        if "error" in data:
            raise RuntimeError(
                f"Image upload failed [{data['error'].get('code', 0)}]: "
                f"{data['error'].get('message', 'unknown')}"
            )
        resp.raise_for_status()
        image_hash = data.get("images", {}).get(name, {}).get("hash")
        if not image_hash:
            # Meta may return under a numeric key when multiple images uploaded
            for k, v in data.get("images", {}).items():
                if isinstance(v, dict) and v.get("hash"):
                    image_hash = v["hash"]
                    break
        if not image_hash:
            raise RuntimeError("Image upload succeeded but no image_hash returned.")
        logger.info(f"Uploaded ad image, hash={image_hash}")
        return image_hash

    # ── Creative ──────────────────────────────────────────────────────────────

    def create_ad_creative(
        self,
        image_hash: str,
        name: str,
        page_id: str,
        message: str,
        headline: str | None = None,
        link: str | None = None,
        lead_form_id: str | None = None,
        cta_type: str = "LEARN_MORE",
    ) -> str:
        """
        Create an Ad Creative.
        Returns the creative_id string.
        """
        object_story_spec = {
            "page_id": page_id,
            "link_data": {
                "image_hash": image_hash,
                "message": message,
                "link": link or f"https://www.facebook.com/{page_id}",
                "call_to_action": {"type": cta_type},
            },
        }

        if lead_form_id:
            object_story_spec = {
                "page_id": page_id,
                "lead_gen_form_id": lead_form_id,
                "link_data": {
                    "image_hash": image_hash,
                    "message": message,
                    "call_to_action": {"type": cta_type},
                },
            }

        payload = {
            "name": name,
            "object_story_spec": object_story_spec,
        }

        if headline:
            # DPA-style headline in the link_data
            try:
                payload["object_story_spec"]["link_data"]["name"] = headline
            except KeyError:
                payload["object_story_spec"]["link_data"] = {
                    **payload["object_story_spec"].get("link_data", {}),
                    "name": headline,
                }

        data = self._post(f"/{self.ad_account_id}/adcreatives", payload)
        creative_id = data.get("id")
        if not creative_id:
            raise RuntimeError(f"Creative creation returned no id: {data}")
        logger.info(f"Created ad creative id={creative_id}")
        return creative_id

    # ── Campaign ──────────────────────────────────────────────────────────────

    def create_campaign(
        self,
        name: str,
        objective: str = "OUTCOME_LEADS",
        special_ad_categories: list[str] | None = None,
    ) -> str:
        """
        Create a Campaign in PAUSED status (user must activate manually).
        Returns the campaign_id string.
        """
        payload = {
            "name": name,
            "objective": objective,
            "status": "PAUSED",
        }
        if special_ad_categories:
            payload["special_ad_categories"] = special_ad_categories

        data = self._post(f"/{self.ad_account_id}/campaigns", payload)
        campaign_id = data.get("id")
        if not campaign_id:
            raise RuntimeError(f"Campaign creation returned no id: {data}")
        logger.info(f"Created campaign id={campaign_id} name={name}")
        return campaign_id

    # ── Ad Set ────────────────────────────────────────────────────────────────

    def create_ad_set(
        self,
        campaign_id: str,
        name: str,
        daily_budget_cents: int,
        lifetime_budget_cents: int | None = None,
        targeting: dict | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
        optimization_goal: str = "LEAD_GENERATION",
        billing_event: str = "IMPRESSIONS",
    ) -> str:
        """
        Create an Ad Set tied to the given campaign.
        Returns the adset_id string.
        """
        if daily_budget_cents < 100:
            raise ValueError(f"Daily budget must be at least 100 cents ($1), got {daily_budget_cents}.")

        payload: dict = {
            "name": name,
            "campaign_id": campaign_id,
            "daily_budget": daily_budget_cents,
            "optimization_goal": optimization_goal,
            "billing_event": billing_event,
            "status": "PAUSED",
        }
        if lifetime_budget_cents:
            payload["lifetime_budget"] = lifetime_budget_cents
        if targeting:
            payload["targeting"] = targeting
        if start_time:
            payload["start_time"] = start_time
        if end_time:
            payload["end_time"] = end_time

        data = self._post(f"/{self.ad_account_id}/adsets", payload)
        adset_id = data.get("id")
        if not adset_id:
            raise RuntimeError(f"AdSet creation returned no id: {data}")
        logger.info(f"Created adset id={adset_id} name={name}")
        return adset_id

    # ── Ad ────────────────────────────────────────────────────────────────────

    def create_ad(self, adset_id: str, creative_id: str, name: str) -> str:
        """
        Create an Ad tied to the given Ad Set + Creative.
        Returns the ad_id string.
        """
        payload = {
            "name": name,
            "adset_id": adset_id,
            "creative": {"creative_id": creative_id},
            "status": "PAUSED",
        }
        data = self._post(f"/{self.ad_account_id}/ads", payload)
        ad_id = data.get("id")
        if not ad_id:
            raise RuntimeError(f"Ad creation returned no id: {data}")
        logger.info(f"Created ad id={ad_id} name={name}")
        return ad_id

    # ── Activate / Pause ──────────────────────────────────────────────────────

    def update_ad_status(self, meta_ad_id: str, status: str) -> dict:
        """
        Activate or pause an ad. Valid statuses: ACTIVE, PAUSED.
        Returns the Meta API response dict.
        """
        if status not in ("ACTIVE", "PAUSED"):
            raise ValueError(f"Invalid ad status: {status}")
        data = self._post(f"/{meta_ad_id}", {"status": status})
        return data

    # ── Insights ──────────────────────────────────────────────────────────────

    def fetch_insights(self, meta_ad_id: str, since: str, until: str) -> dict:
        """
        Fetch performance insights for a specific ad.
        since/until: ISO 8601 date strings (e.g. "2025-07-01").
        Returns dict with spend, impressions, clicks, ctr, etc.
        """
        data = self._get(
            f"/{meta_ad_id}/insights",
            {
                "fields": "spend,impressions,clicks,ctr,reach,frequency,cpc,cpm",
                "time_range": f'{{"since":"{since}","until":"{until}"}}',
                "limit": 50,
            },
        )
        return data

    def fetch_adset_insights(self, meta_adset_id: str, since: str, until: str) -> dict:
        """Fetch insights at the ad-set level."""
        data = self._get(
            f"/{meta_adset_id}/insights",
            {
                "fields": "spend,impressions,clicks,ctr,reach,frequency,cpc,cpm",
                "time_range": f'{{"since":"{since}","until":"{until}"}}',
                "limit": 50,
            },
        )
        return data

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def download_image_bytes(image_url: str) -> bytes:
        """Download an image from a public URL or resolve a local /images/ path."""
        if image_url.startswith("data:"):
            header, b64 = image_url.split(",", 1)
            return base64.b64decode(b64)

        if image_url.startswith("http"):
            resp = requests.get(image_url, timeout=20)
            resp.raise_for_status()
            return resp.content

        # Local filesystem path (e.g. "images/poster_abc.jpg")
        import os
        if os.path.exists(image_url):
            with open(image_url, "rb") as fh:
                return fh.read()

        raise FileNotFoundError(f"Cannot resolve image: {image_url}")
