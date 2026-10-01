from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def default_database_url():
    # Preserve a legacy DB rather than silently starting with empty data.
    legacy = Path('sira_prototype.db')
    current = Path('tracehaven.db')
    if legacy.exists():
        if current.exists():
            raise RuntimeError('Two local databases found. Set DATABASE_URL explicitly before starting.')
        return f'sqlite:///{legacy}'
    return f'sqlite:///{current}'


class Settings(BaseSettings):
    database_url: str = Field(default_factory=default_database_url, validation_alias='DATABASE_URL')
    openai_api_key: str | None = Field(default=None, validation_alias='OPENAI_API_KEY')
    openai_api_base: str = Field(default='https://api.openai.com/v1', validation_alias='OPENAI_API_BASE')
    openai_model_name: str = Field(default='gpt-4o-mini', validation_alias='OPENAI_MODEL_NAME')
    allowed_origins: list[str] = ['http://localhost:3000']
    live_enabled: bool = False
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

settings = Settings()
