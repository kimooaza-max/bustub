"""End-to-end smoke tests exercising both sections via the HTTP API.

Uses a temporary SQLite DB + upload dir so tests never touch real data.
Run with:  cd edu_system && pytest
"""
from __future__ import annotations

import os
import tempfile

import pytest

# Point the app at throwaway storage BEFORE importing it.
_tmp = tempfile.mkdtemp(prefix="edu_test_")
os.environ["EDU_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["EDU_UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["EDU_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, username, password):
    return client.post(
        "/login",
        data={"username": username, "password": password},
        follow_redirects=False,
    )


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_demo_users_seeded_and_login(client):
    r = _login(client, "teacher", "teacher123")
    assert r.status_code == 303
    assert r.headers["location"] == "/teacher"
    client.get("/logout")

    r = _login(client, "student", "student123")
    assert r.status_code == 303
    assert r.headers["location"] == "/student"
    client.get("/logout")


def test_bad_login_rejected(client):
    r = _login(client, "teacher", "wrong")
    assert r.status_code == 401


def test_teacher_outcome_generates_questions(client):
    _login(client, "teacher", "teacher123")
    # Create a subject.
    r = client.post(
        "/teacher/subjects",
        data={"name": "Biology", "language": "", "is_language": ""},
        follow_redirects=False,
    )
    assert r.status_code == 303
    subject_id = int(r.headers["location"].rsplit("/", 1)[1])

    # Upload an outcome -> should generate questions.
    r = client.post(
        f"/teacher/subjects/{subject_id}/outcome",
        data={"content": "Cell structure\nPhotosynthesis\nGenetics basics"},
        follow_redirects=True,
    )
    assert r.status_code == 200
    assert "AI-generated questions" in r.text
    assert "stub" in r.text.lower()
    client.get("/logout")


def test_student_dictionary_and_istishhadat(client):
    _login(client, "student", "student123")

    r = client.post(
        "/student/dictionary",
        data={"term": "ubiquitous", "meaning": "present everywhere",
              "language": "English", "example": "", "notes": ""},
        follow_redirects=True,
    )
    assert r.status_code == 200
    assert "ubiquitous" in r.text

    r = client.post(
        "/student/istishhadat",
        data={"kind": "ayah", "text": "اقرأ باسم ربك الذي خلق",
              "reference": "العلق 1", "usage_note": "في مقدمة عن العلم"},
        follow_redirects=True,
    )
    assert r.status_code == 200
    assert "العلق" in r.text
    client.get("/logout")


def test_student_feedback_flow(client):
    # Teacher makes a subject.
    _login(client, "teacher", "teacher123")
    r = client.post(
        "/teacher/subjects",
        data={"name": "English Essay", "language": "English", "is_language": "true"},
        follow_redirects=False,
    )
    subject_id = int(r.headers["location"].rsplit("/", 1)[1])
    client.get("/logout")

    # Student submits work -> gets detailed feedback.
    _login(client, "student", "student123")
    r = client.post(
        f"/student/subjects/{subject_id}/submit",
        data={"title": "My essay", "content": "This is my essay. " * 20},
        follow_redirects=True,
    )
    assert r.status_code == 200
    assert "Detailed feedback" in r.text
    assert "Score:" in r.text
    client.get("/logout")


def test_role_guard_blocks_student_from_teacher_area(client):
    _login(client, "student", "student123")
    r = client.get("/teacher", follow_redirects=False)
    assert r.status_code == 403
    client.get("/logout")
