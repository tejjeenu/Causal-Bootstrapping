from __future__ import annotations

import io
import json
from urllib.error import HTTPError, URLError

import pytest

from app.config import Settings
from app.supabase_auth import (
    SupabaseAuthError,
    _auth_request,
    ensure_supabase_auth_config,
    sign_in_with_password,
)


class _FakeResponse:
    def __init__(self, payload: dict):
        self._raw = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return self._raw


def _settings() -> Settings:
    return Settings(
        supabase_url="https://example.supabase.co",
        supabase_anon_key="anon",
        supabase_results_table="prediction_results",
        supabase_risk_settings_table="risk_classification_settings",
        auth_cookie_name="cb_auth_token",
        auth_cookie_secure=False,
        auth_cookie_samesite="lax",
        cors_origins=("http://localhost:5173",),
    )


def test_ensure_supabase_auth_config_requires_values():
    empty = _settings()
    empty = Settings(
        supabase_url="",
        supabase_anon_key="",
        supabase_results_table=empty.supabase_results_table,
        supabase_risk_settings_table=empty.supabase_risk_settings_table,
        auth_cookie_name=empty.auth_cookie_name,
        auth_cookie_secure=empty.auth_cookie_secure,
        auth_cookie_samesite=empty.auth_cookie_samesite,
        cors_origins=empty.cors_origins,
    )

    with pytest.raises(SupabaseAuthError, match="Supabase auth is not configured"):
        ensure_supabase_auth_config(empty)


def test_auth_request_success(monkeypatch):
    monkeypatch.setattr("app.supabase_auth.urlopen", lambda _req, timeout=15: _FakeResponse({"ok": True}))

    data = _auth_request(_settings(), method="GET", path="user")
    assert data == {"ok": True}


def test_auth_request_http_error_uses_payload_detail(monkeypatch):
    error = HTTPError(
        url="https://example.supabase.co/auth/v1/user",
        code=401,
        msg="Unauthorized",
        hdrs=None,
        fp=io.BytesIO(b'{"error":"bad token"}'),
    )

    def _raise_error(_req, timeout=15):
        raise error

    monkeypatch.setattr("app.supabase_auth.urlopen", _raise_error)

    with pytest.raises(SupabaseAuthError) as exc_info:
        _auth_request(_settings(), method="GET", path="user")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "bad token"


def test_auth_request_url_error(monkeypatch):
    def _raise_error(_req, timeout=15):
        raise URLError("network down")

    monkeypatch.setattr("app.supabase_auth.urlopen", _raise_error)

    with pytest.raises(SupabaseAuthError) as exc_info:
        _auth_request(_settings(), method="GET", path="user")

    assert exc_info.value.status_code == 502
    assert "Unable to reach Supabase" in exc_info.value.detail


def test_sign_in_with_password_uses_password_grant(monkeypatch):
    seen = {}

    def _fake_auth_request(settings, *, method, path, payload=None, access_token=None):
        seen["method"] = method
        seen["path"] = path
        seen["payload"] = payload
        seen["access_token"] = access_token
        return {"access_token": "token"}

    monkeypatch.setattr("app.supabase_auth._auth_request", _fake_auth_request)

    result = sign_in_with_password(_settings(), email="a@example.com", password="secret123")
    assert result == {"access_token": "token"}
    assert seen["method"] == "POST"
    assert seen["path"] == "token?grant_type=password"
    assert seen["payload"] == {"email": "a@example.com", "password": "secret123"}

