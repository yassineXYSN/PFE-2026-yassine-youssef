import importlib
import config


def test_defaults_to_development(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    importlib.reload(config)
    assert config.ENVIRONMENT == "development"
    assert config.IS_PRODUCTION is False


def test_production_flag(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "Production")
    importlib.reload(config)
    assert config.ENVIRONMENT == "production"
    assert config.IS_PRODUCTION is True
