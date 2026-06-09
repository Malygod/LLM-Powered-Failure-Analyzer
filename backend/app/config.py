import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    database_url: str = Field(
        default="sqlite:///./sira_prototype.db",
        validation_alias="DATABASE_URL"
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias="OPENAI_API_KEY"
    )
    openai_api_base: str = Field(
        default="https://api.openai.com/v1",
        validation_alias="OPENAI_API_BASE"
    )
    openai_model_name: str = Field(
        default="gpt-4o-mini",
        validation_alias="OPENAI_MODEL_NAME"
    )
    port: int = Field(default=8000, validation_alias="PORT")
    host: str = Field(default="0.0.0.0", validation_alias="HOST")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
