# The Next Move — Permission Room

## Purpose
A consent-gated, local-only experiment testing a simple next-choice predictor. It records prediction events before choice events, evaluates predictions after the choice, and exports a verification report.

## Files
- `public/permission-room-next-move.html`: self-contained interactive experiment; no framework or third-party runtime dependency.
- `docs/PERMISSION_ROOM_NEXT_MOVE.md`: protocol, storage contract, metrics, and proof status.

## Data contract
Collection starts only after both consent checkboxes are checked and the user selects “Grant session permission & begin.” The page records trial number, selected door (Moss, Glass, Ember), prediction and model method, event sequence number, timestamp, elapsed time relative to session start, and prediction outcome/running accuracy.

The experiment code does not call network APIs, read location, access camera/microphone, use cookies, or write to localStorage/sessionStorage/IndexedDB. Data exists in JavaScript memory until exported or the page is closed/reloaded. Export is user-initiated. Revocation disables choices and clears in-memory event/trial arrays. An already exported file is outside the page's control.

## Prediction protocol
There are 12 trials. On trial 1, the predictor chooses Moss as a declared fixed baseline. On each subsequent trial, it predicts the most frequently selected door in prior trials. Ties resolve in this fixed order: Moss, Glass, Ember. The current choice is not available when the prediction is made. Each trial stores sequence references and the report checks prediction sequence < choice sequence < outcome sequence.

## Metrics
- Accuracy = correct predictions / completed trials.
- Reference = 1/3 uniform random-choice accuracy.
- Lift = accuracy - 1/3, expressed as percentage points.
- 95% Wilson interval for observed accuracy; interpret cautiously because sequential human choices may not be independent.
- Ordering audit verifies event order.
- A complete 12-trial run is a demonstration only; it does not establish general predictive ability or psychological insight.

## Proof status
### Implemented in source
The HTML contains consent gating, a 12-trial interface, prediction-before-choice logging, outcome comparison, a visible event ledger, a metrics report, JSON export, summary copy, and revoke/clear behavior.

### Not yet verified
This source has not, by itself, proven successful execution in all browsers, mobile layouts, hosting environments, or production deployment. No live visitor results are claimed here. A successful Git commit is not deployment proof. Verify the page in the deployed environment and inspect the exported report before making capability claims.

## Manual acceptance test
1. Open the page; confirm doors are disabled and event ledger says no events collected.
2. Click grant with either consent statement incomplete; confirm no events are collected.
3. Grant with both checked; confirm consent/start events appear.
4. Complete at least three trials; verify each prediction event precedes its choice event and outcome event.
5. Complete 12 trials; verify accuracy = correct/12, chance reference = 33.3%, and report says complete demonstration run.
6. Export JSON; confirm it contains consent scope, metrics, trials, event sequence, timestamps, and limitations.
7. Revoke; confirm doors disable and the on-page log and report clear. Reload; confirm no previous session is restored.
8. In browser developer tools, inspect network requests during the experiment; this page should issue none as part of its telemetry experiment.
