# Educational System — DRAFT

A two-section learning platform built with **FastAPI** + SQLite. The AI layer
is **stubbed** (deterministic placeholders) with clearly marked swap-in points
for a real model (e.g. the Claude API).

> ⚠️ This is an early draft / prototype. It is **not** production-ready
> (auth, file handling, and the AI layer all need hardening). See *Roadmap*.

## Sections

### 1 · Teachers
1. Teacher logs in.
2. For each subject, the system asks for the **learning outcome** → teacher
   uploads it (paste text or a file).
3. The AI **analyses the outcome** and generates aligned questions.
4. The system asks for **past papers** → teacher uploads them.
5. The AI generates fresh, similar questions and can teach the curriculum,
   grounded in both the outcome and the past papers.

Language subjects also let teachers upload:
- **Shadowing** clips (`.mp3` / `.wav` / `.m4a` / `.ogg`).
- **Practice material** for reading / writing / listening / speaking.

### 2 · Students
- **Personal dictionary** — each student's own vocabulary collection.
- **استشهادات** — a personal collection of آيات قرآنية وأحاديث نبوية for use in
  Arabic writing (like a dictionary, but for citations only).
- **Shadowing** + **reading/writing/listening/speaking** practice (the material
  teachers uploaded in their section).
- **Detailed feedback** — submit work for any subject and get long-form,
  criterion-by-criterion AI feedback.

## Run it

```bash
cd edu_system
./run.sh            # creates a venv, installs deps, serves on :8000
# then open http://localhost:8000
```

Demo accounts (auto-seeded on first run):

| role    | username  | password    |
|---------|-----------|-------------|
| teacher | `teacher` | `teacher123`|
| student | `student` | `student123`|

## Deploy to Render (open it from any device, incl. a tablet)

This repo ships a `render.yaml` blueprint at its root. To get a public URL:

1. Go to **[render.com](https://render.com)** and sign in with GitHub (free).
2. **New +** → **Blueprint** → connect the `kimooaza-max/bustub` repo.
3. Render reads `render.yaml`, builds, and deploys automatically.
4. Open the URL it gives you (e.g. `https://edu-system.onrender.com`) in any
   browser — phone, tablet, or computer.

> **Note (free tier):** the service sleeps after ~15 min idle (first request
> then takes ~30s to wake), and storage is **ephemeral** — the SQLite database
> and uploaded files reset on each redeploy/restart. Fine for a draft demo; add
> a managed Postgres + object storage before relying on it.

## Test

```bash
cd edu_system
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt pytest
./.venv/bin/pytest          # end-to-end smoke tests, uses a throwaway DB
```

## Layout

```
edu_system/
├── app/
│   ├── main.py          # FastAPI app, middleware, demo-user seeding
│   ├── config.py        # env-driven settings
│   ├── models.py        # SQLModel tables (both sections)
│   ├── database.py      # engine + session
│   ├── security.py      # PBKDF2 password hashing (stdlib only)
│   ├── deps.py          # current-user + role guards
│   ├── storage.py       # validated file uploads
│   ├── templating.py    # Jinja2 env
│   ├── ai/
│   │   ├── __init__.py  # public AI interface
│   │   └── stub.py      # STUBBED model calls (# SWAP-IN markers)
│   ├── routers/         # auth / teachers / students
│   ├── templates/       # server-rendered HTML
│   └── static/          # css
└── tests/test_smoke.py
```

## Swapping in a real model

All model-facing logic lives in [`app/ai/stub.py`](app/ai/stub.py). Each
function has a `# SWAP-IN` comment showing where the real call goes. Replace the
bodies (e.g. with the Claude API) without touching the routers or templates.

## Roadmap (not yet done — this is a draft)
- Real model integration for outcome analysis, question generation, feedback.
- PDF/DOCX text extraction (currently only plain text is parsed).
- Hardened auth (argon2/bcrypt, CSRF, rate limiting), file scanning.
- Per-student progress tracking, spaced repetition for the dictionary.
- Teacher review/editing of AI-generated questions before publishing.
- Speech scoring for shadowing & speaking practice.
