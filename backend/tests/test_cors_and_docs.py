import importlib
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _app_for_env(env, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", env)
    import config
    importlib.reload(config)
    import main
    importlib.reload(main)
    return main.app


def test_docs_disabled_in_production(monkeypatch):
    app = _app_for_env("production", monkeypatch)
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/docs" not in paths
    assert "/openapi.json" not in paths


def test_docs_enabled_in_development(monkeypatch):
    app = _app_for_env("development", monkeypatch)
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/docs" in paths


def test_preflight_allows_frontend_custom_headers(monkeypatch):
    """Regression test: apiClient.js always sends ngrok-skip-browser-warning,
    so CORS must allow it or every real browser preflight (login, register,
    /me, ...) fails with 400 Disallowed CORS headers."""
    app = _app_for_env("development", monkeypatch)
    client = TestClient(app)
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:8080",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,ngrok-skip-browser-warning",
        },
    )
    assert response.status_code == 200
    allowed = response.headers.get("access-control-allow-headers", "").lower()
    assert "ngrok-skip-browser-warning" in allowed
