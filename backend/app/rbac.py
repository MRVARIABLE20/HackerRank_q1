"""RBAC primitives.

Classification levels are totally ordered. A user can read documents whose
classification is <= their clearance AND whose ``allowed_roles`` intersects
the user's roles (or is empty = no role restriction beyond classification).

The retriever applies these as Qdrant payload filters — the LLM never makes
access decisions.
"""
from __future__ import annotations

from enum import IntEnum
from typing import Iterable, List


class Classification(IntEnum):
    PUBLIC = 0
    INTERNAL = 1
    CONFIDENTIAL = 2
    RESTRICTED = 3


CLASSIFICATION_NAMES = {c.name.lower(): c for c in Classification}


def parse_classification(value: str | int) -> Classification:
    if isinstance(value, int):
        return Classification(value)
    return CLASSIFICATION_NAMES[value.lower()]


# Role → maximum clearance a holder of that role gets.
ROLE_CLEARANCE: dict[str, Classification] = {
    "user":  Classification.INTERNAL,
    "admin": Classification.RESTRICTED,
}


def max_clearance(roles: Iterable[str]) -> Classification:
    levels = [ROLE_CLEARANCE.get(r.lower(), Classification.PUBLIC) for r in roles]
    return max(levels) if levels else Classification.PUBLIC


def can_access(
    user_roles: List[str],
    doc_classification: Classification,
    doc_allowed_roles: List[str] | None,
) -> bool:
    """Hard predicate used by tests and by the verifier."""
    if max_clearance(user_roles) < doc_classification:
        return False
    if doc_allowed_roles:
        allowed = {r.lower() for r in doc_allowed_roles}
        if not allowed.intersection({r.lower() for r in user_roles}):
            return False
    return True
