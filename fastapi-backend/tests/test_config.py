from __future__ import annotations

from app.config import _parse_non_negative_int, get_settings


def test_parse_non_negative_int_uses_default_on_missing_or_invalid():
    assert _parse_non_negative_int(None, default=512) == 512
    assert _parse_non_negative_int("bad", default=512) == 512
    assert _parse_non_negative_int("-1", default=512) == 512


def test_parse_non_negative_int_parses_valid_value():
    assert _parse_non_negative_int("0", default=512) == 0
    assert _parse_non_negative_int("2048", default=512) == 2048


def test_get_settings_defaults(monkeypatch):
    for key in (
        "CORS_ORIGINS",
        "INFERENCE_CACHE_SIZE",
    ):
        monkeypatch.delenv(key, raising=False)

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.cors_origins == ("http://localhost:5173", "http://127.0.0.1:5173")
    assert settings.inference_cache_size == 512


def test_get_settings_reads_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, https://app.example.com")
    monkeypatch.setenv("INFERENCE_CACHE_SIZE", "2048")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.cors_origins == ("http://localhost:3000", "https://app.example.com")
    assert settings.inference_cache_size == 2048

