"""Shared Jinja2 template environment."""
from __future__ import annotations

from fastapi.templating import Jinja2Templates

from . import config

templates = Jinja2Templates(directory=str(config.BASE_DIR / "app" / "templates"))
