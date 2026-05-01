# Animal Recovery Scientific Health Upgrade v6.1 Backlog

## Voice-readable summary

This backlog records the next software improvements after v6. The v6 prototype establishes the structure. v6.1 should make it safer, clearer, and more usable under real conditions.

## Build rule

Do not add features only because they feel impressive.

Add features that improve one of these:

1. Faster communication with a veterinarian.
2. Better evidence quality.
3. Cleaner tracking of response over time.
4. Lower care-load for the user.
5. Stronger claim boundaries.
6. Fewer software mistakes under stress.

## Priority 0: Device QA blockers

These must be fixed first if found during device testing.

| Backlog item | Why it matters | Acceptance standard |
|---|---|---|
| Mobile layout breakage | Tool must work on iPhone/iPad | No horizontal scrolling for normal use |
| Print packet scope failure | Vet packet must not print unrelated tabs | Print preview shows packet only |
| Export failure | Data must not be trapped | JSON backup saves successfully |
| Restore failure | Data must be recoverable | Valid backup restores; invalid backup rejected |
| Clipboard failure without fallback | User may need to send packet text | Copy works or fallback is clear |
| Blank-screen error | Tool unusable | Opens on tested browsers |

## Priority 1: Trust and data safety

| Backlog item | Why it matters | Acceptance standard |
|---|---|---|
| Add edit button for logs | Mistakes must be correctable | Log text/status/signal can be edited |
| Add delete button for actions/responses | Fake test entries must be removable | User can remove non-real entries |
| Add test-mode toggle | Prevents fake QA data mixing with real records | Test entries are labeled and filterable |
| Add backup version validation | Prevents corrupt restore | Backup includes version and schema checks |
| Add data reset with confirmation | Needed for QA and failed restores | Reset requires typed confirmation |

## Priority 2: Health-upgrade tracking

| Backlog item | Why it matters | Acceptance standard |
|---|---|---|
| Branch status field | Branches need state, not just text | Each branch can be marked possible, ruled out, confirmed, unknown |
| Test-result entries | Decisions depend on results | User can log test name, date, result, next step |
| Vet-plan entries | Vet recommendations should be structured | User can record vet plan and follow-up date |
| Response-window reminders | Treatment response needs time logic | User can see when a response check is due |
| Outcome review screen | Cure/remission/stabilization needs review | Tool summarizes outcomes by animal |

## Priority 3: Communication quality

| Backlog item | Why it matters | Acceptance standard |
|---|---|---|
| Short vet call script | Phone calls are stressful | Packet includes 30-second call script |
| One-question-per-animal summary | Prevents overwhelming appointments | Each animal has one top question |
| Export packet as plain text file | Easier to send | User can download .txt packet |
| Photo checklist | Evidence quality improves with photos | Tool lists what photos to take |
| Appointment prep checklist | Reduces forgetting | User can mark questions/documents ready |

## Priority 4: Life-continuity safeguards

| Backlog item | Why it matters | Acceptance standard |
|---|---|---|
| Care-load timer | Prevents endless checking | Optional timer for routine check block |
| Stop-after-action prompt | Helps user exit panic loop | After required actions, tool shows stop cue |
| Capacity selector | Tool adapts to low/high capacity days | User picks low/medium/high capacity |
| Minimum viable care mode | Reduces overwhelm | Tool shows only emergency check + one action |

## Priority 5: Source and boundary quality

| Backlog item | Why it matters | Acceptance standard |
|---|---|---|
| Source notes per branch | Keeps branch logic grounded | Each branch has source note or vet-confirmed note |
| Veterinary boundary banner | Prevents misuse | Visible on packet and data pages |
| No-treatment-policy note | Prevents unsupported instructions | Tool says interventions must follow vet guidance |
| Claim-level display | Avoids fake proof | Tool displays built/syntax/device/outcome proof levels |

## v6.1 minimum release standard

Do not call v6.1 ready unless:

1. It passes desktop browser smoke.
2. It passes mobile Safari open/log/packet/export smoke.
3. It supports test entries or cleanup.
4. It can export data.
5. It can generate a readable vet packet.
6. It preserves the no-diagnosis/no-prescription boundary.

## Claim boundary

Allowed:

v6.1 backlog defines the next reliability and health-upgrade improvements.

Not allowed:

v6.1 is already implemented or device-verified before the work is done and tested.
