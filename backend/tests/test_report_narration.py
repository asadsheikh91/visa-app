"""
tests/test_report_narration.py

Unit tests for the narration layer of the Readiness Report:
  - report_verdict.render_verdict  (pure template library, engine-authored prose)
  - narration_fallback             (deterministic, always valid)
  - gemini_narrator._validate      (schema-lock: id set + no foreign numbers)
  - gemini_narrator.narrate        (structured-output happy path, mocked SDK)
  - report_cache.compute_cache_key (stability + version sensitivity)

No network, no DB.
"""

import json

import pytest

from schemas.report import GeminiFindingInput, GeminiNarration
from services import narration_fallback as nf
from services import report_cache as rc
from services import report_verdict as rv
from services import gemini_narrator as gn
from services.gemini_narrator import NarrationError


def _inp(id="critical:q1", severity="critical", title="Funds low",
         category="Funds", raw="declared funds below the required minimum",
         ctx=("Governing authority: IRCC.",)):
    return GeminiFindingInput(id=id, severity=severity, title=title,
                              category=category, rawSignal=raw, policyContext=list(ctx))


# ---------------------------------------------------------------------------
# render_verdict
# ---------------------------------------------------------------------------

class TestRenderVerdict:
    def test_conditional_with_critical_mentions_count(self):
        lead, crs = rv.render_verdict("conditional", 3, 1, None, None)
        assert "viable pathway" in lead
        assert "three critical gaps" in lead.lower()
        assert crs == ""  # no CRS for None

    def test_critical_tier_is_not_ready(self):
        lead, _ = rv.render_verdict("critical", 2, 0, None, None)
        assert "not ready to submit" in lead.lower()

    def test_ready_clean_is_positive(self):
        lead, _ = rv.render_verdict("ready", 0, 0, None, None)
        assert "competitive" in lead.lower()

    def test_crs_note_only_when_est_crs_present(self):
        _, crs = rv.render_verdict("conditional", 1, 0, 412, "the low-500s")
        assert "412" in crs and "low-500s" in crs

    def test_count_phrase_singular_plural(self):
        one, _ = rv.render_verdict("high_risk", 1, 0, None, None)
        many, _ = rv.render_verdict("high_risk", 4, 0, None, None)
        assert "one critical issue" in one.lower()
        assert "four critical issues" in many.lower()


# ---------------------------------------------------------------------------
# fallback narrator
# ---------------------------------------------------------------------------

class TestFallback:
    def test_covers_every_input_in_order(self):
        inputs = [_inp(id="critical:q1"), _inp(id="high:q2", severity="high")]
        out = nf.fallback_narrations(inputs)
        assert [n.id for n in out] == ["critical:q1", "high:q2"]

    def test_all_prose_fields_populated(self):
        n = nf.fallback_narrations([_inp()])[0]
        assert n.explanation and n.impact
        assert len(n.fixSteps) >= 1 and len(n.bestPractices) >= 1

    def test_severity_drives_impact_language(self):
        crit = nf.fallback_narration(_inp(severity="critical"))
        med = nf.fallback_narration(_inp(severity="medium"))
        assert "critical" in crit.impact.lower()
        assert crit.impact != med.impact

    def test_introduces_no_number_absent_from_input(self):
        # rawSignal/title/category carry no digits → fallback must carry none either.
        n = nf.fallback_narration(_inp(raw="declared funds below the required minimum", ctx=()))
        blob = " ".join([n.explanation, n.impact, *n.fixSteps, *n.bestPractices])
        assert not any(ch.isdigit() for ch in blob)


# ---------------------------------------------------------------------------
# gemini_narrator._validate  (schema lock)
# ---------------------------------------------------------------------------

def _narr(id="critical:q1", explanation="You did not show enough funds.",
          impact="It matters.", fix=None, best=None):
    return GeminiNarration(id=id, explanation=explanation, impact=impact,
                           fixSteps=fix or ["Do X."], bestPractices=best or ["Keep copies."])


