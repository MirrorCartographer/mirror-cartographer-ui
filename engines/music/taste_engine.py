"""
Mirror Cartographer Dualpath Taste Engine v1.

Voice-readable behavior:
This module evaluates one artist at a time through two separated paths.
The evidence path judges external breakout signals. The field path judges the internal artistic world.
Neither path receives the other's language or scores before committing. The convergence layer compares only after both paths are locked.

This does not predict fame with certainty. It creates an audited taste decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional
import datetime
import json

Verdict = Literal["add", "incubate", "reject", "revisit"]
ConvergenceStatus = Literal["matched", "partial", "divergent", "unresolved"]


@dataclass
class EvidenceInput:
    artist: str
    audience_intensity: int = 0
    craft_consistency: int = 0
    identity_distinctness: int = 0
    credible_orbit: int = 0
    live_strength: int = 0
    visual_coherence: int = 0
    asymmetry_signal: int = 0
    notes: List[str] = field(default_factory=list)


@dataclass
class FieldInput:
    artist: str
    voice_world: int = 0
    lyrical_charge: int = 0
    symbolic_density: int = 0
    atmosphere: int = 0
    emotional_specificity: int = 0
    productive_weirdness: int = 0
    internal_logic: int = 0
    notes: List[str] = field(default_factory=list)


@dataclass
class LockedPathResult:
    path: str
    artist: str
    score: int
    passed: bool
    reasons: List[str]
    locked: bool = True
    saw_other_path_before_lock: bool = False


@dataclass
class TasteDecision:
    artist: str
    verdict: Verdict
    convergence_status: ConvergenceStatus
    playlist_placement: str
    revisit_trigger: str
    evidence_result: LockedPathResult
    field_result: LockedPathResult
    generated_at_utc: str
    claim_boundary: str = "This is an audited taste decision, not a guarantee of future fame."

    def to_dict(self) -> Dict:
        return {
            "artist": self.artist,
            "verdict": self.verdict,
            "convergence_status": self.convergence_status,
            "playlist_placement": self.playlist_placement,
            "revisit_trigger": self.revisit_trigger,
            "evidence_result": self.evidence_result.__dict__,
            "field_result": self.field_result.__dict__,
            "generated_at_utc": self.generated_at_utc,
            "claim_boundary": self.claim_boundary,
        }

    def to_markdown(self) -> str:
        evidence_reasons = "\n".join(f"- {reason}" for reason in self.evidence_result.reasons) or "- No evidence reasons recorded."
        field_reasons = "\n".join(f"- {reason}" for reason in self.field_result.reasons) or "- No field reasons recorded."
        return f"""# Taste Report: {self.artist}

## Verdict

{self.verdict}

## Convergence status

{self.convergence_status}

## Evidence path result

Score: {self.evidence_result.score}
Passed: {self.evidence_result.passed}
Saw field path before lock: {self.evidence_result.saw_other_path_before_lock}

{evidence_reasons}

## Field path result

Score: {self.field_result.score}
Passed: {self.field_result.passed}
Saw evidence path before lock: {self.field_result.saw_other_path_before_lock}

{field_reasons}

## Playlist placement

{self.playlist_placement}

## Revisit trigger

{self.revisit_trigger}

## Claim boundary

{self.claim_boundary}
"""


def _clamp_score(value: int) -> int:
    return max(0, min(5, int(value)))


def run_evidence_path(data: EvidenceInput) -> LockedPathResult:
    scores = {
        "audience_intensity": _clamp_score(data.audience_intensity),
        "craft_consistency": _clamp_score(data.craft_consistency),
        "identity_distinctness": _clamp_score(data.identity_distinctness),
        "credible_orbit": _clamp_score(data.credible_orbit),
        "live_strength": _clamp_score(data.live_strength),
        "visual_coherence": _clamp_score(data.visual_coherence),
        "asymmetry_signal": _clamp_score(data.asymmetry_signal),
    }
    total = sum(scores.values())
    reasons = [f"{key.replace('_', ' ')}: {value}/5" for key, value in scores.items()]
    reasons.extend(data.notes)
    return LockedPathResult(
        path="evidence",
        artist=data.artist,
        score=total,
        passed=total >= 23,
        reasons=reasons,
    )


def run_field_path(data: FieldInput) -> LockedPathResult:
    scores = {
        "voice_world": _clamp_score(data.voice_world),
        "lyrical_charge": _clamp_score(data.lyrical_charge),
        "symbolic_density": _clamp_score(data.symbolic_density),
        "atmosphere": _clamp_score(data.atmosphere),
        "emotional_specificity": _clamp_score(data.emotional_specificity),
        "productive_weirdness": _clamp_score(data.productive_weirdness),
        "internal_logic": _clamp_score(data.internal_logic),
    }
    total = sum(scores.values())
    reasons = [f"{key.replace('_', ' ')}: {value}/5" for key, value in scores.items()]
    reasons.extend(data.notes)
    return LockedPathResult(
        path="field",
        artist=data.artist,
        score=total,
        passed=total >= 24,
        reasons=reasons,
    )


def converge_taste(evidence: LockedPathResult, field: LockedPathResult) -> TasteDecision:
    if evidence.artist != field.artist:
        raise ValueError("Evidence and field paths must evaluate the same artist.")
    if evidence.saw_other_path_before_lock or field.saw_other_path_before_lock:
        raise ValueError("Taste paths are contaminated: a path saw the other before lock.")

    if evidence.passed and field.passed:
        verdict: Verdict = "add"
        status: ConvergenceStatus = "matched"
        placement = "Convergence archive: evidence says it matters; pattern says it is alive."
        trigger = "Revisit when a new release or live performance changes the signal profile."
    elif evidence.passed and not field.passed:
        verdict = "revisit"
        status = "partial"
        placement = "Courtroom watchlist: external signal is stronger than inner-world density."
        trigger = "Revisit if the artistic world becomes more coherent or emotionally specific."
    elif field.passed and not evidence.passed:
        verdict = "incubate"
        status = "partial"
        placement = "Incubator: strong inner-world density without enough breakout evidence yet."
        trigger = "Revisit if audience attachment, live strength, or credible orbit increases."
    else:
        verdict = "reject"
        status = "divergent" if abs(evidence.score - field.score) >= 8 else "unresolved"
        placement = "Do not add to the convergence archive yet."
        trigger = "Revisit only if new evidence or a stronger artistic field appears."

    return TasteDecision(
        artist=evidence.artist,
        verdict=verdict,
        convergence_status=status,
        playlist_placement=placement,
        revisit_trigger=trigger,
        evidence_result=evidence,
        field_result=field,
        generated_at_utc=datetime.datetime.now(datetime.UTC).isoformat(),
    )


def evaluate_artist(evidence_input: EvidenceInput, field_input: FieldInput) -> TasteDecision:
    evidence = run_evidence_path(evidence_input)
    field = run_field_path(field_input)
    return converge_taste(evidence, field)


def decision_from_json(payload: Dict) -> TasteDecision:
    artist = payload["artist"]
    evidence_payload = payload.get("evidence", {})
    field_payload = payload.get("field", {})
    evidence = EvidenceInput(artist=artist, **evidence_payload)
    field = FieldInput(artist=artist, **field_payload)
    return evaluate_artist(evidence, field)


def decision_json(payload: Dict) -> str:
    return json.dumps(decision_from_json(payload).to_dict(), indent=2)
