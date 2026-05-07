import httpx
import os
from fastapi import APIRouter, Body, Header, HTTPException, BackgroundTasks
from typing import Optional
from utils.email_utils import send_email
from database.supabase import get_supabase, get_supabase_admin

router = APIRouter()

_PROVIDER_LABELS = {
    "email": "Email",
    "google": "Google",
    "linkedin_oidc": "LinkedIn",
    "github": "GitHub",
}


async def _unlink_identity(user_id: str, identity_id: str) -> str:
    """
    Remove a single identity from a user via the Supabase admin REST API.
    Returns a short status string for logging.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return "skip:no-credentials"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.delete(
                f"{supabase_url}/auth/v1/admin/users/{user_id}/identities/{identity_id}",
                headers={
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                },
            )
            return f"http {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return f"error: {type(exc).__name__}: {exc}"


async def _find_other_users_by_email(email: str, exclude_user_id: str) -> list:
    """
    Query the Supabase admin REST API for all accounts with this email,
    excluding the current user. Used to detect duplicate accounts created
    when 'Allow manual linking' prevents auto-linking.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{supabase_url}/auth/v1/admin/users",
                headers={
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                },
                params={"filter": f"email={email}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                users = data.get("users", [])
                return [u for u in users if u.get("id") != exclude_user_id]
    except Exception:
        pass
    return []


def _original_provider_from_raw(identities: list) -> str:
    """Return the provider of the oldest identity in a raw dict list."""
    if not identities:
        return "email"
    sorted_ids = sorted(identities, key=lambda x: str(x.get("created_at") or ""))
    return sorted_ids[0].get("provider", "email")


@router.post("/verify-provider", tags=["auth"])
async def verify_provider(
    payload: dict = Body(default={}),
    authorization: Optional[str] = Header(None),
):
    """
    Server-side provider mismatch check called right after every sign-in.
    Handles two scenarios:
      1. Auto-linking: one account, two identities with different providers.
      2. Duplicate account: 'Allow manual linking' created a fresh OAuth account
         for an email that already has an email/password account.
    Uses the admin client so results are authoritative.
    """
    print("\n========== [verify-provider] CALLED ==========", flush=True)
    if not authorization or not authorization.startswith("Bearer "):
        print("[verify-provider] FAIL: missing/invalid Authorization header", flush=True)
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    admin = get_supabase_admin()  # optional — only needed to unlink

    try:
        user_response = sb.auth.get_user(token)
        user = user_response.user
        if not user:
            print("[verify-provider] FAIL: token did not resolve to a user", flush=True)
            raise HTTPException(status_code=401, detail="Invalid token")

        # Prefer admin view (authoritative) but fall back to the JWT user when
        # the service role key isn't configured. Both expose .identities and
        # .app_metadata, so the policy check below works either way.
        full_user = user
        if admin:
            try:
                admin_user = admin.auth.admin.get_user_by_id(user.id)
                full_user = admin_user.user
            except Exception as admin_exc:
                print(f"[verify-provider] WARN: admin lookup failed, using JWT user: {admin_exc}", flush=True)
        else:
            print("[verify-provider] WARN: admin client unavailable — using JWT user (unlink will be skipped)", flush=True)

        identities = full_user.identities or []
        app_meta = full_user.app_metadata or {}
        current_provider = app_meta.get("provider", "email")

        print(f"[verify-provider] user.id={user.id} email={getattr(full_user, 'email', None)}", flush=True)
        print(f"[verify-provider] app_metadata.provider={current_provider} providers={app_meta.get('providers')}", flush=True)
        print(f"[verify-provider] identities count={len(identities)}", flush=True)
        for i, ident in enumerate(identities):
            ident_id = getattr(ident, "identity_id", None) or getattr(ident, "id", None)
            print(
                f"[verify-provider]   identity[{i}] provider={getattr(ident, 'provider', '?')} "
                f"id={ident_id} created_at={getattr(ident, 'created_at', None)} "
                f"last_sign_in_at={getattr(ident, 'last_sign_in_at', None)}",
                flush=True,
            )

        # --- Provider mismatch check ---
        # Policy: one auth method per email.
        #   original_provider = oldest identity (account creation method).
        #   just_used_provider = the method the user actually used to sign in
        #     right now. Supabase doesn't expose this reliably:
        #       - app_metadata.provider stays as the original after auto-link
        #       - identity.last_sign_in_at is never updated post-creation
        #     So the frontend tells us via the `attempted_provider` field.
        attempted_provider = (payload or {}).get("attempted_provider") if isinstance(payload, dict) else None
        print(f"[verify-provider] attempted_provider (from client) = {attempted_provider}", flush=True)

        if identities:
            sorted_by_creation = sorted(identities, key=lambda x: str(getattr(x, "created_at", "") or ""))
            original_provider = sorted_by_creation[0].provider
            # Trust the client's attempted_provider if present; otherwise
            # fall back to app_metadata.provider (works only when the
            # account has never been auto-linked).
            just_used_provider = attempted_provider or current_provider

            print(
                f"[verify-provider] original_provider={original_provider} "
                f"just_used_provider={just_used_provider}",
                flush=True,
            )

            if just_used_provider != original_provider:
                print(
                    f"[verify-provider] BLOCK: signed in with {just_used_provider} but account "
                    f"was created with {original_provider}. Unlinking foreign identities.",
                    flush=True,
                )
                for ident in identities:
                    if ident.provider != original_provider:
                        ident_id = getattr(ident, "identity_id", None) or getattr(ident, "id", None)
                        if ident_id:
                            unlinked = await _unlink_identity(user.id, str(ident_id))
                            print(f"[verify-provider]   unlink {ident.provider} {ident_id} -> {unlinked}", flush=True)
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "wrong_provider",
                        "original_provider": original_provider,
                        "label": _PROVIDER_LABELS.get(original_provider, original_provider),
                    },
                )

            # Correct method — but if foreign identities are lying around from
            # a prior failed attempt, clean them up silently.
            if len(identities) > 1:
                print(
                    f"[verify-provider] CLEANUP: correct method ({just_used_provider}) but "
                    f"{len(identities) - 1} foreign identities present. Removing.",
                    flush=True,
                )
                for ident in identities:
                    if ident.provider != original_provider:
                        ident_id = getattr(ident, "identity_id", None) or getattr(ident, "id", None)
                        if ident_id:
                            unlinked = await _unlink_identity(user.id, str(ident_id))
                            print(f"[verify-provider]   unlink {ident.provider} {ident_id} -> {unlinked}", flush=True)

        # --- Check 2: duplicate account created by OAuth when auto-link is off ---
        # Only applies to single-identity OAuth accounts (fresh account, not auto-linked).
        if len(identities) == 1 and current_provider != "email" and full_user.email:
            others = await _find_other_users_by_email(full_user.email, user.id)
            for other in others:
                other_original = _original_provider_from_raw(other.get("identities") or [])
                conflict = (
                    other_original == "email"
                    or (other_original != "email" and other_original != current_provider)
                )
                if conflict:
                    # Delete the orphan OAuth account so it doesn't accumulate
                    try:
                        admin.auth.admin.delete_user(user.id)
                    except Exception:
                        pass
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "code": "wrong_provider",
                            "original_provider": other_original,
                            "label": _PROVIDER_LABELS.get(other_original, other_original),
                        },
                    )

        print(f"[verify-provider] OK: provider={current_provider}", flush=True)
        return {"ok": True, "provider": current_provider}

    except HTTPException:
        raise
    except Exception as exc:
        # Fail closed AND log — silently passing here is exactly how
        # auto-linked accounts were slipping through before.
        import traceback
        print(f"[verify-provider] UNEXPECTED ERROR: {type(exc).__name__}: {exc}", flush=True)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Provider verification error")

@router.get("/login", tags=["auth"])
async def login_info():
    """
    Placeholder login endpoint.
    The actual login is handled by the frontend directly with Supabase.
    """
    return {"message": "HumatiQ login system (Client-side)"}

@router.post("/notify-login", tags=["auth"])
async def notify_login(background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    """
    Endpoint called by the frontend after a successful login to send a notification email.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1]
    sb = get_supabase()
    
    try:
        user_response = sb.auth.get_user(token)
        user = user_response.user
        if not user or not user.email:
            raise HTTPException(status_code=400, detail="User email not found")

        subject = "Nouvelle connexion détectée"
        content = f"Bonjour,\n\nUne nouvelle connexion à votre compte HumatiQ a été détectée.\n\nSi vous n'êtes pas à l'origine de cette action, nous vous recommandons de changer votre mot de passe immédiatement.\n\nL'équipe HumatiQ"
        
        background_tasks.add_task(send_email, user.email, subject, content)
        return {"status": "notification_sent"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")



