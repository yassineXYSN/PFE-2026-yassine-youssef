"""
Integration test for account setup — DISABLED pending migration to local JWT auth.

This test previously used Supabase to create test tokens.
TODO: Rewrite using the new /api/auth/register + /api/auth/login endpoints
to obtain a JWT, then use that token for the account setup assertions.
"""
import pytest
pytest.skip("Supabase auth removed — test needs rewriting for local JWT", allow_module_level=True)
