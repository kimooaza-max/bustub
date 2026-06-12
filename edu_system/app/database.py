"""Database engine + session helpers."""
from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from . import config
from . import models  # noqa: F401 — ensure models are registered with metadata

_connect_args = (
    {"check_same_thread": False}
    if config.DATABASE_URL.startswith("sqlite")
    else {}
)
engine = create_engine(config.DATABASE_URL, echo=False, connect_args=_connect_args)


def init_db() -> None:
    """Create tables and runtime directories."""
    config.ensure_dirs()
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a database session."""
    with Session(engine) as session:
        yield session
