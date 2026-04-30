# Animal Recovery Scientific Health Upgrade v6

## Voice-readable summary

The goal of the Animal Recovery lane is not merely comfort tracking. The goal is to help each animal move toward the highest scientifically realistic health upgrade available: cure when possible, remission when possible, stabilization when possible, and faster escalation when danger signs appear.

This system does not replace a veterinarian. It is designed to make veterinary care sharper by organizing evidence, tracking response, identifying reversible causes, preparing better questions, and reducing missed signals.

## Core goal

Cure is the desired direction, not a guaranteed claim.

The operational goal is:

1. Identify the true cause or most likely cause.
2. Separate treatable causes from irreversible causes.
3. Prioritize the lowest-cost tests that change decisions most.
4. Track objective response to treatment.
5. Escalate to second opinions or specialty care when the current path stalls.
6. Preserve the user's ability to live while the care system stays active.

## Scientific frame

The system should ask:

- What is the symptom?
- What are the most likely causes?
- Which causes are reversible or treatable?
- Which test would separate the branches fastest?
- What treatment options exist if the branch is confirmed?
- How will improvement or worsening be measured?
- What is the next escalation if the first plan does not work?

## What this is not

Not allowed:

- Claiming the tool cures disease.
- Replacing veterinary diagnosis.
- Recommending human medication or unapproved animal medication.
- Inventing treatment protocols without a veterinarian.
- Treating comfort care as the only goal.
- Treating survival as proof that the chosen path is best.

Allowed:

- Building evidence packets.
- Preparing differential-diagnosis questions.
- Tracking objective response.
- Flagging urgent changes.
- Asking for second-opinion thresholds.
- Helping the user pursue cure, remission, or health improvement through scientific decision paths.

## Animal-specific scientific objectives

### O'Malley

Current concern:

- Enlarged/swollen lymph nodes.
- Possible branches include lymphoma, infection, FeLV/FIV-related disease, inflammation, or other systemic disease.

Health-upgrade objective:

- Find whether the lymph nodes represent cancer, infection, viral/immune disease, or another treatable process.

Highest-value diagnostic questions:

1. Would a fine needle aspirate of the enlarged lymph node change the decision?
2. Should FeLV/FIV status be repeated or confirmed?
3. Should CBC, chemistry, and urinalysis be done before treatment decisions?
4. If FNA is inconclusive, what is the next threshold for biopsy, imaging, or oncology referral?

Response metrics:

- lymph node size and firmness
- appetite
- weight
- energy
- fever signs
- vomiting/diarrhea
- breathing changes
- hiding or behavior change

### Bug / Bugsy

Current concern:

- Heart murmur plus glaucoma/eye pressure concern.
- Possible branches include eye-only disease, systemic hypertension, kidney disease, thyroid disease, or heart disease.

Health-upgrade objective:

- Protect vision and detect systemic disease early enough for treatment.

Highest-value diagnostic questions:

1. What is Bug's blood pressure?
2. What is the current intraocular pressure / eye-pressure status?
3. Are kidney values, thyroid values, and basic bloodwork current?
4. Does the murmur require echocardiogram, chest imaging, or monitoring first?
5. What signs mean this becomes emergency eye or breathing care?

Response metrics:

- eye cloudiness
- squinting or eye pain
- pupil changes
- vision behavior
- breathing effort
- coughing
- resting respiratory rate if vet asks for it
- appetite/energy
- water intake and urination

### Griffey and Nimby

Current concern:

- Facial scabs in more than one animal.
- Possible branches include fleas, mites, ringworm/dermatophytes, bacterial infection, allergy, stress/immune issues, or shared environmental exposure.

Health-upgrade objective:

- Identify whether the scabs are contagious, parasitic, infectious, allergic, or inflammatory and treat the correct branch.

Highest-value diagnostic questions:

1. Should we start with flea combing, skin scraping, and cytology?
2. Is ringworm testing indicated?
3. Is a vet-approved parasite trial appropriate even if scraping is negative?
4. Should the animals be separated or should bedding/tools be cleaned while waiting?
5. What treatment-response timeline would confirm or weaken the suspected cause?

Response metrics:

- number of scabs
- location spread
- itch level
- hair loss
- redness/swelling/discharge
- whether both animals worsen together
- response after vet-approved parasite or infection treatment

## Health-upgrade loop

Use this cycle for every animal and every condition:

1. Baseline
   - What is normal for this animal?

2. Signal
   - What changed?

3. Branch
   - What are the top likely causes?

4. Test
   - What test separates the branches?

5. Treat
   - What evidence-based treatment follows if confirmed?

6. Measure
   - What objective metric should improve?

7. Escalate
   - What happens if it does not improve?

8. Review
   - Did the plan produce cure, remission, stabilization, no change, or worsening?

## Outcome categories

Use more precise categories than better/worse:

- CURE_CONFIRMED: condition resolved and vet agrees.
- REMISSION: signs controlled but recurrence possible.
- STABILIZED: no worsening; function maintained.
- PARTIAL_RESPONSE: some metrics improved, others remain abnormal.
- NO_RESPONSE: no meaningful improvement by expected timeline.
- WORSENING: symptoms or objective signs deteriorated.
- DIAGNOSIS_UNCLEAR: test results do not explain signs.
- ESCALATION_NEEDED: second opinion, specialist, imaging, biopsy, or emergency care needed.

## Life-continuity rule

The user should not have to become the whole medical system manually.

The system should reduce care-load by showing:

- today's animal priorities only
- the next one best question per animal
- the next one best action per animal
- the signs that override everything and require urgent care
- the tasks that can wait

The target is not emotional comfort alone. The target is sustained, accurate action without self-erasure.

## Next implementation targets

1. Add a health-upgrade dashboard to the animal tool.
2. Add differential-branch tracking for each animal.
3. Add treatment-response timelines.
4. Add vet-question queue.
5. Add second-opinion trigger rules.
6. Add a daily life-continuity panel for the user.
7. Add a QA distinction between syntax proof, browser proof, medical-data usefulness, and outcome usefulness.

## Claim boundary

Allowed claim:

Animal Recovery Scientific Health Upgrade v6 defines a scientifically structured path toward cure, remission, stabilization, and evidence-based escalation.

Not allowed claim:

The tool itself cures animals or guarantees any medical outcome.
