"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from starlette.middleware.sessions import SessionMiddleware

from . import config
from .database import engine, init_db
from .models import Role, User
from .routers import auth, students, teachers
from .security import hash_password


def _seed_demo_users() -> None:
    """Create demo teacher/student accounts on first run (idempotent)."""
    with Session(engine) as session:
        if session.exec(select(User)).first() is not None:
            return
        session.add(
            User(
                username="teacher",
                full_name="Demo Teacher",
                password_hash=hash_password("teacher123"),
                role=Role.teacher,
            )
        )
        session.add(
            User(
                username="student",
                full_name="Demo Student",
                password_hash=hash_password("student123"),
                role=Role.student,
            )
        )
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_demo_users()
    yield


app = FastAPI(title="Educational System (draft)", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=config.SECRET_KEY)

# Serve uploaded files (mp3 shadowing clips, practice docs) read-only.
config.ensure_dirs()
app.mount("/uploads", StaticFiles(directory=str(config.UPLOAD_DIR)), name="uploads")
app.mount(
    "/static",
    StaticFiles(directory=str(config.BASE_DIR / "app" / "static")),
    name="static",
)

app.include_router(auth.router)
app.include_router(teachers.router)
app.include_router(students.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "app": "edu_system", "version": "0.1.0-draft"}
