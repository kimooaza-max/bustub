"""Disk storage for uploaded files, with extension validation."""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Iterable

from fastapi import HTTPException, UploadFile, status

from . import config


def _check_ext(filename: str, allowed: Iterable[str]) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext or '?'}' not allowed (allowed: {sorted(allowed)})",
        )
    return ext


def save_upload(
    upload: UploadFile, subdir: str, allowed: Iterable[str]
) -> tuple[str, bytes]:
    """Validate + persist an upload under UPLOAD_DIR/subdir.

    Returns (relative_path, raw_bytes). Raw bytes are handy for the stub AI to
    read text content without a second disk read.
    """
    ext = _check_ext(upload.filename, allowed)
    config.ensure_dirs()
    dest_dir = config.UPLOAD_DIR / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / name
    data = upload.file.read()
    dest.write_bytes(data)
    rel = str(dest.relative_to(config.UPLOAD_DIR))
    return rel, data


def read_text_best_effort(data: bytes) -> str:
    """Decode uploaded bytes to text where possible (txt/md). Binary -> ''."""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return data.decode("latin-1")
        except Exception:
            return ""
