"""
document_guidance_engine.py

Document Guidance Module — the core traversal (the moat).

Pure functions — no DB, no I/O. The service loads rows from the DB, resolves each
document's office (incl. the generated map link), and calls build_plan(); see
services/document_guidance_service.py.

Given a user profile + the document DAG, produces the *minimum ordered set* of
documents that specific user needs, prerequisites first, with parallelizable steps
grouped and short-lived documents pushed late so they don't expire. Every node
carries the legal fast-lane (urgent fee / days / online appointment) — never an
informal one.

Inputs (all plain dicts/lists so this is trivially unit-testable):
  documents: [{
    id, name, country_relevance:[str], issuing_authority, official_url,
    normal_cost, urgent_cost, normal_days, urgent_days, validity_months,
    office: {name,authority,address,map_link,hours,online_appointment_url} | None,
    display_order:int, last_verified_at:str, source_url
  }]
  edges:     [{document_id, requires_id, condition|None}]
  profile:   {target_country, education_level, studied_in_pakistan,
              marital_status, documents_already_held:[id]}
  state:     {document_id: "have"|"in_progress"|"done"}   # persisted user progress
"""

from typing import Any, Callable

# Stored progress statuses that mean "this document is obtained".
_SATISFIED = {"have", "done"}


# ---------------------------------------------------------------------------
# Condition predicates
# ---------------------------------------------------------------------------
# Edge conditions gate prerequisite relationships. An unmet condition removes the
# edge; a document introduced *only* by removed edges is then pruned.

def _needs_intermediate_equivalence(profile: dict) -> bool:
    # IBCC equivalence is only relevant when the applicant relies on an
    # intermediate-level qualification (not for degree holders). Honour an explicit
    # flag if provided, else infer from education level.
    if "needs_intermediate_equivalence" in profile:
        return bool(profile["needs_intermediate_equivalence"])
    return str(profile.get("education_level", "")).lower() in {
        "intermediate", "fsc", "fa", "high_school", "a_levels",
    }


_CONDITIONS: dict[str, Callable[[dict], bool]] = {
    "needs_intermediate_equivalence": _needs_intermediate_equivalence,
    "married": lambda p: str(p.get("marital_status", "")).lower() == "married",
    "studied_in_pakistan": lambda p: bool(p.get("studied_in_pakistan")),
}


def _condition_met(condition: str | None, profile: dict) -> bool:
    """True when an edge's condition holds (None/empty → always)."""
    if not condition:
        return True
    predicate = _CONDITIONS.get(condition)
    if predicate is not None:
        return predicate(profile)
    # Unknown condition → fall back to a truthy profile field of the same name.
    return bool(profile.get(condition))


# ---------------------------------------------------------------------------
# Pruning
# ---------------------------------------------------------------------------

def _prune(documents: list[dict], edges: list[dict], profile: dict):
    """
    Returns (kept_docs_by_id, kept_edges).

    1. Keep only documents relevant to the target country.
    2. Drop edges whose condition is unmet.
    3. Drop a document that ends up with NO surviving edges *only if* it had a
       country-relevant edge that was removed by a failed condition (i.e. it was
       conditional-only, like IBCC for a degree holder). Genuinely standalone
       documents (that never had edges) are kept.
    """
    target = str(profile.get("target_country", "")).lower()
    kept = {
        d["id"]: d
        for d in documents
        if target in [str(c).lower() for c in (d.get("country_relevance") or [])]
    }

    # Edges fully inside the relevant set.
    relevant_edges = [
        e for e in edges
        if e["document_id"] in kept and e["requires_id"] in kept
    ]
    surviving = [e for e in relevant_edges if _condition_met(e.get("condition"), profile)]

    docs_with_surviving_edge: set[str] = set()
    for e in surviving:
        docs_with_surviving_edge.add(e["document_id"])
        docs_with_surviving_edge.add(e["requires_id"])

    docs_with_removed_conditional_edge: set[str] = set()
    for e in relevant_edges:
        if e not in surviving:  # removed by condition
            docs_with_removed_conditional_edge.add(e["document_id"])
            docs_with_removed_conditional_edge.add(e["requires_id"])

    pruned: dict[str, dict] = {}
    for doc_id, doc in kept.items():
        if doc_id in docs_with_surviving_edge:
            pruned[doc_id] = doc
        elif doc_id in docs_with_removed_conditional_edge:
            continue  # conditional-only, condition failed → drop
        else:
            pruned[doc_id] = doc  # genuinely standalone → keep

    # Edges restricted to the final document set.
    final_edges = [
        e for e in surviving
        if e["document_id"] in pruned and e["requires_id"] in pruned
    ]
    return pruned, final_edges


# ---------------------------------------------------------------------------
# Graph helpers
# ---------------------------------------------------------------------------

def _prereqs_map(docs: dict, edges: list[dict]) -> dict[str, list[str]]:
    """document_id -> list of its prerequisite ids (requires_id)."""
    m: dict[str, list[str]] = {d: [] for d in docs}
    for e in edges:
        m[e["document_id"]].append(e["requires_id"])
    return m


def _dependents_map(docs: dict, edges: list[dict]) -> dict[str, list[str]]:
    """document_id -> list of ids that depend on it (it unlocks them)."""
    m: dict[str, list[str]] = {d: [] for d in docs}
    for e in edges:
        m[e["requires_id"]].append(e["document_id"])
    return m


