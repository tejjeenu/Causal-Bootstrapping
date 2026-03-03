from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_ROOT / ".env")


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
    cors_origins: tuple[str, ...]
    inference_cache_size: int = 512


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    default_origins = "http://localhost:5173,http://127.0.0.1:5173"
    origins_value = os.getenv("CORS_ORIGINS", default_origins)
    origins = tuple(origin.strip() for origin in origins_value.split(",") if origin.strip())

    return Settings(
        cors_origins=origins,
        inference_cache_size=_parse_non_negative_int(os.getenv("INFERENCE_CACHE_SIZE"), default=512),
    )
