# Animal Recovery Signal Tool v5 Device QA Checklist

## Voice-readable summary

Use this checklist to test Animal Recovery Signal Tool v5 on real devices. The goal is to prove that the tool works on the devices actually used, especially iPhone and iPad Safari.

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
- PARTIAL: worked with issue.
- NOT TESTED: skipped.

## Core workflow tests

### 1. Open app

Expected:
The HTML opens without blank screen or visible script error.

Result:

Notes:

### 2. Add fake log

Expected:
A fake log can be added without affecting real animal records.

Result:

Notes:

### 3. Quick Triage signal preservation

Expected:
The saved Quick Triage log preserves the exact selected triage signals.

Result:

Notes:

### 4. Edit log

Expected:
An existing log can be edited and saved.

Result:

Notes:

### 5. Delete log

Expected:
A log can be deleted without deleting animal profile data.

Result:

Notes:

### 6. Final-profile protection

Expected:
The app blocks deleting the last remaining animal profile.

Result:

Notes:

## Escalation logic tests

### 7. Yellow gums urgent-minimum logic

Expected:
Yellow gums triggers urgent-minimum escalation.

Result:

Notes:

### 8. O’Malley lymph-node escalation

Expected:
Lymph nodes plus appetite, energy, or weight drift escalates harder.

Result:

Notes:

### 9. Bug/Bugsy eye-heart escalation

Expected:
Glaucoma/eye signs plus heart, breathing, or murmur signs escalate harder.

Result:

Notes:

### 10. Griffey/Nimby shared skin concern

Expected:
Skin/scab logs flag shared-environment concern.

Result:

Notes:

## Print tests

### 11. Vet Packet scoped print

Expected:
Vet Packet print or print-preview includes only the Vet Packet, not every tab.

Result:

Notes:

### 12. Fridge Sheet scoped print

Expected:
Fridge Sheet print or print-preview includes only the Fridge Sheet, not every tab.

Result:

Notes:

## Data safety tests

### 13. Export JSON

Expected:
JSON export downloads or saves successfully.

Result:

Notes:

### 14. Restore JSON

Expected:
JSON restore succeeds only with valid expected structure.

Result:

Notes:

### 15. Deleted-profile-safe logs

Expected:
Old logs preserve the correct animal name even if the matching profile was deleted.

Result:

Notes:

### 16. Older local data migration

Expected:
v4/v3/v2 local browser data attempts migration into v5 without corrupting v5 data.

Result:

Notes:

## Mobile-specific tests

### 17. iPhone Safari clipboard fallback

Expected:
Copy action succeeds or shows a usable fallback path.

Result:

Notes:

### 18. iPad Safari clipboard fallback

Expected:
Copy action succeeds or shows a usable fallback path.

Result:

Notes:

### 19. Mobile layout

Expected:
Tabs, forms, buttons, and export/import controls are usable without horizontal breakage.

Result:

Notes:

## Final QA summary

Overall result:

Blocking bugs:

Non-blocking bugs:

Recommended v5.1 fixes:

Ready for real use:

## Claim boundary after testing

Only mark v5 as device-verified for the devices and browsers actually tested.

Do not generalize iPhone Safari results to all browsers.

Do not generalize desktop Chrome results to iPad Safari.
