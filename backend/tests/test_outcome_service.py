"""
tests/test_outcome_service.py

Module 3 pure logic: outcome validation, prompt timing, approval analytics.
No DB, no I/O.
"""

from datetime import date, timedelta

from services.outcome_service import (
    is_valid_outcome, band_for_score, should_prompt, approval_analytics,
)


# ── validation ───────────────────────────────────────────────────────────────

def test_is_valid_outcome():
    assert is_valid_outcome("approved")
    assert is_valid_outcome("REFUSED")
    assert not is_valid_outcome("maybe")
    assert not is_valid_outcome("")


# ── band_for_score ───────────────────────────────────────────────────────────

def test_band_for_score_buckets():
    assert band_for_score(90)["key"] == "ready"
    assert band_for_score(70)["key"] == "mostly_ready"
    assert band_for_score(50)["key"] == "needs_work"
    assert band_for_score(20)["key"] == "not_ready"


def test_band_for_score_edges_and_invalid():
    assert band_for_score(85)["key"] == "ready"
    assert band_for_score(84)["key"] == "mostly_ready"
    assert band_for_score(None) is None
    assert band_for_score(150) is None


# ── should_prompt ────────────────────────────────────────────────────────────

TODAY = date(2026, 6, 24)


def test_no_check_no_prompt():
    assert should_prompt(None, False, None, TODAY) is False


def test_terminal_outcome_suppresses_prompt():
    old_check = TODAY - timedelta(days=60)
    assert should_prompt(old_check, True, None, TODAY) is False


def test_intake_in_past_prompts():
    recent_check = TODAY - timedelta(days=2)
    intake = TODAY - timedelta(days=1)
    assert should_prompt(recent_check, False, intake, TODAY) is True


def test_old_check_prompts_even_without_intake():
    old_check = TODAY - timedelta(days=30)
    assert should_prompt(old_check, False, None, TODAY) is True


def test_recent_check_future_intake_no_prompt():
    recent_check = TODAY - timedelta(days=3)
    future_intake = TODAY + timedelta(days=60)
    assert should_prompt(recent_check, False, future_intake, TODAY) is False


def test_accepts_iso_strings():
    assert should_prompt("2026-05-01", False, None, TODAY) is True


# ── approval_analytics ───────────────────────────────────────────────────────

def test_analytics_disclosed_band_is_coarsened():
    rows = [
        *[{"score": 90, "outcome": "approved"} for _ in range(8)],
        *[{"score": 90, "outcome": "refused"} for _ in range(2)],
        {"score": 20, "outcome": "refused"},
        {"score": 50, "outcome": "withdrawn"},   # excluded from denominator
    ]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    # disclosed shape: coarsened rate + banded total only
    assert ready["insufficient_data"] is False
    assert ready["approval_rate"] == 80          # 8/10 = 80% -> nearest 10% = 80
    assert ready["total_range"] == "10-20"       # N=10 banded; exact 10 hidden
    # temporal-differencing defense: raw counts and exact N must NOT be present
    assert "approved" not in ready
    assert "refused" not in ready
    assert "total" not in ready


def test_analytics_coarse_rate_rounds_to_nearest_ten():
    # 7 approved / 8 = 87.5% -> rounds to 90% (nearest 10%); exact 7,1,8 hidden.
    rows = [
        *[{"score": 90, "outcome": "approved"} for _ in range(7)],
        {"score": 90, "outcome": "refused"},
    ]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    assert ready["approval_rate"] == 90
    assert ready["total_range"] == "0-10"        # N=8 -> "0-10"
    assert "approved" not in ready and "refused" not in ready


def test_analytics_total_band_ranges():
    def band_for_n(n):
        rows = [{"score": 90, "outcome": "approved"} for _ in range(n)]
        out = approval_analytics(rows, min_sample=5)
        return next(b for b in out["bands"] if b["key"] == "ready")["total_range"]
    assert band_for_n(12) == "10-20"
    assert band_for_n(20) == "20-30"
    assert band_for_n(29) == "20-30"


def test_analytics_hides_rate_below_min_sample():
    rows = [{"score": 90, "outcome": "approved"}, {"score": 90, "outcome": "refused"}]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    assert ready["total"] == 2
    assert ready["approval_rate"] is None


def test_analytics_suppresses_counts_below_min_sample():
    # Privacy fix: below min_sample the approved/refused SPLIT must NOT be
    # exposed (the rate alone being None is not enough — raw counts leak the
    # individual outcomes). This fails on the pre-fix code which returned counts.
    rows = [{"score": 90, "outcome": "approved"}, {"score": 90, "outcome": "refused"}]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    assert ready["insufficient_data"] is True
    assert ready["approved"] is None
    assert ready["refused"] is None
    assert ready["approval_rate"] is None
    assert ready["total"] == 2  # bare band-membership count may remain


def test_analytics_single_decision_cannot_reveal_outcome():
    # The worst case: one person in a band. The endpoint must not disclose
    # whether they were approved or refused.
    rows = [{"score": 95, "outcome": "approved"}]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    assert ready["insufficient_data"] is True
    assert ready["approved"] is None and ready["refused"] is None
    # the literal outcome string must not be recoverable anywhere in the band
    assert "approved" not in {k: v for k, v in ready.items() if v == "approved"}


def test_analytics_overall_suppressed_below_min_sample():
    rows = [{"score": 90, "outcome": "approved"}, {"score": 20, "outcome": "refused"}]
    out = approval_analytics(rows, min_sample=5)
    assert out["overall"]["insufficient_data"] is True
    assert out["overall"]["approved"] is None
    assert out["overall"]["refused"] is None
    assert out["overall"]["approval_rate"] is None


def test_analytics_at_exactly_min_sample_discloses():
    # Boundary: exactly min_sample decisions IS disclosed (>= threshold), but
    # coarsened — no raw counts/exact N.
    rows = [
        *[{"score": 90, "outcome": "approved"} for _ in range(4)],
        {"score": 90, "outcome": "refused"},
    ]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    assert ready["insufficient_data"] is False
    assert ready["approval_rate"] == 80          # 4/5 = 80%
    assert ready["total_range"] == "0-10"        # N=5 -> "0-10"
    assert "approved" not in ready and "total" not in ready


def test_analytics_overall():
    rows = [
        *[{"score": 90, "outcome": "approved"} for _ in range(5)],
        *[{"score": 20, "outcome": "refused"} for _ in range(5)],
    ]
    out = approval_analytics(rows, min_sample=5)
    assert out["overall"]["insufficient_data"] is False
    assert out["overall"]["approval_rate"] == 50
    assert out["overall"]["total_range"] == "10-20"
    assert "approved" not in out["overall"] and "total" not in out["overall"]


def test_analytics_ignores_missing_scores():
    # A None-score row must not be counted into any band. 4 real ready decisions
    # + 1 None-score row -> "ready" stays below min_sample=5 (suppressed); if the
    # None row were wrongly counted it would cross to 5 and disclose.
    rows = [
        *[{"score": 90, "outcome": "approved"} for _ in range(4)],
        {"score": None, "outcome": "approved"},
    ]
    out = approval_analytics(rows, min_sample=5)
    ready = next(b for b in out["bands"] if b["key"] == "ready")
    assert ready["insufficient_data"] is True   # None-score row ignored -> still N=4
    assert ready["total"] == 4
