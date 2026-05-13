"""Bootstrap seed: creates the admin user on first run.

Called automatically from app startup -- safe to call multiple times (idempotent).
No manual steps needed when moving the project to a new machine.

KB documents are NOT seeded automatically.
Use the files in /seeding_data/ to populate the Knowledge Base via the UI or API.
"""
from __future__ import annotations

import logging

from .auth import hash_password
from .db import SessionLocal
from .models import Role, User

log = logging.getLogger(__name__)

ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "admin123"
ADMIN_FULL_NAME = "System Administrator"


def seed_if_empty() -> None:
    """Idempotent: creates admin user + roles only if they do not exist."""
    session = SessionLocal()
    try:
        admin_role = session.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(name="admin")
            session.add(admin_role)
            session.flush()
            log.info("Seed: created role 'admin'")

        user = session.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not user:
            user = User(
                email=ADMIN_EMAIL,
                full_name=ADMIN_FULL_NAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                department="general",
                roles=[admin_role],
            )
            session.add(user)
            log.info("Seed: created admin user %s (password: %s)", ADMIN_EMAIL, ADMIN_PASSWORD)
        else:
            if admin_role not in user.roles:
                user.roles.append(admin_role)

        session.commit()
    except Exception:
        session.rollback()
        log.exception("Seed failed -- server will continue without seed data")
    finally:
        session.close()
