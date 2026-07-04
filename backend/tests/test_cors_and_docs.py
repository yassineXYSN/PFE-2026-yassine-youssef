import importlib
import os
import sys

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
