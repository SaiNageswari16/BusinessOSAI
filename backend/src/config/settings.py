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
    app_name: str = Field(default="RestaurantOS", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    app_public_url: str = Field(default="http://127.0.0.1:8000", alias="APP_PUBLIC_URL")
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    # PostgreSQL
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="restaurantos", alias="POSTGRES_DB")
    postgres_schema: str = Field(default="public", alias="POSTGRES_SCHEMA")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    db_pool_size: int = Field(default=10, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=20, alias="DB_MAX_OVERFLOW")
    db_echo: bool = Field(default=False, alias="DB_ECHO")
    auto_create_tables: bool = Field(default=True, alias="AUTO_CREATE_TABLES")

    # Security
    secret_key: str = Field(default="insecure-dev-key-change-me", alias="SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    redis_enabled: bool = Field(default=True, alias="REDIS_ENABLED")
    redis_failure_disable_seconds: int = Field(default=60, alias="REDIS_FAILURE_DISABLE_SECONDS")
    cache_ttl_seconds: int = Field(default=300, alias="CACHE_TTL_SECONDS")

    # MinIO / S3
    minio_enabled: bool = Field(default=False, alias="MINIO_ENABLED")
    minio_endpoint: str = Field(default="localhost:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="restaurant-media", alias="MINIO_BUCKET")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    # WhatsApp gateway — 127.0.0.1, never localhost (Windows IPv6 resolution issue)
    whatsapp_gateway_url: str = Field(default="http://127.0.0.1:8005", alias="WHATSAPP_GATEWAY_URL")
    whatsapp_enabled: bool = Field(default=False, alias="WHATSAPP_ENABLED")

    # Thermal print bridge — same 127.0.0.1 rule
    print_bridge_url: str = Field(default="http://127.0.0.1:8006", alias="PRINT_BRIDGE_URL")
    print_bridge_enabled: bool = Field(default=False, alias="PRINT_BRIDGE_ENABLED")
    kot_print_retry_max: int = Field(default=5, alias="KOT_PRINT_RETRY_MAX")
    kot_print_retry_delay_seconds: int = Field(default=30, alias="KOT_PRINT_RETRY_DELAY_SECONDS")

    # KDS / realtime
    kds_ws_enabled: bool = Field(default=True, alias="KDS_WS_ENABLED")
    kds_ws_heartbeat_seconds: int = Field(default=20, alias="KDS_WS_HEARTBEAT_SECONDS")
    kot_auto_ack_timeout_minutes: int = Field(default=5, alias="KOT_AUTO_ACK_TIMEOUT_MINUTES")
    kds_poll_fallback_seconds: int = Field(default=5, alias="KDS_POLL_FALLBACK_SECONDS")
    kitchen_backlog_alert_count: int = Field(default=10, alias="KITCHEN_BACKLOG_ALERT_COUNT")

    # Email
    smtp_host: str = Field(default="smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    email_from: str = Field(default="noreply@restaurantos.local", alias="EMAIL_FROM")
    email_enabled: bool = Field(default=False, alias="EMAIL_ENABLED")
    resend_api_key: str = Field(default="", alias="RESEND_API_KEY")

    # AI
    ai_enabled: bool = Field(default=False, alias="AI_ENABLED")
    ai_provider: str = Field(default="gemini", alias="AI_PROVIDER")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    ai_model_gemini: str = Field(default="gemini-2.0-flash", alias="AI_MODEL_GEMINI")
    ai_model_openai: str = Field(default="gpt-4o-mini", alias="AI_MODEL_OPENAI")
    ai_model_anthropic: str = Field(default="claude-sonnet-5", alias="AI_MODEL_ANTHROPIC")
    ai_max_tokens: int = Field(default=2048, alias="AI_MAX_TOKENS")

    # Payments
    razorpay_key_id: str = Field(default="", alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str = Field(default="", alias="RAZORPAY_KEY_SECRET")
    razorpay_test_mode: bool = Field(default=True, alias="RAZORPAY_TEST_MODE")
    stripe_secret_key: str = Field(default="", alias="STRIPE_SECRET_KEY")
    pinelabs_merchant_id: str = Field(default="", alias="PINELABS_MERCHANT_ID")
    phonepe_salt_key: str = Field(default="", alias="PHONEPE_SALT_KEY")
    paytm_merchant_id: str = Field(default="", alias="PAYTM_MERCHANT_ID")
    cashfree_app_id: str = Field(default="", alias="CASHFREE_APP_ID")
    cashfree_secret_key: str = Field(default="", alias="CASHFREE_SECRET_KEY")
    cod_enabled: bool = Field(default=True, alias="COD_ENABLED")
    credit_sale_enabled: bool = Field(default=False, alias="CREDIT_SALE_ENABLED")

    # Tax / GST (Whitebooks GSP)
    whitebooks_enabled: bool = Field(default=False, alias="WHITEBOOKS_ENABLED")
    whitebooks_gsp_app_key: str = Field(default="", alias="WHITEBOOKS_GSP_APP_KEY")
    whitebooks_gsp_client_id: str = Field(default="", alias="WHITEBOOKS_GSP_CLIENT_ID")
    whitebooks_gsp_client_secret: str = Field(default="", alias="WHITEBOOKS_GSP_CLIENT_SECRET")
    whitebooks_gsp_username: str = Field(default="", alias="WHITEBOOKS_GSP_USERNAME")
    whitebooks_gsp_password: str = Field(default="", alias="WHITEBOOKS_GSP_PASSWORD")
    whitebooks_gsp_gstin: str = Field(default="", alias="WHITEBOOKS_GSP_GSTIN")
    whitebooks_gsp_base_url: str = Field(
        default="https://gsp.whitebooks.com", alias="WHITEBOOKS_GSP_BASE_URL"
    )
    einvoice_enabled: bool = Field(default=False, alias="EINVOICE_ENABLED")
    eway_bill_enabled: bool = Field(default=False, alias="EWAY_BILL_ENABLED")

    # Aggregators
    zomato_enabled: bool = Field(default=False, alias="ZOMATO_ENABLED")
    zomato_api_key: str = Field(default="", alias="ZOMATO_API_KEY")
    swiggy_enabled: bool = Field(default=False, alias="SWIGGY_ENABLED")
    swiggy_api_key: str = Field(default="", alias="SWIGGY_API_KEY")
    magicpin_enabled: bool = Field(default=False, alias="MAGICPIN_ENABLED")
    dotpe_enabled: bool = Field(default=False, alias="DOTPE_ENABLED")

    # Locale
    default_timezone: str = Field(default="Asia/Kolkata", alias="DEFAULT_TIMEZONE")
    default_currency: str = Field(default="INR", alias="DEFAULT_CURRENCY")
    default_country: str = Field(default="IN", alias="DEFAULT_COUNTRY")

    # Demo seed
    seed_demo_data: bool = Field(default=True, alias="SEED_DEMO_DATA")
    demo_owner_email: str = Field(default="owner@demo.com", alias="DEMO_OWNER_EMAIL")
    demo_owner_password: str = Field(default="demo1234", alias="DEMO_OWNER_PASSWORD")

    # Platform super admin
    #
    # Credentials for scripts/seed_platform_admin.py only. Nothing reads these
    # at runtime: the platform service never seeds an admin at startup, because
    # a password in this file is a password in the repository. The defaults are
    # empty so that forgetting to set them fails loudly at the prompt rather
    # than quietly creating a known-password account.
    platform_admin_email: str = Field(default="", alias="PLATFORM_ADMIN_EMAIL")
    platform_admin_password: str = Field(default="", alias="PLATFORM_ADMIN_PASSWORD")

    @property
    def async_database_url(self) -> str:
        """asyncpg DSN. Accepts either DATABASE_URL or the discrete POSTGRES_* fields."""
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        """psycopg2 DSN — for pgAdmin-side tooling and any sync scripts."""
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql+asyncpg://"):
                return url.replace("postgresql+asyncpg://", "postgresql://", 1)
            return url
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("app_env")
    @classmethod
    def _validate_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
