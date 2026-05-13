"""Standalone seed helper — delegates to app.seed (same logic as auto-startup seed).

Usage (from backend/ directory):
    python seed_admin.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.db import init_db
from app.seed import ADMIN_EMAIL, ADMIN_PASSWORD, seed_if_empty

if __name__ == "__main__":
    init_db()
    seed_if_empty()
    print(f"Done. Admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
