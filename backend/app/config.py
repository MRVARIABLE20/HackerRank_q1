"""Centralized settings loaded from environment."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file (backend/.env), not the CWD
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    # Database (SQLite for dev)
    database_url_override: str = ""

    # OpenRouter API (embeddings + LLM)
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 480

    # App
    app_env: str = "dev"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def database_url(self) -> str:
        """Returns SQLite URL (override can be set in .env)."""
        if self.database_url_override:
            return self.database_url_override
        return "sqlite:///./rag.db"  # Default to SQLite


@lru_cache
def get_settings() -> Settings:
    return Settings()
