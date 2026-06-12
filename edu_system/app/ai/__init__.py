"""AI layer.

Everything model-facing lives behind the functions in ``stub.py`` so the rest
of the app never imports a model SDK directly. Replace the stub
implementations with real calls (e.g. the Claude API) without touching the
routers.
"""
from .stub import (
    analyze_outcome,
    generate_questions_from_outcome,
    generate_questions_from_past_paper,
    generate_detailed_feedback,
    teach_topic,
)

__all__ = [
    "analyze_outcome",
    "generate_questions_from_outcome",
    "generate_questions_from_past_paper",
    "generate_detailed_feedback",
    "teach_topic",
]
