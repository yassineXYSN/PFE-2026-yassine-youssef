import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext

from .database.mysql import get_db, row
from .dependencies import create_access_token, get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""
    role: str = "candidate"


@router.post("/login")
def login(body: LoginRequest, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "SELECT u.id, u.password_hash, p.role, p.status "
        "FROM users u JOIN profiles p ON p.id = u.id "
        "WHERE u.email = %s",
        (body.email,),
    )
    record = cur.fetchone()
    if not record or not pwd_context.verify(body.password, record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({
        "sub": record["id"],
        "email": body.email,
        "role": record["role"],
    })
    return {"access_token": token, "token_type": "bearer", "role": record["role"]}


@router.post("/register", status_code=201)
def register(body: RegisterRequest, db=Depends(get_db)):
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    hashed = pwd_context.hash(body.password)
    cur.execute(
        "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
        (user_id, body.email, hashed),
    )
    cur.execute(
        "INSERT INTO profiles (id, email, first_name, last_name, role, status) "
        "VALUES (%s, %s, %s, %s, %s, 'pending')",
        (user_id, body.email, body.first_name, body.last_name, body.role),
    )

    token = create_access_token({"sub": user_id, "email": body.email, "role": body.role})
    return {"access_token": token, "token_type": "bearer", "role": body.role}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "SELECT u.id, u.email, p.first_name, p.last_name, p.role, p.status, p.company_id "
        "FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = %s",
        (current_user["sub"],),
    )
    record = cur.fetchone()
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    return row(record)


@router.post("/logout")
def logout():
    return {"message": "ok"}
