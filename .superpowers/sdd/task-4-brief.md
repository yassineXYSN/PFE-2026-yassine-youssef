## Task 4: `backend/routers/team.py` — pending status + activation link for password invites

**Files:**
- Modify: `backend/routers/team.py`

**Interfaces:**
- Consumes: Task 2's `issue_verification_token`.

- [ ] **Step 1: Add the import**

At the top of `backend/routers/team.py`, after the existing `from utils.email_utils import send_email` line (line 8), add:

```python
from utils.verification_tokens import issue_verification_token
```

- [ ] **Step 2: Create the account as `pending` instead of `active`, and issue a token**

In the `invite_team_member` function, change this block (currently lines 114-126):

```python
        db_gen = get_mysql_db()
        db_conn = next(db_gen)
        try:
            with db_conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                    (new_id, email.lower().strip(), password_hash)
                )
                cursor.execute(
                    "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                    (new_id, role, "active", first_name or None, last_name or None)
                )
            db_conn.commit()
            mariadb_user_id = new_id
            print(f"DEBUG: MariaDB user created: {mariadb_user_id}")
```

to:

```python
        db_gen = get_mysql_db()
        db_conn = next(db_gen)
        try:
            with db_conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                    (new_id, email.lower().strip(), password_hash)
                )
                cursor.execute(
                    "INSERT INTO profiles (id, role, status, first_name, last_name) VALUES (%s, %s, %s, %s, %s)",
                    (new_id, role, "pending", first_name or None, last_name or None)
                )
                verification_token = issue_verification_token(cursor, email.lower().strip())
            db_conn.commit()
            mariadb_user_id = new_id
            print(f"DEBUG: MariaDB user created: {mariadb_user_id}")
```

- [ ] **Step 3: Store the new profile as `pending` too**

Change this line (currently line 149):

```python
        "status": "active" if mariadb_user_id else "invited",
```

to:

```python
        "status": "pending" if mariadb_user_id else "invited",
```

- [ ] **Step 4: Fold the activation link into the credentials email**

Change this block (currently lines 165-176):

```python
    if temp_password:
        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} a créé votre compte sur l'espace de gestion RH de {company.get('name')}.\n\n"
            f"Voici vos identifiants de connexion :\n"
            f"  Email    : {email}\n"
            f"  Mot de passe : {temp_password}\n\n"
            f"Connectez-vous ici : {login_url}\n\n"
            f"Nous vous recommandons de changer votre mot de passe après votre première connexion.\n\n"
            f"Bienvenue dans l'équipe !\n"
            f"L'équipe HumatiQ"
        )
```

to:

```python
    if temp_password:
        verify_link = os.getenv("FRONTEND_URL", "http://localhost:5173") + f"/hr/verify-email?token={verification_token}"
        content = (
            f"Bonjour {first_name},\n\n"
            f"{current_user['email']} a créé votre compte sur l'espace de gestion RH de {company.get('name')}.\n\n"
            f"Voici vos identifiants de connexion :\n"
            f"  Email    : {email}\n"
            f"  Mot de passe : {temp_password}\n\n"
            f"Avant de pouvoir vous connecter, vous devez activer votre compte en cliquant sur ce lien "
            f"(valable 7 jours) :\n\n{verify_link}\n\n"
            f"Nous vous recommandons de changer votre mot de passe après votre première connexion.\n\n"
            f"Bienvenue dans l'équipe !\n"
            f"L'équipe HumatiQ"
        )
```

- [ ] **Step 5: Sanity-check the module still imports cleanly**

Run: `cd backend && python -c "from main import app; print('ok')"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add backend/routers/team.py
git commit -m "Require email verification for password-based team invites"
```

---

