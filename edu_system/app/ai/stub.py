"""Stubbed AI implementations.

These are deterministic, dependency-free placeholders that mimic the SHAPE of
real model output (so the UI and database can be built and tested end-to-end).
Each function carries a `# SWAP-IN` marker showing exactly where a real model
call goes.

Example real implementation (Claude API)::

    from anthropic import Anthropic
    client = Anthropic()  # reads ANTHROPIC_API_KEY
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse(msg.content[0].text)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class DraftQuestion:
    prompt: str
    model_answer: str
    difficulty: str = "medium"
    topic: str = ""


@dataclass
class OutcomeAnalysis:
    topics: list[str] = field(default_factory=list)
    competencies: list[str] = field(default_factory=list)
    summary: str = ""


@dataclass
class DetailedFeedback:
    summary: str
    detailed: str
    score: float


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _extract_topics(text: str, limit: int = 8) -> list[str]:
    """Cheap keyword/line extraction standing in for model topic detection."""
    lines = [ln.strip(" -*•\t") for ln in text.splitlines() if ln.strip()]
    topics: list[str] = []
    for ln in lines:
        # Strip leading "1." / "a)" style numbering.
        ln = re.sub(r"^\(?[0-9a-zA-Z][.)]\s*", "", ln).strip()
        if 3 <= len(ln) <= 120:
            topics.append(ln)
        if len(topics) >= limit:
            break
    return topics or ["General concepts"]


# --------------------------------------------------------------------------- #
# Public API (stubbed)
# --------------------------------------------------------------------------- #
def analyze_outcome(outcome_text: str) -> OutcomeAnalysis:
    """Break a learning-outcome document into topics + competencies."""
    # SWAP-IN: send `outcome_text` to the model and parse structured topics.
    topics = _extract_topics(outcome_text)
    competencies = [f"Be able to apply: {t}" for t in topics[:5]]
    summary = (
        f"[stub] Detected {len(topics)} topic(s) in the uploaded outcome. "
        "A real model would cluster these into competencies and Bloom levels."
    )
    return OutcomeAnalysis(topics=topics, competencies=competencies, summary=summary)


def generate_questions_from_outcome(
    outcome_text: str, count: int = 5
) -> list[DraftQuestion]:
    """Generate questions aligned to the learning outcomes."""
    # SWAP-IN: ask the model for `count` questions grounded in the outcome.
    analysis = analyze_outcome(outcome_text)
    difficulties = ["easy", "medium", "hard"]
    questions: list[DraftQuestion] = []
    for i in range(count):
        topic = analysis.topics[i % len(analysis.topics)]
        questions.append(
            DraftQuestion(
                prompt=f"[stub] Explain and give an example of: {topic}",
                model_answer=f"[stub] A complete answer would cover {topic} "
                "with definitions, an example, and a common misconception.",
                difficulty=difficulties[i % len(difficulties)],
                topic=topic,
            )
        )
    return questions


def generate_questions_from_past_paper(
    past_paper_text: str, outcome_text: str = "", count: int = 5
) -> list[DraftQuestion]:
    """Generate fresh questions in the style of a past paper, aligned to outcomes."""
    # SWAP-IN: give the model the past paper + outcome; ask for new, similar
    # questions (not copies) that stay within the taught curriculum.
    topics = _extract_topics(past_paper_text or outcome_text)
    questions: list[DraftQuestion] = []
    for i in range(count):
        topic = topics[i % len(topics)]
        questions.append(
            DraftQuestion(
                prompt=f"[stub] (past-paper style) Question on: {topic}",
                model_answer=f"[stub] Worked solution for {topic}.",
                difficulty="medium",
                topic=topic,
            )
        )
    return questions


def generate_detailed_feedback(
    submission_text: str, outcome_text: str = ""
) -> DetailedFeedback:
    """Produce long-form, criterion-by-criterion feedback for any subject."""
    # SWAP-IN: send submission (+ outcome/rubric) to the model for grading.
    words = len(submission_text.split())
    criteria = [
        ("Content & accuracy", "Addresses the task; claims are supported."),
        ("Structure & coherence", "Logical flow with clear paragraphing."),
        ("Language & mechanics", "Grammar, spelling, and vocabulary range."),
        ("Alignment to outcomes", "Covers the targeted learning outcomes."),
    ]
    detailed_lines = ["[stub] Detailed feedback (criterion by criterion):", ""]
    for name, desc in criteria:
        detailed_lines.append(f"• {name}: {desc} — needs concrete examples.")
    detailed_lines += [
        "",
        f"Length: ~{words} words.",
        "Next steps: revise the weakest criterion above and resubmit.",
    ]
    score = max(0.0, min(100.0, 40 + min(words, 300) / 6))
    return DetailedFeedback(
        summary="[stub] Solid attempt; tighten structure and add examples.",
        detailed="\n".join(detailed_lines),
        score=round(score, 1),
    )


def teach_topic(topic: str, outcome_text: str = "") -> str:
    """Return a short teaching explanation for a topic, within the curriculum."""
    # SWAP-IN: ask the model to teach `topic` constrained to the outcome.
    return (
        f"[stub] Mini-lesson on '{topic}':\n"
        "1) Definition  2) Why it matters  3) Worked example  4) Check question.\n"
        "A real model would adapt depth to the uploaded outcome & curriculum."
    )
