from engines.music.taste_engine import (
    EvidenceInput,
    FieldInput,
    LockedPathResult,
    converge_taste,
    evaluate_artist,
)


def test_add_when_evidence_and_field_both_pass():
    decision = evaluate_artist(
        EvidenceInput(
            artist="Test Artist",
            audience_intensity=4,
            craft_consistency=4,
            identity_distinctness=4,
            credible_orbit=3,
            live_strength=3,
            visual_coherence=4,
            asymmetry_signal=4,
        ),
        FieldInput(
            artist="Test Artist",
            voice_world=4,
            lyrical_charge=4,
            symbolic_density=4,
            atmosphere=4,
            emotional_specificity=4,
            productive_weirdness=3,
            internal_logic=4,
        ),
    )

    assert decision.verdict == "add"
    assert decision.convergence_status == "matched"
    assert decision.evidence_result.saw_other_path_before_lock is False
    assert decision.field_result.saw_other_path_before_lock is False


def test_incubate_when_field_passes_but_evidence_does_not():
    decision = evaluate_artist(
        EvidenceInput(artist="Hidden Artist", audience_intensity=1, craft_consistency=2),
        FieldInput(
            artist="Hidden Artist",
            voice_world=5,
            lyrical_charge=4,
            symbolic_density=4,
            atmosphere=4,
            emotional_specificity=4,
            productive_weirdness=4,
            internal_logic=4,
        ),
    )

    assert decision.verdict == "incubate"
    assert decision.convergence_status == "partial"


def test_revisit_when_evidence_passes_but_field_does_not():
    decision = evaluate_artist(
        EvidenceInput(
            artist="Pushed Artist",
            audience_intensity=5,
            craft_consistency=5,
            identity_distinctness=4,
            credible_orbit=5,
            live_strength=4,
            visual_coherence=4,
            asymmetry_signal=3,
        ),
        FieldInput(artist="Pushed Artist", voice_world=1, lyrical_charge=1),
    )

    assert decision.verdict == "revisit"
    assert decision.convergence_status == "partial"


def test_reject_when_both_paths_fail():
    decision = evaluate_artist(
        EvidenceInput(artist="Weak Artist"),
        FieldInput(artist="Weak Artist"),
    )

    assert decision.verdict == "reject"


def test_contaminated_paths_are_rejected():
    evidence = LockedPathResult(
        path="evidence",
        artist="Contaminated Artist",
        score=30,
        passed=True,
        reasons=[],
        saw_other_path_before_lock=True,
    )
    field = LockedPathResult(
        path="field",
        artist="Contaminated Artist",
        score=30,
        passed=True,
        reasons=[],
    )

    try:
        converge_taste(evidence, field)
    except ValueError as error:
        assert "contaminated" in str(error)
    else:
        raise AssertionError("contaminated paths should raise")
