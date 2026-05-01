# Animal Recovery Scientific Health Upgrade v6 Device QA Protocol

## Voice-readable summary

This protocol tests whether the v6 prototype works on real devices and browsers. It is a software and workflow QA checklist. It does not provide diagnosis, treatment, or veterinary instructions.

## Claim levels

### Level 0: Built

The HTML or ZIP prototype exists.

Allowed claim:

- v6 prototype has been generated.

Not allowed:

- v6 is device verified.

### Level 1: Syntax proof

The JavaScript parses without syntax errors.

Allowed claim:

- v6 syntax passes parser checks.

Not allowed:

- v6 works in mobile Safari or desktop Chrome.

### Level 2: Browser workflow proof

The tool is opened and tested in a real browser.

Allowed claim:

- v6 works on the specific browser and device tested.

Not allowed:

- v6 works everywhere.

### Level 3: Stress workflow proof

The user can complete the workflow while tired, worried, or using a phone.

Allowed claim:

- v6 supports the intended documentation workflow on the tested device.

Not allowed:

- v6 guarantees no missed signals or medical outcome.

### Level 4: Veterinary communication proof

The generated packet helps communicate observations to a veterinarian.

Allowed claim:

- v6 generated useful communication material in a specific case.

Not allowed:

- v6 diagnosed, treated, or cured the animal.

## Test metadata

Device:

Browser:

Date:

Tester:

Tool version:

Local file or hosted URL:

## Result key

- PASS: worked as expected.
- FAIL: did not work.
- PARTIAL: worked, but with issue.
- NOT TESTED: skipped.

## Core open and layout tests

### 1. Open v6 HTML

Expected:

- Tool opens without blank screen.
- Tabs are visible.
- Dashboard loads animal cards.

Result:

Notes:

### 2. Mobile layout

Expected:

- No horizontal scrolling is required for normal use.
- Buttons are tappable.
- Text fields are readable.

Result:

Notes:

## Signal log tests

### 3. Add test signal log

Expected:

- User can add one test log.
- Log appears in the log list.
- Dashboard reflects urgent or emergency status if selected.

Result:

Notes:

### 4. Delete test signal log

Expected:

- Test log deletes without corrupting other data.

Result:

Notes:

## Diagnostic branch tests

### 5. Branch tracker loads for each animal

Expected:

- Each animal has a branch table.
- Branches are framed as questions and evidence paths, not conclusions.

Result:

Notes:

## Vet action queue tests

### 6. Add custom action

Expected:

- User can add an action or question.
- It appears in the queue.
- Priority is visible.

Result:

Notes:

### 7. Mark action done and reopen

Expected:

- Done state toggles correctly.

Result:

Notes:

## Treatment-response tests

### 8. Add test treatment-response entry

Expected:

- User can log intervention name, response window, metric, observed response, and outcome category.

Result:

Notes:

### 9. Outcome categories are visible

Expected:

- Outcome options include cure confirmed, remission, stabilized, partial response, no response, worsening, diagnosis unclear, and escalation needed.

Result:

Notes:

## Life-continuity tests

### 10. Save life check

Expected:

- User can save a care-load check.
- The panel supports stopping after necessary care actions.

Result:

Notes:

## Vet packet tests

### 11. Generate packet for each animal

Expected:

- Packet includes focus, core question, branch table, open actions, recent logs, treatment responses, and boundary statement.

Result:

Notes:

### 12. Print or save packet as PDF

Expected:

- Print preview includes only packet content, not all tabs.

Result:

Notes:

### 13. Copy packet text

Expected:

- Clipboard works or gives clear manual-copy fallback.

Result:

Notes:

## Backup and restore tests

### 14. Export JSON

Expected:

- Backup file downloads or saves successfully.

Result:

Notes:

### 15. Restore JSON

Expected:

- Valid backup restores.
- Invalid structure is rejected.

Result:

Notes:

## Stress workflow tests

### 16. Five-minute packet workflow

Expected:

- User can open tool, choose animal, generate packet, and identify the next communication step quickly.

Result:

Notes:

### 17. Ten-minute routine workflow

Expected:

- User can add one log, one action, one life check, export data, and stop.

Result:

Notes:

## Final QA summary

Overall result:

Blocking bugs:

Non-blocking bugs:

Usability friction:

Veterinary communication usefulness:

Recommended v6.1 fixes:

Ready for real use on this device/browser:

## Claim boundary after QA

Only claim v6 works on devices actually tested.

Do not generalize iPhone Safari proof to iPad Safari.

Do not generalize desktop Chrome proof to mobile Safari.

Do not convert tool usability into medical outcome claims.
