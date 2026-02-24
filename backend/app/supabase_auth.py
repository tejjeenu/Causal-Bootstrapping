from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from .config import Settings


class SupabaseAuthError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def ensure_supabase_auth_config(settings: Settings) -> None:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise SupabaseAuthError(
            status_code=500,
            detail="Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
        )


def _auth_request(
    settings: Settings,
    *,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    access_token: str | None = None,
) -> dict[str, Any]:
    ensure_supabase_auth_config(settings)
    base_url = settings.supabase_url.rstrip("/") + "/"
    target_url = urljoin(base_url, f"auth/v1/{path.lstrip('/')}")

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    headers = {
        "apikey": settings.supabase_anon_key,
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    request = Request(url=target_url, data=body, method=method.upper(), headers=headers)

    try:
        with urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8").strip()
            if not raw:
                return {}
            return json.loads(raw)
    except HTTPError as exc:
        raw_error = exc.read().decode("utf-8").strip()
        detail = f"Supabase request failed with status {exc.code}."
        if raw_error:
            try:
                payload = json.loads(raw_error)
                detail = (
                    payload.get("msg")
                    or payload.get("error_description")
                    or payload.get("error")
                    or detail
                )
            except json.JSONDecodeError:
                detail = raw_error
        raise SupabaseAuthError(status_code=exc.code, detail=detail) from exc
    except URLError as exc:
        raise SupabaseAuthError(status_code=502, detail=f"Unable to reach Supabase: {exc.reason}") from exc


def sign_up_with_password(settings: Settings, email: str, password: str) -> dict[str, Any]:
    return _auth_request(
        settings,
        method="POST",
        path="signup",
        payload={"email": email, "password": password},
    )


def sign_in_with_password(settings: Settings, email: str, password: str) -> dict[str, Any]:
    return _auth_request(
        settings,
        method="POST",
        path="token?grant_type=password",
        payload={"email": email, "password": password},
    )


def get_user_for_token(settings: Settings, access_token: str) -> dict[str, Any]:
    return _auth_request(settings, method="GET", path="user", access_token=access_token)


def sign_out(settings: Settings, access_token: str) -> None:
    _auth_request(settings, method="POST", path="logout", access_token=access_token)
