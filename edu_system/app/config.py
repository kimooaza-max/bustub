"""Application configuration.

Everything here is overridable via environment variables so the same code
runs locally, in CI, and (eventually) in a real deployment.
"""
from __future__ import annotations

import os
from pathlib import Path

# Project root: .../edu_system
BASE_DIR = Path(__file__).resolve().parent.parent

# Where uploaded files (outcomes, past papers, mp3 shadowing clips,
# practice material) are stored on disk. Git-ignored.
UPLOAD_DIR = Path(os.environ.get("EDU_UPLOAD_DIR", BASE_DIR / "uploads"))

# SQLite by default — zero-config for a draft. Swap DATABASE_URL for
# Postgres/MySQL later without touching the models.
DATABASE_URL = os.environ.get(
    "EDU_DATABASE_URL", f"sqlite:///{BASE_DIR / 'edu_system.db'}"
)

# Secret used to sign session cookies. MUST be overridden in production.
SECRET_KEY = os.environ.get("EDU_SECRET_KEY", "dev-secret-change-me")

# Allowed upload categories -> permitted extensions (defence in depth).
ALLOWED_AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg"}
ALLOWED_DOC_EXT = {".pdf", ".txt", ".md", ".doc", ".docx"}

# Skills handled by the language practice section.
LANGUAGE_SKILLS = ("reading", "writing", "listening", "speaking")

# Subcategories for the Arabic استشهادات (citations) collection.
ISTISHHAD_TYPES = ("ayah", "hadith")  # آية قرآنية / حديث نبوي


def ensure_dirs() -> None:
    """Create runtime directories if they do not yet exist."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for sub in ("outcomes", "past_papers", "shadowing", "practice"):
        (UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)
