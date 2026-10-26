"""Deterministically normalize text for bulk processor demonstrations."""

from __future__ import annotations

from typing import Any


def process_text(source_text: str, *, options: dict[str, Any]) -> str:
    """Normalize line endings, trim line-end whitespace, and ensure one final newline."""
    if not isinstance(source_text, str):
        raise TypeError("source_text must be a string")
    if not isinstance(options, dict):
        raise TypeError("options must be a dictionary")
    if options:
        raise ValueError("normalize_text_processor does not accept options")

    normalized_text = source_text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in normalized_text.split("\n")]
    while lines and not lines[-1]:
        lines.pop()

    if not lines:
        return ""
    return "\n".join(lines) + "\n"
