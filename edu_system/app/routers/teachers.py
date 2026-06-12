"""Teacher section.

Flow from the spec:
  1. Teacher logs in.
  2. For each subject, the system asks for the OUTCOME -> teacher uploads it.
  3. The AI analyses the outcome and generates questions.
  4. The system asks for PAST PAPERS -> teacher uploads them.
  5. The AI generates more questions and can teach the curriculum, grounded in
     both the outcome and the past papers.

Plus uploads for the student-facing language tools (shadowing mp3s and
reading/writing/listening/speaking practice material).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Form, Request, UploadFile, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from .. import ai, config
from ..database import get_session
from ..deps import require_teacher
from ..models import (
    GeneratedQuestion,
    Outcome,
    PastPaper,
    PracticeMaterial,
    QuestionSource,
    ShadowingClip,
    Subject,
    User,
)
from ..storage import read_text_best_effort, save_upload
from ..templating import templates

router = APIRouter(prefix="/teacher", tags=["teacher"])


def _owned_subject(session: Session, subject_id: int, teacher: User) -> Subject:
    subject = session.get(Subject, subject_id)
    if subject is None or subject.teacher_id != teacher.id:
        raise_not_found()
    return subject


def raise_not_found():
    from fastapi import HTTPException

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.get("", response_class=HTMLResponse)
def dashboard(
    request: Request,
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subjects = session.exec(
        select(Subject).where(Subject.teacher_id == teacher.id)
    ).all()
    return templates.TemplateResponse(
        "teacher_dashboard.html",
        {"request": request, "user": teacher, "subjects": subjects},
    )


@router.post("/subjects")
def create_subject(
    name: str = Form(...),
    language: str = Form(""),
    is_language: bool = Form(False),
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subject = Subject(
        name=name,
        language=language,
        is_language=bool(is_language),
        teacher_id=teacher.id,
    )
    session.add(subject)
    session.commit()
    session.refresh(subject)
    return RedirectResponse(
        f"/teacher/subjects/{subject.id}", status_code=status.HTTP_303_SEE_OTHER
    )


@router.get("/subjects/{subject_id}", response_class=HTMLResponse)
def subject_detail(
    subject_id: int,
    request: Request,
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subject = _owned_subject(session, subject_id, teacher)
    outcomes = session.exec(
        select(Outcome).where(Outcome.subject_id == subject_id)
    ).all()
    papers = session.exec(
        select(PastPaper).where(PastPaper.subject_id == subject_id)
    ).all()
    questions = session.exec(
        select(GeneratedQuestion).where(GeneratedQuestion.subject_id == subject_id)
    ).all()
    clips = session.exec(
        select(ShadowingClip).where(ShadowingClip.subject_id == subject_id)
    ).all()
    practice = session.exec(
        select(PracticeMaterial).where(PracticeMaterial.subject_id == subject_id)
    ).all()
    return templates.TemplateResponse(
        "teacher_subject.html",
        {
            "request": request,
            "user": teacher,
            "subject": subject,
            "outcomes": outcomes,
            "papers": papers,
            "questions": questions,
            "clips": clips,
            "practice": practice,
            "skills": config.LANGUAGE_SKILLS,
        },
    )


# --- Step 2 & 3: upload outcome -> AI analyses + generates questions -------- #
@router.post("/subjects/{subject_id}/outcome")
def upload_outcome(
    subject_id: int,
    content: str = Form(""),
    file: UploadFile | None = None,
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subject = _owned_subject(session, subject_id, teacher)
    file_path, text = "", content
    if file is not None and file.filename:
        file_path, data = save_upload(file, "outcomes", config.ALLOWED_DOC_EXT)
        text = content or read_text_best_effort(data)

    outcome = Outcome(subject_id=subject.id, content=text, file_path=file_path)
    session.add(outcome)
    session.commit()
    session.refresh(outcome)

    # AI: analyse the outcome and generate aligned questions.
    for q in ai.generate_questions_from_outcome(text, count=5):
        session.add(
            GeneratedQuestion(
                subject_id=subject.id,
                source=QuestionSource.outcome,
                source_ref_id=outcome.id,
                prompt=q.prompt,
                model_answer=q.model_answer,
                difficulty=q.difficulty,
                topic=q.topic,
            )
        )
    session.commit()
    return RedirectResponse(
        f"/teacher/subjects/{subject_id}", status_code=status.HTTP_303_SEE_OTHER
    )


# --- Step 4 & 5: upload past paper -> AI generates more questions ----------- #
@router.post("/subjects/{subject_id}/past-paper")
def upload_past_paper(
    subject_id: int,
    title: str = Form(""),
    content: str = Form(""),
    file: UploadFile | None = None,
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subject = _owned_subject(session, subject_id, teacher)
    file_path, text = "", content
    if file is not None and file.filename:
        file_path, data = save_upload(file, "past_papers", config.ALLOWED_DOC_EXT)
        text = content or read_text_best_effort(data)

    paper = PastPaper(
        subject_id=subject.id, title=title, content=text, file_path=file_path
    )
    session.add(paper)
    session.commit()
    session.refresh(paper)

    latest_outcome = session.exec(
        select(Outcome)
        .where(Outcome.subject_id == subject.id)
        .order_by(Outcome.id.desc())
    ).first()
    outcome_text = latest_outcome.content if latest_outcome else ""

    for q in ai.generate_questions_from_past_paper(text, outcome_text, count=5):
        session.add(
            GeneratedQuestion(
                subject_id=subject.id,
                source=QuestionSource.past_paper,
                source_ref_id=paper.id,
                prompt=q.prompt,
                model_answer=q.model_answer,
                difficulty=q.difficulty,
                topic=q.topic,
            )
        )
    session.commit()
    return RedirectResponse(
        f"/teacher/subjects/{subject_id}", status_code=status.HTTP_303_SEE_OTHER
    )


# --- Language tools: shadowing mp3 + skills practice ------------------------ #
@router.post("/subjects/{subject_id}/shadowing")
def upload_shadowing(
    subject_id: int,
    title: str = Form(""),
    transcript: str = Form(""),
    file: UploadFile = ...,
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subject = _owned_subject(session, subject_id, teacher)
    file_path, _ = save_upload(file, "shadowing", config.ALLOWED_AUDIO_EXT)
    session.add(
        ShadowingClip(
            subject_id=subject.id,
            title=title or file.filename,
            transcript=transcript,
            file_path=file_path,
        )
    )
    session.commit()
    return RedirectResponse(
        f"/teacher/subjects/{subject_id}", status_code=status.HTTP_303_SEE_OTHER
    )


@router.post("/subjects/{subject_id}/practice")
def upload_practice(
    subject_id: int,
    skill: str = Form("reading"),
    title: str = Form(""),
    description: str = Form(""),
    file: UploadFile | None = None,
    teacher: User = Depends(require_teacher),
    session: Session = Depends(get_session),
):
    subject = _owned_subject(session, subject_id, teacher)
    if skill not in config.LANGUAGE_SKILLS:
        skill = "reading"
    file_path = ""
    if file is not None and file.filename:
        file_path, _ = save_upload(
            file, "practice", config.ALLOWED_DOC_EXT | config.ALLOWED_AUDIO_EXT
        )
    session.add(
        PracticeMaterial(
            subject_id=subject.id,
            skill=skill,
            title=title,
            description=description,
            file_path=file_path,
        )
    )
    session.commit()
    return RedirectResponse(
        f"/teacher/subjects/{subject_id}", status_code=status.HTTP_303_SEE_OTHER
    )
