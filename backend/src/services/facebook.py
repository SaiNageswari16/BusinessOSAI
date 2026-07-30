import logging
import requests

logger = logging.getLogger(__name__)

class FacebookClient:
    """
    Wraps the Graph API calls with runtime-supplied credentials.

    Unlike module-level globals, this class accepts credentials at
    construction so each tenant can have its own isolated client.

    Usage:
        client = FacebookClient(
            access_token="EAA...",
            page_or_form_id="796857356850335",
            api_version="v25.0",
        )
        results = client.fetch_all_leads()   # list[(form_id, [raw_leads])]
    """

    def __init__(
        self,
        access_token: str,
        page_or_form_id: str,
        api_version: str = "v25.0",
    ) -> None:
        self.access_token     = access_token
        self.page_or_form_id  = page_or_form_id
        self.api_version      = api_version
        self.graph_base       = f"https://graph.facebook.com/{api_version}"
        self._page_token_cache: dict[str, str] = {}

    # ── low-level HTTP ────────────────────────────────────────────────────────

    def _graph_get(self, path: str, params: dict) -> dict:
        url      = f"{self.graph_base}/{path}"
        response = requests.get(url, params=params, timeout=30)
        try:
            data = response.json()
        except ValueError:
            logger.error(f"❌ HTTP {response.status_code}: {response.text}")
            response.raise_for_status()
            return {}

        if "error" in data:
            err  = data["error"]
            code = err.get("code", 0)
            msg  = err.get("message", "unknown error")
            logger.error(f"❌ HTTP {response.status_code} / FB code {code}: {msg}")
            raise RuntimeError(
                f"Graph API error [{code} / {err.get('error_subcode', '-')}]: "
                f"{msg}"
            )

        if not response.ok:
            logger.error(f"❌ HTTP {response.status_code}: {response.text}")
            response.raise_for_status()

        return data

    # ── page token exchange ───────────────────────────────────────────────────

    def _get_page_token(self, page_id: str) -> str:
        if page_id in self._page_token_cache:
            return self._page_token_cache[page_id]

        logger.info(f"🔑 Getting page token for page {page_id} ...")

        # Method 1: /me/accounts
        try:
            data  = self._graph_get(
                "me/accounts",
                {"access_token": self.access_token, "fields": "id,name,access_token", "limit": 100},
            )
            for pg in data.get("data", []):
                self._page_token_cache[pg["id"]] = pg["access_token"]
            if page_id in self._page_token_cache:
                return self._page_token_cache[page_id]
        except RuntimeError:
            pass

        # Method 2: direct fetch
        try:
            obj = self._graph_get(
                page_id,
                {"access_token": self.access_token, "fields": "id,name,access_token"},
            )
            page_token = obj.get("access_token")
            if page_token:
                self._page_token_cache[page_id] = page_token
                return page_token
        except RuntimeError:
            pass

        # Fallback: use token as-is
        return self.access_token

    # ── form discovery ────────────────────────────────────────────────────────

    def _list_forms_on_page(self, page_id: str) -> list[dict]:
        page_token = self._get_page_token(page_id)
        forms: list[dict] = []
        params = {
            "access_token": page_token,
            "fields": "id,name,status,leads_count",
            "limit": 50,
        }
        while True:
            data  = self._graph_get(f"{page_id}/leadgen_forms", params)
            batch = data.get("data", [])
            forms.extend(batch)
            paging = data.get("paging", {})
            after  = paging.get("cursors", {}).get("after")
            if after and paging.get("next"):
                params = {**params, "after": after}
            else:
                break
        return forms

    def _list_forms_from_ad_account(self, act_id: str) -> list[dict]:
        forms: list[dict] = []
        params = {
            "access_token": self.access_token,
            "fields": "id,name,status,leads_count",
            "limit": 50,
        }
        while True:
            data  = self._graph_get(f"{act_id}/leadgen_forms", params)
            batch = data.get("data", [])
            forms.extend(batch)
            paging = data.get("paging", {})
            after  = paging.get("cursors", {}).get("after")
            if after and paging.get("next"):
                params = {**params, "after": after}
            else:
                break
        return forms

    # ── lead fetching ─────────────────────────────────────────────────────────

    def _fetch_leads_from_form(self, form_id: str) -> list[dict]:
        page_token = self._get_page_token(self.page_or_form_id)
        leads: list[dict] = []
        params = {
            "access_token": page_token,
            "fields": "id,created_time,field_data,ad_id,adset_id,campaign_id,form_id",
            "limit": 100,
        }
        while True:
            data  = self._graph_get(f"{form_id}/leads", params)
            batch = data.get("data", [])
            leads.extend(batch)
            paging = data.get("paging", {})
            after  = paging.get("cursors", {}).get("after")
            if after and paging.get("next"):
                params = {**params, "after": after}
            else:
                break
        return leads

    def _fetch_from_forms(self, forms: list[dict]) -> list[tuple[str, list[dict]]]:
        results: list[tuple[str, list[dict]]] = []
        for form in forms:
            form_id = form["id"]
            try:
                leads = self._fetch_leads_from_form(form_id)
                results.append((form_id, leads))
            except RuntimeError as exc:
                logger.error(f"   ❌ Skipping form {form_id}: {exc}")
        return results

    # ── public API ────────────────────────────────────────────────────────────

    def fetch_all_leads(self) -> list[tuple[str, list[dict]]]:
        target = self.page_or_form_id.strip()

        # Ad Account
        if target.startswith("act_"):
            forms = self._list_forms_from_ad_account(target)
            if not forms:
                return []
            return self._fetch_from_forms(forms)

        # Try as Form ID directly
        logger.info(f"🔍 Trying '{target}' as a Form ID ...")
        try:
            leads = self._fetch_leads_from_form(target)
            logger.info(f"✅ Fetched {len(leads)} leads from form {target}.")
            return [(target, leads)]
        except RuntimeError as exc:
            err_str = str(exc)
            is_code_100 = "[100 /" in err_str or "[100]" in err_str or "code 100" in err_str
            mentions_leads = "leads" in err_str.lower() or "nonexisting field" in err_str.lower()
            if not (is_code_100 or mentions_leads):
                raise

        # Fall through to Page ID
        logger.info(f"↪️  Treating '{target}' as a Page ID ...")
        forms = self._list_forms_on_page(target)
        if not forms:
            return []
        return self._fetch_from_forms(forms)
