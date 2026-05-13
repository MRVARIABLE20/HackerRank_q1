"""Auth endpoints: login, signup, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import (
    CurrentUser,
    authenticate,
    create_access_token,
    get_current_user,
    hash_password,
)
from ..db import get_session
from ..models import Role, User
from ..schemas import LoginRequest, SignupRequest, SignupResponse, TokenResponse

# Only 'user' role can be self-assigned via signup. The 'admin' / 'auditor'
# roles must be granted out-of-band (seed.py or an existing admin) — never
# accept them from public signup, even if the client requests it.
_ALLOWED_SIGNUP_ROLES = {"user"}

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = authenticate(session, body.email, body.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    roles = [r.name for r in user.roles]
    token = create_access_token(
        email=user.email, roles=roles, department=user.department
    )
    return TokenResponse(access_token=token, roles=roles, department=user.department)


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, session: Session = Depends(get_session)) -> SignupResponse:
    # Reject privileged roles at signup
    if body.role not in _ALLOWED_SIGNUP_ROLES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Role must be one of: {', '.join(sorted(_ALLOWED_SIGNUP_ROLES))}",
        )
    # Check duplicate email
    existing = session.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    # Get or create the role row
    role_obj = session.query(Role).filter(Role.name == body.role).first()
    if not role_obj:
        role_obj = Role(name=body.role)
        session.add(role_obj)
        session.flush()
    # Create user
    user = User(
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        department=body.department,
        roles=[role_obj],
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    roles = [r.name for r in user.roles]
    token = create_access_token(
        email=user.email, roles=roles, department=user.department
    )
    return SignupResponse(
        access_token=token,
        roles=roles,
        department=user.department,
        full_name=user.full_name,
    )


@router.get("/me", response_model=CurrentUser)
def me(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return user
