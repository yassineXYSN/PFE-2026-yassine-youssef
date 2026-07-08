import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _routes_for_env(env, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", env)
    import config
    importlib.reload(config)
    import main
    importlib.reload(main)
    return {getattr(r, "path", None) for r in main.app.routes}


def test_test_routes_absent_in_production(monkeypatch):
    paths = _routes_for_env("production", monkeypatch)
    assert "/test/quiz" not in paths
    assert not any(p and p.startswith("/api/test-pipeline") for p in paths)


def test_test_routes_present_in_development(monkeypatch):
    paths = _routes_for_env("development", monkeypatch)
    assert any(p and p.startswith("/api/test-pipeline") for p in paths)
