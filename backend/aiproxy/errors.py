"""Typed errors for the aiproxy package."""


class AIProxyError(Exception):
    """Base error for all aiproxy failures."""


class ProviderError(AIProxyError):
    """Raised when a provider call fails (missing key, HTTP error, bad response)."""

    def __init__(self, provider: str, capability: str, detail: str):
        self.provider = provider
        self.capability = capability
        self.detail = detail
        super().__init__(f"[{provider}/{capability}] {detail}")


class ConfigError(AIProxyError):
    """Raised when configuration required for a provider/capability is missing or invalid."""
