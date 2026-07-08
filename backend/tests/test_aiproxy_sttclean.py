"""Unit tests for aiproxy.sttclean — Whisper hallucination/garbage filtering."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aiproxy.sttclean import is_hallucination


class TestHallucinations:
    def test_empty_is_hallucination(self):
        assert is_hallucination("") is True
        assert is_hallucination("   ") is True

    def test_known_substrings(self):
        assert is_hallucination("Sous-titres réalisés par la communauté Amara") is True
        assert is_hallucination("Thanks for watching!") is True

    def test_repetition_loop(self):
        assert is_hallucination("je cours je cours je cours je cours") is True

    def test_trivial_punctuation(self):
        assert is_hallucination("...") is True

    def test_real_speech_passes(self):
        assert is_hallucination("Bonjour, je m'appelle Yassine et je suis développeur.") is False

    def test_short_valid_answers_pass(self):
        assert is_hallucination("Oui.") is False
        assert is_hallucination("Merci beaucoup.") is False
