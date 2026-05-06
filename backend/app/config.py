from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://eatsmart:eatsmart_pass@eatsmart_postgres:5432/typeclub_db"
    jwt_secret_key: str = "change-me-jwt"
    jwt_expire_minutes: int = 10080
    secret_key: str = "change-me"
    debug: bool = False
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000


settings = Settings()
