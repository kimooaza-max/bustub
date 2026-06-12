# Educational System — Project Brief

> A draft / concept document to share with a developer.

## What this is

An early **draft** of an AI-assisted learning platform with two main sections —
one for **teachers** and one for **students**. This document explains the idea,
the features, and what already exists, so a developer can pick it up and build
the full version.

---

## The vision

A single platform where **teachers** upload their curriculum materials (learning
outcomes and past papers), and an **AI** uses those to automatically generate
practice questions and teaching material that stays true to the syllabus.
**Students** then get personalised language-learning tools, an Arabic citations
collection, and detailed AI feedback on their work.

---

## Section 1 — Teachers

The teacher logs in and, for each subject, follows this flow:

1. **Upload the learning outcome** of the subject (paste text or upload a file).
2. **AI analyses the outcome** — breaks it into topics & competencies and
   **generates questions aligned to those outcomes**.
3. **Upload past papers** of the subject.
4. **AI uses outcome + past papers** to generate fresh exam-style questions and
   to **teach the curriculum**, staying within what was taught.

For language subjects, teachers also upload the material students will use:

- **Shadowing audio** — teachers upload the `.mp3` files.
- **Practice material** for the four skills: **reading, writing, listening, speaking**.

---

## Section 2 — Students

### Language tools
- **Personal dictionary** — every student has their own private vocabulary collection.
- **Shadowing** — listen to and repeat the audio clips uploaded by teachers.
- **Reading / Writing / Listening / Speaking** practice — using the material
  uploaded by teachers in their section.

### Arabic — Citations collection (الاستشهادات)

> قسم خاص بالاستشهادات: أحاديث نبوية وآيات قرآنية للكتابة — مثل القاموس الشخصي، لكن للاستشهادات فقط.

- A personal collection (like the dictionary) but dedicated to **Qur'anic verses
  (آيات) and Hadith (أحاديث)** that the student can reuse when writing.
- Each entry stores the text, its reference (sura/verse or narrator/source), and
  a note on when to use it.

### Detailed feedback (any subject)
- A student submits their work for **any** subject and receives **detailed,
  criterion-by-criterion AI feedback** plus a score.

---

## What already exists (the draft)

A working prototype has been built so the structure is concrete and reviewable:

- Full backend with login, teacher & student sections, file uploads, and a
  database covering every feature above.
- Web pages for each screen (including a right-to-left Arabic page for the استشهادات).
- The AI parts are **stubbed** (placeholder logic) with **clearly marked points**
  where a real AI model plugs in — this is the main thing a developer would complete.
- Automated tests covering the main flows (all passing).

| Area | Status in the draft |
|---|---|
| Teacher login, subjects, outcome & past-paper upload | ✅ Built |
| Auto question generation from outcomes / past papers | ✅ Built (AI stubbed) |
| Shadowing audio + 4-skills practice upload | ✅ Built |
| Student personal dictionary | ✅ Built |
| Arabic الاستشهادات collection | ✅ Built |
| Detailed feedback on submissions | ✅ Built (AI stubbed) |
| Real AI model integration | ⬜ To do (developer) |

---

## For the developer

The full source code is in this repository — the application is in the
[`edu_system/`](.) folder.

- **Repository:** https://github.com/kimooaza-max/bustub
- **App folder:** `edu_system/`
- **Read first:** [`edu_system/README.md`](README.md)

**Tech:** Python (FastAPI) + SQLite, server-rendered HTML. Runs with one command
(`./run.sh`) or deploys to any host.

**Suggested next steps for the developer:**

- Replace the stubbed AI with a real model (outcome analysis, question
  generation, feedback) — every spot is marked with a `SWAP-IN` comment in
  [`edu_system/app/ai/stub.py`](app/ai/stub.py).
- Add PDF/Word text extraction for uploaded outcomes & past papers.
- Harden login & file handling; move from SQLite to a managed database.
- Add progress tracking, spaced-repetition for the dictionary, and speech
  scoring for shadowing & speaking.

---

*This is a concept draft intended to communicate the product vision. Features,
naming, and scope are open to change once a developer estimates the full build.*
