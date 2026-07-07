"""
schemas/report.py

Pydantic mirror of the Downloadable Readiness Report contract. Field-for-field
identical to the TypeScript in frontend/types/report.ts and validated on the
frontend with frontend/lib/reportSchema.ts.

Wire format note: field names are camelCase on purpose so the JSON emitted by
FastAPI is byte-identical to what the Next.js app and Zod expect. There is no
alias translation layer to drift out of sync.

FACTS vs PROSE (constraint #2): every field here is engine/RAG-owned EXCEPT the
four prose fields on `Finding` (explanation, impact, fixSteps, bestPractices),
which are the ONLY fields the Gemini narrator (or its deterministic fallback) may
write. The Gemini* models below are the schema-locked narration contract
(constraint #3): `GeminiNarrationResponse` is the ONLY shape Gemini may return,
and it is parsed with extra="forbid" so any off-schema output is rejected.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["critical", "high", "medium"]
Fill = Literal["pass", "warn", "crit"]
DocStatus = Literal["ready", "pending", "missing"]


class CriterionScore(BaseModel):
    key: str
    label: str
    sublabel: str
    score: float
    fill: Fill


class Source(BaseModel):
    title: str
    url: str
    retrievedAt: str


class Finding(BaseModel):
    id: str
    severity: Severity
    title: str
    category: str
    # ── Gemini-written prose fields (the ONLY LLM-authored content) ──
    explanation: str
    impact: str
    fixSteps: list[str]
    bestPractices: list[str]
    # ── end Gemini-written fields ──
    source: Source


class RoadmapPhase(BaseModel):
    window: str
    theme: str
    items: list[str]


class DocumentItem(BaseModel):
    name: str
    purpose: str
    status: DocStatus  # coarse bucket, drives pill colour
    statusLabel: str  # exact wording the design shows ("Needs revision", …)


class ScoreBand(BaseModel):
    """One meter segment. Country-variable — never hardcoded in the template."""

    label: str
    min: int
    max: int


class Applicant(BaseModel):
    name: str
    targetCountry: str
    pathway: str
    occupationNoc: str
    assessmentDate: str
    age: int
    maritalStatus: str
    dependants: str


class ReportData(BaseModel):
    reportId: str
    issuedAt: str
    dataCurrentAs: str
    applicant: Applicant
    overallScore: float
    band: str
    bandPositionPct: float
    bands: list[ScoreBand]
    # Engine-templated prose (NOT Gemini-authored). Produced by a pure
    # render_verdict() from a reviewed template library and stamped under
    # templateVersion so wording changes bust the narration cache.
    verdictLead: str
    crsNote: str  # "" when CRS is not applicable (non-Canada pathways)
    criteria: list[CriterionScore]
    estCrs: Optional[float] = None
    findings: list[Finding]
    roadmap: list[RoadmapPhase]
    documents: list[DocumentItem]
    prepTime: str
    costRange: str
    sources: list[Source]
    templateVersion: str
    promptVersion: str


# ---------------------------------------------------------------------------
# Gemini narration contract (schema-locked — constraint #3)
# ---------------------------------------------------------------------------


class GeminiFindingInput(BaseModel):
    """What the builder feeds Gemini per finding. Gemini may use ONLY these facts."""

    id: str
    severity: Severity
    title: str
    category: str
    rawSignal: str
    policyContext: list[str]


class GeminiNarration(BaseModel):
    """One narration. extra='forbid' so a hallucinated field is a hard reject."""

    model_config = ConfigDict(extra="forbid")

    id: str
    explanation: str
    impact: str
    fixSteps: list[str]
    bestPractices: list[str]


class GeminiNarrationResponse(BaseModel):
    """The ONLY valid top-level shape Gemini may return."""

    model_config = ConfigDict(extra="forbid")

    narrations: list[GeminiNarration] = Field(default_factory=list)