def _topo_order(docs: dict, prereqs: dict[str, list[str]]) -> list[str]:
    """Kahn's algorithm; deterministic tie-break by (display_order, id)."""
    indegree = {d: len(prereqs[d]) for d in docs}

    def _key(doc_id: str):
        return (docs[doc_id].get("display_order", 0), doc_id)

    ready = sorted([d for d in docs if indegree[d] == 0], key=_key)
    order: list[str] = []

    # Build dependents from prereqs for decrementing.
    dep_of: dict[str, list[str]] = {d: [] for d in docs}
    for d, ps in prereqs.items():
        for p in ps:
            dep_of[p].append(d)

    while ready:
        node = ready.pop(0)
        order.append(node)
        for child in dep_of[node]:
            indegree[child] -= 1
            if indegree[child] == 0:
                ready.append(child)
        ready.sort(key=_key)

    # Any remaining (cycle safety) appended deterministically.
    if len(order) < len(docs):
        for d in sorted(docs, key=_key):
            if d not in order:
                order.append(d)
    return order


def _satisfied_ids(docs: dict, profile: dict, state: dict) -> set[str]:
    held = set(profile.get("documents_already_held") or [])
    for doc_id, st in (state or {}).items():
        if st in _SATISFIED:
            held.add(doc_id)
    return {d for d in docs if d in held}


# ---------------------------------------------------------------------------
# Ranks (waves): parallelization + validity-window delay
# ---------------------------------------------------------------------------

def _ranks(docs: dict, prereqs: dict, dependents: dict, satisfied: set[str], order: list[str]) -> dict[str, int]:
    """
    rank = depth measured in *outstanding* prerequisites (satisfied/held prereqs
    don't add depth). Docs sharing a rank have no outstanding dependency between
    them → parallelizable. Then validity-bearing docs are pushed as late as their
    dependents allow so short-lived documents aren't scheduled early.
    """
    rank: dict[str, int] = {}
    for d in order:  # topo order guarantees prereqs computed first
        outstanding = [p for p in prereqs[d] if p not in satisfied]
        rank[d] = 0 if not outstanding else 1 + max(rank[p] for p in outstanding)

    max_rank = max(rank.values()) if rank else 0

    # Validity-window delay: push expiring docs to the latest safe wave.
    for d in docs:
        if docs[d].get("validity_months"):
            deps = dependents.get(d, [])
            if not deps:
                latest = max_rank          # leaf → final wave
            else:
                latest = min(rank[dep] for dep in deps) - 1
            rank[d] = max(rank[d], latest)
    return rank


# ---------------------------------------------------------------------------
# Node assembly
# ---------------------------------------------------------------------------

def _status_of(doc_id: str, prereqs: dict, satisfied: set[str], profile: dict, state: dict) -> tuple[str, str]:
    held = set(profile.get("documents_already_held") or [])
    st = (state or {}).get(doc_id)
    if doc_id in held or st in _SATISFIED:
        return ("done" if st == "done" else "have"), ""
    if st == "in_progress":
        return "in_progress", ""
    outstanding = [p for p in prereqs[doc_id] if p not in satisfied]
    if outstanding:
        return "blocked", "needs " + ", ".join(sorted(outstanding)) + " first"
    return "ready", ""


def _fast_lane(doc: dict) -> tuple[dict, dict]:
    office = doc.get("office") or {}
    normal = {"cost": doc.get("normal_cost"), "days": doc.get("normal_days")}
    urgent = {
        "cost": doc.get("urgent_cost"),
        "days": doc.get("urgent_days"),
        "appointment_url": office.get("online_appointment_url"),
    }
    return normal, urgent


def build_plan(documents: list[dict], edges: list[dict], profile: dict, state: dict | None = None) -> dict:
    """
    Produce the OrderedDocumentPlan for `profile`.

    Returns:
      {
        "nodes": [ ordered node dicts ],
        "waves": int,                      # number of parallel groups
        "summary": {total, have, outstanding},
      }
    """
    state = state or {}
    docs, kept_edges = _prune(documents, edges, profile)

    if not docs:
        return {"nodes": [], "waves": 0, "summary": {"total": 0, "have": 0, "outstanding": 0}}

    prereqs = _prereqs_map(docs, kept_edges)
    dependents = _dependents_map(docs, kept_edges)
    order = _topo_order(docs, prereqs)
    satisfied = _satisfied_ids(docs, profile, state)
    rank = _ranks(docs, prereqs, dependents, satisfied, order)

    # Final ordering: by wave, then display_order, then id (keeps topo validity).
    ordered_ids = sorted(order, key=lambda d: (rank[d], docs[d].get("display_order", 0), d))

    name_of = {d: docs[d]["name"] for d in docs}
    nodes: list[dict] = []
    have_count = 0
    for doc_id in ordered_ids:
        doc = docs[doc_id]
        status, blocked_reason = _status_of(doc_id, prereqs, satisfied, profile, state)
        if status in ("have", "done"):
            have_count += 1
        normal, urgent = _fast_lane(doc)
        nodes.append({
            "id":                doc_id,
            "name":              doc["name"],
            "status":            status,
            "blocked_reason":    blocked_reason,
            "issuing_authority": doc.get("issuing_authority"),
            "official_url":      doc.get("official_url"),
            "validity_months":   doc.get("validity_months"),
            "last_verified_at":  doc.get("last_verified_at"),
            "source_url":        doc.get("source_url"),
            "prerequisites":     [name_of[p] for p in prereqs[doc_id]],
            "unlocks":           [name_of[c] for c in dependents[doc_id]],
            "parallel_group":    rank[doc_id],
            "normal":            normal,
            "urgent":            urgent,
            "office":            doc.get("office"),
        })

    waves = (max(rank.values()) + 1) if rank else 0
    return {
        "nodes": nodes,
        "waves": waves,
        "summary": {
            "total":       len(nodes),
            "have":        have_count,
            "outstanding": len(nodes) - have_count,
        },
    }
