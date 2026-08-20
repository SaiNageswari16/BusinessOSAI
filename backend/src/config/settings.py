import os
from dotenv import load_dotenv
load_dotenv(override=True)

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = Field(default="BusinessOS AI", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")

    # PostgreSQL
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_user: str = Field(default="businessos_admin", alias="POSTGRES_USER")
    postgres_password: str = Field(default="", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="businessos_core_erp", alias="POSTGRES_DB")
    postgres_schema: str = Field(default="public", alias="POSTGRES_SCHEMA")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    # Security
    secret_key: str = Field(alias="SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:8080,http://127.0.0.1:8080",
        alias="CORS_ORIGINS",
    )

    # Multi-tenant
    default_tenant_plan: str = Field(default="starter", alias="DEFAULT_TENANT_PLAN")
    max_login_attempts: int = Field(default=5, alias="MAX_LOGIN_ATTEMPTS")
    lockout_minutes: int = Field(default=15, alias="LOCKOUT_MINUTES")

    # Bootstrap
    auto_create_tables: bool = Field(default=True, alias="AUTO_CREATE_TABLES")
    seed_default_permissions: bool = Field(default=True, alias="SEED_DEFAULT_PERMISSIONS")

    # Email / SMTP
    mail_server: str | None = Field(default=None, alias="MAIL_SERVER")
    mail_port: int | None = Field(default=None, alias="MAIL_PORT")
    mail_username: str | None = Field(default=None, alias="MAIL_USERNAME")
    mail_password: str | None = Field(default=None, alias="MAIL_PASSWORD")
    mail_from: str | None = Field(default=None, alias="MAIL_FROM")

    # OAuth (Google)
    google_client_id: str | None = Field(default=None, alias="GOOGLE_CLIENT_ID")
    google_client_secret: str | None = Field(default=None, alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str | None = Field(default=None, alias="GOOGLE_REDIRECT_URI")

    # AI / LLM
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3.6-flash", alias="GEMINI_MODEL")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-3-5-sonnet-20241022", alias="ANTHROPIC_MODEL")
    anthropic_base_url: str = Field(default="https://api.anthropic.com", alias="ANTHROPIC_BASE_URL")
    ai_provider: str = Field(default="gemini", alias="AI_PROVIDER") # gemini | openai | claude

    # Meta / Facebook Direct Access Tokens & OAuth
    facebook_app_id: str | None = Field(default=None, alias="FACEBOOK_APP_ID")
    facebook_app_secret: str | None = Field(default=None, alias="FACEBOOK_APP_SECRET")
    facebook_redirect_uri: str = Field(default="http://localhost:8000/api/v1/crm/facebook/oauth-callback", alias="FACEBOOK_REDIRECT_URI")
    facebook_access_token: str | None = Field(default=None, alias="FB_ACCESS_TOKEN")
    facebook_page_id: str | None = Field(default=None, alias="FB_PAGE_ID")
    facebook_ad_account_id: str | None = Field(default=None, alias="FB_AD_ACCOUNT_ID")


    # GST / Tax Lookup & Whitebooks GSP Integration
    gstin_check_api_key: str | None = Field(default=None, alias="GSTIN_CHECK_API_KEY")
    gst_api_key: str | None = Field(default=None, alias="GST_API_KEY")
    whitebooks_base_url: str = Field(default="https://api.whitebooks.in", alias="WHITEBOOKS_BASE_URL")
    whitebooks_client_id: str | None = Field(default=None, alias="WHITEBOOKS_CLIENT_ID")
    whitebooks_client_secret: str | None = Field(default=None, alias="WHITEBOOKS_CLIENT_SECRET")
    whitebooks_api_key: str | None = Field(default=None, alias="WHITEBOOKS_API_KEY")
    whitebooks_gstin_username: str | None = Field(default=None, alias="WHITEBOOKS_GSTIN_USERNAME")
    whitebooks_gstin_password: str | None = Field(default=None, alias="WHITEBOOKS_GSTIN_PASSWORD")
    whitebooks_registered_email: str | None = Field(default=None, alias="WHITEBOOKS_REGISTERED_EMAIL")
    whitebooks_sandbox_gstin: str | None = Field(default=None, alias="WHITEBOOKS_SANDBOX_GSTIN")
    whitebooks_auth_token: str | None = Field(default=None, alias="WHITEBOOKS_AUTH_TOKEN")
    whitebooks_ip_address: str | None = Field(default=None, alias="WHITEBOOKS_IP_ADDRESS")

    # LiveKit / Telephony
    livekit_url: str | None = Field(default=None, alias="LIVEKIT_URL")
    livekit_api_key: str | None = Field(default=None, alias="LIVEKIT_API_KEY")
    livekit_api_secret: str | None = Field(default=None, alias="LIVEKIT_API_SECRET")
    sip_trunk_id: str | None = Field(default=None, alias="SIP_TRUNK_ID")
    plivo_termination_domain: str | None = Field(default=None, alias="PLIVO_TERMINATION_DOMAIN")
    plivo_auth_id: str | None = Field(default=None, alias="PLIVO_AUTH_ID")
    plivo_auth_token: str | None = Field(default=None, alias="PLIVO_AUTH_TOKEN")

    # Frontend integration
    frontend_url: str = Field(default="http://localhost:8080", alias="FRONTEND_URL")

    # Zoho Recruit Integration
    zoho_client_id: str | None = Field(default=None, alias="ZOHO_CLIENT_ID")
    zoho_client_secret: str | None = Field(default=None, alias="ZOHO_CLIENT_SECRET")
    zoho_redirect_uri: str | None = Field(default=None, alias="ZOHO_REDIRECT_URI")
    zoho_region: str = Field(default="US", alias="ZOHO_REGION")

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return value

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def async_database_url(self) -> str:
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        """Used by pgAdmin schema docs and optional Alembic migrations."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


def get_settings() -> Settings:
    load_dotenv(override=True)
    return Settings()


settings = get_settings()

