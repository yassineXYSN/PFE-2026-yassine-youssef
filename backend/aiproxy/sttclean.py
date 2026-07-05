"""Whisper-family STT output cleaning.

Hallucination and garbage filtering shared by ALL transcription providers
(local faster-whisper and API Whisper hosts hallucinate the same phrases on
silence/noise chunks). Applied centrally by ``aiproxy.transcribe``.

Moved from ``services/transcription.py`` — same heuristics, now provider-agnostic.
"""

# Hallucinations Whisper commonly emits on pure-silence / music / noise chunks.
# Substring match — covers conjugations and partial bleeds.
_HALLUCINATION_SUBSTRINGS = (
    "sous-titres réalisés par la communauté amara",
    "sous-titrage st' 501",
    "sous-titrage société radio-canada",
    "merci d'avoir regardé",
    "thanks for watching",
    "thank you for watching",
    "abonnez-vous",
    "like and subscribe",
    "♪",
    "st' 501",
    "humain.com",
    "tous droits réservés",
    "copyright",
    "mediatranslate",
    "vostfr",
    "retranscription par",
)

# Only patterns that are NEVER real speech — not short words people actually say.
_TRIVIAL_SHORT = {
    "...", ".", "..", "—", "…", "???", "!!!",
}

_PUNCT_STRIP = ".,;:!?\"'()[]{}«»…"


def _normalize_words(text: str) -> list:
    return [w.strip(_PUNCT_STRIP) for w in text.lower().split() if w.strip(_PUNCT_STRIP)]


def _has_repetition_loop(text: str) -> bool:
    """Detect Whisper's classic 'I am running, I am running, I am running' loop.

    Heuristics:
      1. A phrase of 1–5 words repeats >= 3 times anywhere in the output.
      2. Unique-word ratio < 0.4 on utterances of >= 6 words.
    """
    words = _normalize_words(text)
    n = len(words)
    if n < 4:
        # Check for single-word loops like "oui oui oui oui"
        if n >= 3 and len(set(words)) == 1:
            return True
        return False

    # Heuristic 1 — sliding-window phrase repetition (punctuation-insensitive)
    for size in (1, 2, 3, 4, 5):
        if n < size * 3:
            continue
        for i in range(n - size * 3 + 1):
            phrase = words[i : i + size]
            if (
                words[i + size : i + size * 2] == phrase
                and words[i + size * 2 : i + size * 3] == phrase
            ):
                return True

    # Heuristic 2 — vocabulary collapse on longer output
    if n >= 6:
        uniq = len(set(words))
        if uniq / n < 0.4:
            return True

    return False


def is_hallucination(text: str) -> bool:
    t = text.strip().lower()
    if not t:
        return True

    # Check for garbage strings like "!!!!!!!!!" or "........"
    if len(t) > 3 and len(set(t)) <= 2 and not any(c.isalnum() for c in t):
        return True

    stripped = t.strip(_PUNCT_STRIP).strip()
    if not stripped:
        return True
    if stripped in _TRIVIAL_SHORT or stripped.rstrip(".!?,") in _TRIVIAL_SHORT:
        return True
    for needle in _HALLUCINATION_SUBSTRINGS:
        if needle in t:
            return True
    if _has_repetition_loop(t):
        return True

    # Length check for pure garbage (e.g. "x x x x x")
    words = _normalize_words(t)
    if len(words) > 5 and len(set("".join(words))) < 4:
        return True

    return False
