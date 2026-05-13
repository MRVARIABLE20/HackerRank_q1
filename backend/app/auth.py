"""JWT auth, password hashing, role-based dependencies."""
from __future__ import annotations

import datetime as dt
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_session
from .models import User

_settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


class TokenPayload(BaseModel):
    sub: str  # email
    roles: List[str]
    department: str
    exp: int


def hash_password(pw: str) -> str:
    return _pwd.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return _pwd.verify(pw, hashed)


def create_access_token(*, email: str, roles: List[str], department: str) -> str:
    exp = dt.datetime.utcnow() + dt.timedelta(minutes=_settings.jwt_exp_minutes)
    payload = {
        "sub": email,
        "roles": roles,
        "department": department,
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_settings.jwt_algorithm)


class CurrentUser(BaseModel):
    email: str
    roles: List[str]
    department: str


def _decode(token: str) -> TokenPayload:
    try:
        data = jwt.decode(
            token, _settings.jwt_secret, algorithms=[_settings.jwt_algorithm]
        )
        return TokenPayload(**data)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        ) from e


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> CurrentUser:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    payload = _decode(token)
    return CurrentUser(
        email=payload.sub, roles=payload.roles, department=payload.department
    )


def require_roles(*required: str):
    """FastAPI dependency factory to gate routes on any of the listed roles."""

    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not set(required).intersection({r.lower() for r in user.roles}):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {required}",
            )
        return user

    return _dep


def authenticate(session: Session, email: str, password: str) -> Optional[User]:
    user = session.query(User).filter(User.email == email).one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
