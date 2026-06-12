"""Authentication: register, login, logout (session-cookie based)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_user
from ..models import Role, User
from ..security import hash_password, verify_password
from ..templating import templates

router = APIRouter(tags=["auth"])


@router.get("/", response_class=HTMLResponse)
def home(request: Request, user: User | None = Depends(get_current_user)):
    return templates.TemplateResponse(
        "index.html", {"request": request, "user": user}
    )


@router.get("/login", response_class=HTMLResponse)
def login_form(request: Request):
    return templates.TemplateResponse(
        "login.html", {"request": request, "user": None, "error": None}
    )


@router.post("/login")
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "user": None, "error": "Invalid credentials"},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    request.session["user_id"] = user.id
    dest = "/teacher" if user.role == Role.teacher else "/student"
    return RedirectResponse(dest, status_code=status.HTTP_303_SEE_OTHER)


@router.get("/register", response_class=HTMLResponse)
def register_form(request: Request):
    return templates.TemplateResponse(
        "register.html", {"request": request, "user": None, "error": None}
    )


@router.post("/register")
def register(
    request: Request,
    username: str = Form(...),
    full_name: str = Form(""),
    password: str = Form(...),
    role: str = Form("student"),
    session: Session = Depends(get_session),
):
    exists = session.exec(select(User).where(User.username == username)).first()
    if exists:
        return templates.TemplateResponse(
            "register.html",
            {"request": request, "user": None, "error": "Username taken"},
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    user = User(
        username=username,
        full_name=full_name,
        password_hash=hash_password(password),
        role=Role(role) if role in (r.value for r in Role) else Role.student,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    request.session["user_id"] = user.id
    dest = "/teacher" if user.role == Role.teacher else "/student"
    return RedirectResponse(dest, status_code=status.HTTP_303_SEE_OTHER)


@router.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
