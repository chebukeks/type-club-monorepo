from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = ""
    jwt_secret_key: str = ""
    jwt_expire_minutes: int = 10080
    secret_key: str = ""
    debug: bool = False
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    # Frontend URL for email links
    frontend_url: str = "http://localhost:5173"

    # Verification token TTL
    verify_email_token_minutes: int = 1440  # 24 hours
    reset_password_token_minutes: int = 60   # 1 hour

    # Moderation
    moderator_email: str = ""

    # Internal: shared secret for collab-server ↔ backend
    service_token: str = ""


settings = Settings()
