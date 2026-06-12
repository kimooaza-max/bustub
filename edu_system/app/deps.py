"""Shared request dependencies: current user + role guards."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from .database import get_session
from .models import Role, User


def get_current_user(
    request: Request, session: Session = Depends(get_session)
) -> Optional[User]:
    """Return the logged-in user from the signed session cookie, or None."""
    user_id = request.session.get("user_id")
    if user_id is None:
        return None
    return session.get(User, user_id)


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required"
        )
    return user


def require_teacher(user: User = Depends(require_user)) -> User:
    if user.role != Role.teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Teachers only"
        )
    return user


def require_student(user: User = Depends(require_user)) -> User:
    if user.role != Role.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Students only"
        )
    return user
