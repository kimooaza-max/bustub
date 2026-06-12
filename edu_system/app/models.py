"""Database models (SQLModel).

These map directly onto the spec's two sections:

Teacher side:
    Subject -> Outcome, PastPaper, GeneratedQuestion, ShadowingClip,
               PracticeMaterial

Student side:
    DictionaryEntry        — personal vocabulary, one collection per student
    IstishhadEntry         — Arabic استشهادات (آيات/أحاديث), personal collection
    Submission + Feedback  — student work + detailed AI feedback (any subject)
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.utcnow()


class Role(str, Enum):
    teacher = "teacher"
    student = "student"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    full_name: str = ""
    password_hash: str = ""
    role: Role = Role.student
    created_at: datetime = Field(default_factory=_now)


class Subject(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    # Free-form language tag ("English", "Arabic", ...) or empty for
    # non-language subjects. Drives which student tools are offered.
    language: str = ""
    is_language: bool = False
    teacher_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=_now)


class Outcome(SQLModel, table=True):
    """Learning outcomes the teacher uploads for a subject."""
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    content: str = ""           # extracted/typed outcome text
    file_path: str = ""         # original uploaded file, if any
    created_at: datetime = Field(default_factory=_now)


class PastPaper(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    title: str = ""
    content: str = ""           # extracted text used by the AI layer
    file_path: str = ""
    created_at: datetime = Field(default_factory=_now)


class QuestionSource(str, Enum):
    outcome = "outcome"
    past_paper = "past_paper"


class GeneratedQuestion(SQLModel, table=True):
    """AI-generated question tied to a subject + its source artefact."""
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    source: QuestionSource = QuestionSource.outcome
    source_ref_id: Optional[int] = None   # Outcome.id or PastPaper.id
    prompt: str = ""
    model_answer: str = ""
    difficulty: str = "medium"
    topic: str = ""
    created_at: datetime = Field(default_factory=_now)


class ShadowingClip(SQLModel, table=True):
    """MP3 shadowing material a teacher uploads for a language subject."""
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    title: str = ""
    transcript: str = ""
    file_path: str = ""
    created_at: datetime = Field(default_factory=_now)


class PracticeMaterial(SQLModel, table=True):
    """Reading / writing / listening / speaking practice uploaded by teacher."""
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    skill: str = "reading"      # one of config.LANGUAGE_SKILLS
    title: str = ""
    description: str = ""
    file_path: str = ""
    created_at: datetime = Field(default_factory=_now)


class DictionaryEntry(SQLModel, table=True):
    """A student's personal dictionary entry."""
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id", index=True)
    language: str = ""
    term: str = ""
    meaning: str = ""
    example: str = ""
    notes: str = ""
    created_at: datetime = Field(default_factory=_now)


class IstishhadEntry(SQLModel, table=True):
    """A student's personal Arabic استشهادات collection entry.

    Like a personal dictionary, but for آيات قرآنية / أحاديث نبوية used
    when writing.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id", index=True)
    kind: str = "ayah"          # one of config.ISTISHHAD_TYPES
    text: str = ""              # نص الآية/الحديث
    reference: str = ""         # المرجع (السورة/رقم الآية أو الراوي/المصدر)
    usage_note: str = ""        # متى تُستخدم في الكتابة
    created_at: datetime = Field(default_factory=_now)


class Submission(SQLModel, table=True):
    """Student work submitted for any subject, to be given detailed feedback."""
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="user.id", index=True)
    subject_id: int = Field(foreign_key="subject.id", index=True)
    title: str = ""
    content: str = ""
    created_at: datetime = Field(default_factory=_now)


class Feedback(SQLModel, table=True):
    """Detailed AI feedback for a submission."""
    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submission.id", index=True)
    summary: str = ""
    detailed: str = ""          # long-form, criterion-by-criterion feedback
    score: Optional[float] = None
    created_at: datetime = Field(default_factory=_now)
