# The Next Move — Permission Room

## Purpose
A consent-gated, local-only experiment that tests whether recent door-choice transitions contain enough repeatable structure to predict a subsequent choice. This is a small behavioral demonstration, not mind-reading.

## Files
- `public/permission-room-next-move.html`: self-contained interactive experiment.
- `public/forest/permission-room.html`: the same experiment linked as Room 04 in The Forest.
- `docs/PERMISSION_ROOM_NEXT_MOVE.md`: protocol, storage contract, metrics, and proof status.

## Data contract
Collection starts only after both consent statements are checked and the visitor selects “Grant session permission & begin.” The page records door choice, trial number, prediction method, prior counts, candidate set, random draw, event sequence, timestamp, elapsed time, and outcome.

The experiment code does not call network APIs, read location, access camera/microphone, use cookies, or write to localStorage/sessionStorage/IndexedDB. Data exists in JavaScript memory until export or until the page is closed/reloaded. Export is user-initiated. Revocation disables choices and clears in-memory event/trial arrays. An already exported file is outside the page's control.

## Prediction protocol (version 1.1)
There are 12 trials, with three doors: Moss, Glass, Ember.
1. The first prediction is sampled uniformly across all three doors.
2. On later trials, the model counts observed next-door transitions following the most recent choice. If any such transitions exist, it selects among the most frequent next doors, randomizing ties.
3. If no matching transition exists, it samples from global prior choice counts with one pseudocount per door (Laplace smoothing).
4. The current choice is not available when the prediction is generated. The event ledger records the method, counts, candidates, and random draw before the choice event.

Unlike version 1.0, this is not a fixed “always Moss” predictor. Randomized ties prevent a fixed door-order rule from deciding the result. The model can still perform poorly, and 12 trials are far too few to establish a general ability.

## Metrics
- Accuracy = correct predictions / completed trials.
- Reference = 1/3 uniform random-choice accuracy.
- Lift = accuracy minus 1/3, expressed as percentage points.
- 95% Wilson interval for observed accuracy; interpret cautiously because sequential human choices may not be independent.
- Ordering audit checks prediction event sequence < choice event sequence < outcome event sequence.
- A complete 12-trial run is a demonstration only; it does not establish general predictive ability or psychological insight.

## Proof status
### Implemented in source
Consent gating, randomized transition prediction, pre-choice logging, outcome comparison, visible event ledger, metrics report, JSON export, summary copy, and revoke/clear behavior are implemented in the HTML.

### Not yet verified
Source inspection confirms the relevant logic exists, but does not prove successful execution in every browser or deployment. No live visitor results are claimed. A successful Git commit is not deployment proof. The automated repository checks and the live route must be checked separately.

## Manual acceptance test
1. Open the page; confirm doors are disabled and the ledger says no events collected.
2. Attempt to grant with either consent statement incomplete; confirm nothing is collected.
3. Grant both permissions; confirm consent/start events appear.
4. Complete at least three trials; confirm each prediction event precedes its choice and outcome.
5. Inspect prediction records; verify method, counts/candidates, and random draw are visible. The first prediction should not be hard-coded to Moss.
6. Complete 12 trials; verify accuracy = correct/12, chance reference = 33.3%, and report says complete demonstration run.
7. Export JSON; confirm consent scope, metrics, trials, event sequence, timestamps, and limitations are present.
8. Revoke; confirm doors disable and on-page records clear. Reload; confirm the previous session is not restored.
9. In browser developer tools, inspect network requests during the experiment; the experiment code itself should issue none.
