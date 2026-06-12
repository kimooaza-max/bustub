"""Student section.

From the spec:
  * Languages:
      - personal dictionary (one collection per student)
      - shadowing (mp3s uploaded by teachers)
      - reading / writing / listening / speaking practice (teacher-uploaded)
  * Arabic:
      - استشهادات collection (آيات قرآنية / أحاديث نبوية) — a personal
        dictionary, but for citations only.
  * Any subject:
      - submit work and receive detailed AI feedback.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from .. import ai, config
from ..database import get_session
from ..deps import require_student
from ..models import (
    DictionaryEntry,
    Feedback,
    IstishhadEntry,
    Outcome,
    PracticeMaterial,
    ShadowingClip,
    Subject,
    Submission,
    User,
)
from ..templating import templates

router = APIRouter(prefix="/student", tags=["student"])


@router.get("", response_class=HTMLResponse)
def dashboard(
    request: Request,
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    subjects = session.exec(select(Subject)).all()
    return templates.TemplateResponse(
        "student_dashboard.html",
        {"request": request, "user": student, "subjects": subjects},
    )


# --------------------------- Personal dictionary --------------------------- #
@router.get("/dictionary", response_class=HTMLResponse)
def dictionary(
    request: Request,
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    entries = session.exec(
        select(DictionaryEntry)
        .where(DictionaryEntry.student_id == student.id)
        .order_by(DictionaryEntry.id.desc())
    ).all()
    return templates.TemplateResponse(
        "student_dictionary.html",
        {"request": request, "user": student, "entries": entries},
    )


@router.post("/dictionary")
def add_dictionary_entry(
    term: str = Form(...),
    meaning: str = Form(""),
    language: str = Form(""),
    example: str = Form(""),
    notes: str = Form(""),
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    session.add(
        DictionaryEntry(
            student_id=student.id,
            term=term,
            meaning=meaning,
            language=language,
            example=example,
            notes=notes,
        )
    )
    session.commit()
    return RedirectResponse("/student/dictionary", status_code=status.HTTP_303_SEE_OTHER)


# ----------------------- Arabic استشهادات collection ----------------------- #
@router.get("/istishhadat", response_class=HTMLResponse)
def istishhadat(
    request: Request,
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    entries = session.exec(
        select(IstishhadEntry)
        .where(IstishhadEntry.student_id == student.id)
        .order_by(IstishhadEntry.id.desc())
    ).all()
    return templates.TemplateResponse(
        "student_istishhadat.html",
        {
            "request": request,
            "user": student,
            "entries": entries,
            "kinds": config.ISTISHHAD_TYPES,
        },
    )


@router.post("/istishhadat")
def add_istishhad(
    text: str = Form(...),
    kind: str = Form("ayah"),
    reference: str = Form(""),
    usage_note: str = Form(""),
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    if kind not in config.ISTISHHAD_TYPES:
        kind = "ayah"
    session.add(
        IstishhadEntry(
            student_id=student.id,
            kind=kind,
            text=text,
            reference=reference,
            usage_note=usage_note,
        )
    )
    session.commit()
    return RedirectResponse(
        "/student/istishhadat", status_code=status.HTTP_303_SEE_OTHER
    )


# ------------------- Shadowing + skills practice (per subject) -------------- #
@router.get("/subjects/{subject_id}", response_class=HTMLResponse)
def subject_view(
    subject_id: int,
    request: Request,
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    subject = session.get(Subject, subject_id)
    if subject is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Subject not found")
    clips = session.exec(
        select(ShadowingClip).where(ShadowingClip.subject_id == subject_id)
    ).all()
    practice = session.exec(
        select(PracticeMaterial).where(PracticeMaterial.subject_id == subject_id)
    ).all()
    by_skill = {s: [p for p in practice if p.skill == s] for s in config.LANGUAGE_SKILLS}
    return templates.TemplateResponse(
        "student_subject.html",
        {
            "request": request,
            "user": student,
            "subject": subject,
            "clips": clips,
            "by_skill": by_skill,
            "skills": config.LANGUAGE_SKILLS,
        },
    )


# ------------------------ Detailed feedback (any subject) ------------------- #
@router.post("/subjects/{subject_id}/submit")
def submit_work(
    subject_id: int,
    title: str = Form(""),
    content: str = Form(...),
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    subject = session.get(Subject, subject_id)
    if subject is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Subject not found")

    submission = Submission(
        student_id=student.id, subject_id=subject_id, title=title, content=content
    )
    session.add(submission)
    session.commit()
    session.refresh(submission)

    latest_outcome = session.exec(
        select(Outcome)
        .where(Outcome.subject_id == subject_id)
        .order_by(Outcome.id.desc())
    ).first()
    outcome_text = latest_outcome.content if latest_outcome else ""

    fb = ai.generate_detailed_feedback(content, outcome_text)
    feedback = Feedback(
        submission_id=submission.id,
        summary=fb.summary,
        detailed=fb.detailed,
        score=fb.score,
    )
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    return RedirectResponse(
        f"/student/feedback/{feedback.id}", status_code=status.HTTP_303_SEE_OTHER
    )


@router.get("/feedback/{feedback_id}", response_class=HTMLResponse)
def view_feedback(
    feedback_id: int,
    request: Request,
    student: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    feedback = session.get(Feedback, feedback_id)
    if feedback is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Feedback not found")
    submission = session.get(Submission, feedback.submission_id)
    if submission is None or submission.student_id != student.id:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Not your feedback")
    return templates.TemplateResponse(
        "student_feedback.html",
        {
            "request": request,
            "user": student,
            "feedback": feedback,
            "submission": submission,
        },
    )
