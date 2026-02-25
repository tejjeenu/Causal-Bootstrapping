from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_ROOT / ".env")


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_samesite(value: str | None) -> str:
    normalized = (value or "lax").strip().lower()
    return normalized if normalized in {"lax", "strict", "none"} else "lax"


def _parse_non_negative_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value.strip())
    except ValueError:
        return default
    return parsed if parsed >= 0 else default


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    supabase_results_table: str
    supabase_risk_settings_table: str
    auth_cookie_name: str
    auth_cookie_secure: bool
    auth_cookie_samesite: str
    cors_origins: tuple[str, ...]
    inference_cache_size: int = 512


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    default_origins = "http://localhost:5173,http://127.0.0.1:5173"
    origins_value = os.getenv("CORS_ORIGINS", default_origins)
    origins = tuple(origin.strip() for origin in origins_value.split(",") if origin.strip())

    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").strip(),
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", "").strip(),
        supabase_results_table=os.getenv("SUPABASE_RESULTS_TABLE", "prediction_results").strip()
        or "prediction_results",
        supabase_risk_settings_table=os.getenv("SUPABASE_RISK_SETTINGS_TABLE", "risk_classification_settings").strip()
        or "risk_classification_settings",
        auth_cookie_name=os.getenv("AUTH_COOKIE_NAME", "cb_auth_token").strip() or "cb_auth_token",
        auth_cookie_secure=_parse_bool(os.getenv("AUTH_COOKIE_SECURE"), default=False),
        auth_cookie_samesite=_parse_samesite(os.getenv("AUTH_COOKIE_SAMESITE", "lax")),
        cors_origins=origins,
        inference_cache_size=_parse_non_negative_int(os.getenv("INFERENCE_CACHE_SIZE"), default=512),
    )
