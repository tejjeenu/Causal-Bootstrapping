from __future__ import annotations

from backend.app.config import _parse_bool, _parse_samesite, get_settings


def test_parse_bool_true_variants():
    assert _parse_bool("1", default=False) is True
    assert _parse_bool("TRUE", default=False) is True
    assert _parse_bool("yes", default=False) is True
    assert _parse_bool("on", default=False) is True


def test_parse_bool_false_and_default():
    assert _parse_bool("0", default=True) is False
    assert _parse_bool(" false ", default=True) is False
    assert _parse_bool(None, default=True) is True


def test_parse_samesite_valid_values():
    assert _parse_samesite("strict") == "strict"
    assert _parse_samesite("LAX") == "lax"
    assert _parse_samesite("none") == "none"


def test_parse_samesite_fallback_to_lax():
    assert _parse_samesite("invalid-value") == "lax"
    assert _parse_samesite(None) == "lax"


def test_get_settings_defaults(monkeypatch):
    for key in (
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_RESULTS_TABLE",
        "SUPABASE_RISK_SETTINGS_TABLE",
        "AUTH_COOKIE_NAME",
        "AUTH_COOKIE_SECURE",
        "AUTH_COOKIE_SAMESITE",
        "CORS_ORIGINS",
    ):
        monkeypatch.delenv(key, raising=False)

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.supabase_results_table == "prediction_results"
    assert settings.supabase_risk_settings_table == "risk_classification_settings"
    assert settings.auth_cookie_name == "cb_auth_token"
    assert settings.auth_cookie_secure is False
    assert settings.auth_cookie_samesite == "lax"
    assert settings.cors_origins == ("http://localhost:5173", "http://127.0.0.1:5173")


def test_get_settings_reads_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "demo-anon-key")
    monkeypatch.setenv("SUPABASE_RESULTS_TABLE", "custom_results")
    monkeypatch.setenv("SUPABASE_RISK_SETTINGS_TABLE", "custom_risk")
    monkeypatch.setenv("AUTH_COOKIE_NAME", "session_cookie")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("AUTH_COOKIE_SAMESITE", "strict")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, https://app.example.com")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.supabase_url == "https://demo.supabase.co"
    assert settings.supabase_anon_key == "demo-anon-key"
    assert settings.supabase_results_table == "custom_results"
    assert settings.supabase_risk_settings_table == "custom_risk"
    assert settings.auth_cookie_name == "session_cookie"
    assert settings.auth_cookie_secure is True
    assert settings.auth_cookie_samesite == "strict"
    assert settings.cors_origins == ("http://localhost:3000", "https://app.example.com")
