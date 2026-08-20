"""Auth routes: register, login, logout, me, refresh."""
import os
import jwt
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from core import (db, NO_ID, new_id, now_iso, hash_password, verify_password,
                  create_access_token, create_refresh_token, set_auth_cookies,
                  clear_auth_cookies, get_current_user, _secret, JWT_ALGORITHM)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


class RegisterIn(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _public(user: dict) -> dict:
    user.pop("password_hash", None)
    return user


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    org_id = new_id()
    uid = new_id()
    doc = {
        "id": uid,
        "org_id": org_id,
        "email": email,
        "name": body.name.strip(),
        "role": "owner",
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await db.orgs.insert_one({"id": org_id, "name": body.name.strip(), "created_at": now_iso()})
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    user = await db.users.find_one({"id": uid}, NO_ID)
    return {"user": _public(user), "access_token": access}


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_at = datetime.fromisoformat(attempt["updated_at"])
        mins = (datetime.now(timezone.utc) - locked_at).total_seconds() / 60
        if mins < LOCK_MINUTES:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
        await db.login_attempts.delete_one({"identifier": ident})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"updated_at": now_iso()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    await db.login_attempts.delete_one({"identifier": ident})
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    user.pop("_id", None)
    return {"user": _public(user), "access_token": access}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    business = await db.businesses.find_one({"org_id": user["org_id"]}, NO_ID)
    return {"user": user, "business": business, "onboarded": business is not None}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]}, NO_ID)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    return {"ok": True, "access_token": access}