class TestValidate:
    def test_accepts_matching_ids(self):
        gn._validate([_narr()], [_inp()])  # no raise

    def test_rejects_extra_finding(self):
        with pytest.raises(NarrationError):
            gn._validate([_narr(), _narr(id="high:q2")], [_inp()])

    def test_rejects_missing_finding(self):
        with pytest.raises(NarrationError):
            gn._validate([], [_inp()])

    def test_rejects_duplicate_id(self):
        with pytest.raises(NarrationError):
            gn._validate([_narr(), _narr()], [_inp()])

    def test_rejects_foreign_number(self):
        with pytest.raises(NarrationError):
            gn._validate([_narr(explanation="You must show 20635 dollars.")], [_inp()])

    def test_allows_number_present_in_policy_context(self):
        inp = _inp(ctx=("IRCC requires CAD 20635 for a single applicant.",))
        gn._validate([_narr(explanation="Guidance indicates 20635 is required.")], [inp])

    def test_schema_forbids_extra_field(self):
        # extra='forbid' on the Pydantic model rejects a hallucinated field.
        payload = json.dumps({"narrations": [{
            "id": "critical:q1", "explanation": "e", "impact": "i",
            "fixSteps": [], "bestPractices": [], "score": 99,
        }]})
        from schemas.report import GeminiNarrationResponse
        with pytest.raises(Exception):
            GeminiNarrationResponse.model_validate_json(payload)


# ---------------------------------------------------------------------------
# gemini_narrator.narrate  (mocked SDK, structured-output happy path)
# ---------------------------------------------------------------------------

class _FakeResp:
    def __init__(self, text):
        self.text = text


class _FakeModels:
    def __init__(self, text):
        self._text = text
        self.calls = []

    def generate_content(self, model, contents, config):
        self.calls.append((model, contents, config))
        return _FakeResp(self._text)


class _FakeClient:
    def __init__(self, text):
        self.models = _FakeModels(text)


class _FakeTypes:
    def GenerateContentConfig(self, **kw):
        return kw

    def HttpOptions(self, **kw):
        return kw


def test_narrate_returns_in_input_order(monkeypatch):
    inputs = [_inp(id="critical:q1"), _inp(id="high:q2", severity="high", category="Language",
                                           raw="language below competitive band")]
    # Gemini returns them REVERSED — narrate must reorder to match inputs.
    body = json.dumps({"narrations": [
        {"id": "high:q2", "explanation": "Language is short.", "impact": "It matters.",
         "fixSteps": ["Retest."], "bestPractices": ["Practise."]},
        {"id": "critical:q1", "explanation": "Funds are short.", "impact": "It matters.",
         "fixSteps": ["Save."], "bestPractices": ["Keep letters."]},
    ]})
    fake = _FakeClient(body)
    monkeypatch.setattr(gn, "_client", lambda: (fake, _FakeTypes()))
    out = gn.narrate(inputs)
    assert [n.id for n in out] == ["critical:q1", "high:q2"]


def test_narrate_rejects_foreign_number(monkeypatch):
    inputs = [_inp(id="critical:q1", ctx=())]
    body = json.dumps({"narrations": [
        {"id": "critical:q1", "explanation": "Show 99999 dollars.", "impact": "x",
         "fixSteps": [], "bestPractices": []},
    ]})
    monkeypatch.setattr(gn, "_client", lambda: (_FakeClient(body), _FakeTypes()))
    with pytest.raises(NarrationError):
        gn.narrate(inputs)


# ---------------------------------------------------------------------------
# report_cache.compute_cache_key
# ---------------------------------------------------------------------------

class TestCacheKey:
    def test_stable_and_order_independent(self):
        a = rc.compute_cache_key({"x": 1, "y": 2}, "t", "p")
        b = rc.compute_cache_key({"y": 2, "x": 1}, "t", "p")
        assert a == b and len(a) == 64

    def test_sensitive_to_template_version(self):
        a = rc.compute_cache_key({"x": 1}, "t1", "p")
        b = rc.compute_cache_key({"x": 1}, "t2", "p")
        assert a != b

    def test_sensitive_to_prompt_version(self):
        a = rc.compute_cache_key({"x": 1}, "t", "p1")
        b = rc.compute_cache_key({"x": 1}, "t", "p2")
        assert a != b

    def test_no_redis_get_is_none(self, monkeypatch):
        monkeypatch.setattr(rc, "_get_redis", lambda: None)
        assert rc.get_cached_narration("deadbeef") is None
        rc.set_cached_narration("deadbeef", [{"id": "x"}])  # no-op, no raise
