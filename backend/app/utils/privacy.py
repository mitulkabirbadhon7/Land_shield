from __future__ import annotations
from typing import Any

STAFF_ROLES: set[str] = {"registrar", "officer", "admin"}


def mask_name(name: str | None) -> str:
    """Mask a person's display name to protect privacy in public outputs.

    Keeps the first and last character of each word with '***' in between.
    Supports both Bangla and Latin scripts, handling short words gracefully.

    Examples:
        "রহিম উদ্দিন" -> "র***ম উ***ন"
        "John Doe"    -> "J***n D***e"
        "Md Ali"      -> "M***d A***i"
        "A"           -> "A***"
    """
    if not name:
        return ""

    words = name.strip().split()
    if not words:
        return ""

    masked_words: list[str] = []
    for word in words:
        if len(word) <= 1:
            masked_words.append(f"{word}***")
        elif len(word) == 2:
            masked_words.append(f"{word[0]}***{word[1]}")
        else:
            masked_words.append(f"{word[0]}***{word[-1]}")

    return " ".join(masked_words)


def is_staff_viewer(viewer: Any) -> bool:
    """Check if the requesting viewer has authorized staff permissions."""
    if viewer is None:
        return False
    if isinstance(viewer, str):
        return viewer.strip().lower() in STAFF_ROLES
    if hasattr(viewer, "role"):
        return str(viewer.role).strip().lower() in STAFF_ROLES
    return False


class PersonView:
    """Centralized privacy-aware presentation view for personal entities."""

    def __init__(
        self,
        name: str,
        identifier: Any | None = None,
        is_masked: bool = True,
        raw_name: str | None = None,
    ) -> None:
        self.name = name
        self.identifier = identifier
        self.is_masked = is_masked
        self.raw_name = raw_name or name

    def __str__(self) -> str:
        return self.name

    def __repr__(self) -> str:
        return f"PersonView(name={self.name!r}, identifier={self.identifier!r}, is_masked={self.is_masked})"

    def __getitem__(self, item: str) -> Any:
        if item in ("name", "display_name"):
            return self.name
        if item in ("identifier", "id"):
            return self.identifier
        if item == "is_masked":
            return self.is_masked
        if item == "raw_name":
            return self.raw_name
        raise KeyError(item)

    def get(self, item: str, default: Any = None) -> Any:
        try:
            return self[item]
        except KeyError:
            return default

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "identifier": self.identifier,
            "is_masked": self.is_masked,
        }


def person_view(person: Any, viewer: Any = None) -> PersonView:
    """Centralized serialization helper enforcing role-based privacy redaction.

    - Anonymous / citizen viewers: returns masked name (e.g. 'Md. A*** R***')
      and redacts internal database primary keys and NID hashes.
    - Authenticated staff (registrar, officer, admin): returns full synthetic name
      and permitted identifiers.
    """
    if person is None:
        return PersonView(name="", identifier=None, is_masked=True, raw_name="")

    raw_name = ""
    raw_id: Any | None = None

    if isinstance(person, str):
        raw_name = person.strip()
    elif hasattr(person, "display_name"):
        raw_name = getattr(person, "display_name", "") or ""
        raw_id = getattr(person, "id", None)
    elif isinstance(person, dict):
        raw_name = person.get("display_name") or person.get("name") or ""
        raw_id = person.get("id") or person.get("identifier")
    else:
        raw_name = str(person)

    staff = is_staff_viewer(viewer)

    if staff:
        return PersonView(
            name=raw_name,
            identifier=raw_id,
            is_masked=False,
            raw_name=raw_name,
        )

    # Citizen / anonymous view
    masked = mask_name(raw_name)
    return PersonView(
        name=masked,
        identifier=None,  # Exclude internal PK / NID hash from public view
        is_masked=True,
        raw_name=raw_name,
    )
