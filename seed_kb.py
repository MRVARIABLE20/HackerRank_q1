"""Seeds Knowledge Base from seeding_data/ folder via REST API.

This script logs in as admin and uploads all documents from seeding_data/
to the KB via POST /kb/docs endpoint.

Usage:
    python seed_kb.py

Prerequisites:
    - Backend running on http://localhost:8001
    - Admin user auto-created (admin@gmail.com / admin123)
    - pip install requests
"""
import json
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: requests library not found.")
    print("Install with: pip install requests")
    sys.exit(1)

API_BASE = "http://localhost:8001"
ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "admin123"


def login():
    """Login as admin and return JWT token."""
    try:
        resp = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Cannot connect to backend at {API_BASE}")
        print("Make sure backend is running: python -m uvicorn app.main:app --port 8001")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"ERROR: Login failed - {e}")
        sys.exit(1)


def seed_document(token, category, title, content):
    """POST a single KB document."""
    try:
        resp = requests.post(
            f"{API_BASE}/kb/docs",
            headers={"Authorization": f"Bearer {token}"},
            json={"category": category, "title": title, "content": content},
            timeout=15,
        )
        resp.raise_for_status()
        print(f"✓ [{category:12}] {title}")
    except requests.exceptions.HTTPError as e:
        print(f"✗ [{category:12}] {title} — FAILED: {e}")


def main():
    # Check if seeding_data exists
    if not Path("seeding_data").exists():
        print("ERROR: seeding_data/ folder not found")
        print("Run this script from project root: C:\\Users\\aayan\\Downloads\\HackerRank_q1")
        sys.exit(1)

    token = login()
    print(f"Logged in as {ADMIN_EMAIL}\n")

    # Map folders to categories
    mappings = [
        ("pdfs", "pdfs"),
        ("sql_csv", "sql_csv"),
        ("json_logs", "json_logs"),
        ("technical", "technical"),
        ("compliance", "compliance"),
        ("operational", "operational"),
    ]

    total = 0
    for folder, category in mappings:
        folder_path = Path("seeding_data") / folder
        if not folder_path.exists():
            print(f"⚠ Skipping {folder}/ (not found)")
            continue

        for file in sorted(folder_path.glob("*")):
            if file.suffix not in [".txt", ".csv", ".json", ".md"]:
                continue

            title = file.stem.replace("_", " ").title()

            try:
                if file.suffix == ".json":
                    with open(file, encoding="utf-8") as f:
                        content = json.dumps(json.load(f), indent=2)
                else:
                    with open(file, encoding="utf-8") as f:
                        content = f.read()

                seed_document(token, category, title, content)
                total += 1
            except Exception as e:
                print(f"✗ [{category:12}] {title} — ERROR reading file: {e}")

    print(f"\n{'='*60}")
    print(f"✅ Seeding complete! {total} documents uploaded.")
    print(f"{'='*60}")
    print("\nNext steps:")
    print("1. Login at http://localhost:5173")
    print("2. Go to Knowledge Base to verify documents")
    print("3. Click 'Open Chat' and ask questions!")


if __name__ == "__main__":
    main()
