"""
tests/test_document_guidance_engine.py

Unit tests for the Document Guidance traversal (the moat). Pure, no DB.

Covers: pruning correctness, topological validity, parallel-step detection,
validity-window delay, and per-node status.
"""

from services.document_guidance_engine import build_plan, _condition_met


def _doc(id, name, prereq_country=("uk",), **kw):
    d = {
        "id": id, "name": name, "country_relevance": list(prereq_country),
        "issuing_authority": "Authority", "official_url": "https://gov.example",
        "normal_cost": 100, "urgent_cost": 300, "normal_days": 30, "urgent_days": 5,
        "validity_months": None, "office": None, "display_order": 0,
        "last_verified_at": "2026-01-01", "source_url": "https://src.example",
    }
    d.update(kw)
    return d


# Mirrors the UK persona slice.
def _uk_fixture():
    documents = [
        _doc("cnic", "CNIC"),
        _doc("passport", "Passport"),
        _doc("bachelors_degree", "Bachelor's degree"),
        _doc("bachelors_transcript", "Bachelor's transcript"),
        _doc("hec_attestation", "HEC attestation"),
        _doc("ibcc_equivalence", "IBCC equivalence"),
        _doc("police_character_certificate", "Police character certificate", validity_months=6),
        _doc("tb_test_certificate", "TB test certificate", validity_months=6),
    ]
    edges = [
        {"document_id": "passport", "requires_id": "cnic", "condition": None},
        {"document_id": "hec_attestation", "requires_id": "bachelors_degree", "condition": None},
        {"document_id": "hec_attestation", "requires_id": "bachelors_transcript", "condition": None},
        {"document_id": "hec_attestation", "requires_id": "ibcc_equivalence",
         "condition": "needs_intermediate_equivalence"},
        {"document_id": "tb_test_certificate", "requires_id": "passport", "condition": None},
        {"document_id": "police_character_certificate", "requires_id": "cnic", "condition": None},
    ]
    return documents, edges


MASTERS = {
    "target_country": "uk", "education_level": "masters",
    "studied_in_pakistan": True, "marital_status": "single",
    "documents_already_held": [],
}


def _ids(plan):
    return [n["id"] for n in plan["nodes"]]


def _node(plan, doc_id):
    return next(n for n in plan["nodes"] if n["id"] == doc_id)


# ── Condition predicates ──────────────────────────────────────────────────────

def test_condition_none_always_true():
    assert _condition_met(None, MASTERS) is True


def test_intermediate_condition_false_for_masters():
    assert _condition_met("needs_intermediate_equivalence", MASTERS) is False


def test_intermediate_condition_true_for_intermediate():
    p = {**MASTERS, "education_level": "intermediate"}
    assert _condition_met("needs_intermediate_equivalence", p) is True


# ── Pruning ───────────────────────────────────────────────────────────────────

def test_ibcc_pruned_for_masters_but_cnic_kept():
    docs, edges = _uk_fixture()
    plan = build_plan(docs, edges, MASTERS)
    ids = _ids(plan)
    assert "ibcc_equivalence" not in ids       # conditional-only, condition failed
    assert "cnic" in ids                        # police cert still needs it


def test_ibcc_kept_when_condition_holds():
    docs, edges = _uk_fixture()
    plan = build_plan(docs, edges, {**MASTERS, "education_level": "intermediate"})
    assert "ibcc_equivalence" in _ids(plan)


def test_country_filter_drops_non_uk_docs():
    docs, edges = _uk_fixture()
    docs.append(_doc("us_only_doc", "US only", prereq_country=("usa",)))
    plan = build_plan(docs, edges, MASTERS)
    assert "us_only_doc" not in _ids(plan)


# ── Topological validity ──────────────────────────────────────────────────────

def test_topological_order_prereqs_first():
    docs, edges = _uk_fixture()
    order = _ids(build_plan(docs, edges, MASTERS))
    pos = {d: i for i, d in enumerate(order)}
    # every edge: prerequisite appears before its dependent
    for dep, pre in [("passport", "cnic"), ("hec_attestation", "bachelors_degree"),
                     ("hec_attestation", "bachelors_transcript"),
                     ("tb_test_certificate", "passport"),
                     ("police_character_certificate", "cnic")]:
        assert pos[pre] < pos[dep], f"{pre} should precede {dep}"


# ── Parallel detection ────────────────────────────────────────────────────────

def test_parallel_group_for_independent_docs():
    docs, edges = _uk_fixture()
    plan = build_plan(docs, edges, MASTERS)
    # cnic, bachelors_degree, bachelors_transcript have no outstanding prereqs →
    # same first wave (parallel_group 0).
    groups = {n["id"]: n["parallel_group"] for n in plan["nodes"]}
    assert groups["cnic"] == 0
    assert groups["bachelors_degree"] == 0
    assert groups["bachelors_transcript"] == 0
    # passport depends on cnic → strictly later wave
    assert groups["passport"] > groups["cnic"]


# ── Validity-window delay ─────────────────────────────────────────────────────

def test_validity_docs_pushed_to_last_wave():
    docs, edges = _uk_fixture()
    plan = build_plan(docs, edges, MASTERS)
    groups = {n["id"]: n["parallel_group"] for n in plan["nodes"]}
    last_wave = max(groups.values())
    # police cert (requires only cnic, naturally early) is delayed to the last wave
    assert groups["police_character_certificate"] == last_wave
    assert groups["tb_test_certificate"] == last_wave


# ── Status computation ────────────────────────────────────────────────────────

def test_status_ready_blocked_have():
    docs, edges = _uk_fixture()
    plan = build_plan(docs, edges, {**MASTERS, "documents_already_held": ["cnic"]})
    assert _node(plan, "cnic")["status"] == "have"
    # passport's only prereq (cnic) is held → ready
    assert _node(plan, "passport")["status"] == "ready"
    # hec_attestation needs degree+transcript (not held) → blocked
    hec = _node(plan, "hec_attestation")
    assert hec["status"] == "blocked"
    assert "bachelors_degree" in hec["blocked_reason"]


def test_unlocks_and_fast_lane_present():
    docs, edges = _uk_fixture()
    plan = build_plan(docs, edges, MASTERS)
    cnic = _node(plan, "cnic")
    assert "Passport" in cnic["unlocks"]
    assert cnic["normal"]["cost"] == 100
    assert cnic["urgent"]["days"] == 5
