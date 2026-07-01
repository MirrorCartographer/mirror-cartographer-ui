# Mirror Cartographer Vet Hub Connector Architecture

Created: 2026-07-01  
Status: implementation specification  
Scope: animal medical history ingestion, normalization, continuity, and research mapping

## Product intent

Mirror Cartographer should not make the owner manually rebuild years of veterinary history if records already exist in portals, emails, PDFs, invoices, discharge notes, lab reports, imaging summaries, and medication lists.

The preferred product behavior is connector-first:

1. Connect to authorized veterinary record sources when possible.
2. Import exported records when direct connection is not available.
3. Parse vet emails and attachments with explicit user authorization.
4. Normalize all records into one per-pet timeline.
5. Map missing information, contradictions, urgent risk, and next physical hinges.
6. Export a clean vet packet before appointments.

Manual entry exists only as fallback, correction, or owner-observation layer.

## Hard boundary

Do not build password scraping or anti-access-control behavior.

Allowed ingestion paths:

- Official API.
- OAuth or equivalent user-authorized integration.
- User-downloaded portal export.
- User-uploaded records PDF/image/document.
- User-authorized Gmail search/read for veterinary emails and attachments.
- Clinic-sent record packets.
- Manual correction or owner observation.

Disallowed paths:

- Storing vet portal passwords.
- Scraping pages behind login without explicit platform permission.
- Circumventing CAPTCHA, MFA, rate limits, robots restrictions, or access controls.
- Pretending records are complete when source coverage is partial.

## First supported sources

### Banfield / PetWare-style portal

Target records:

- Wellness plan history.
- Visit summaries.
- Vaccines.
- Medication list.
- Lab panels.
- Invoices.
- Diagnoses.
- Weight history.
- Dental/oral notes.

Preferred connector method:

1. Official export/API if available.
2. User-downloaded PDFs if no API.
3. Gmail import of Banfield emails and attachments.
4. Manual correction only when records are incomplete.

### VCA / hospital records

Target records:

- Emergency visit summaries.
- Discharge instructions.
- Exam findings.
- Medication instructions.
- Lab attachments.
- Imaging reports.
- Referral notes.

Preferred connector method:

1. User-authorized record packet download or clinic email.
2. Gmail attachment import.
3. Uploaded PDFs/images.

### Local/private clinics

Target records:

- Complete medical record packet.
- SOAP notes if provided.
- Labs.
- Cytology.
- Imaging.
- Vaccine records.
- Invoices.

Preferred connector method:

1. Request complete medical record PDF from clinic.
2. Import emailed packet or upload file.
3. Normalize timeline.

### Specialists

Target records:

- Ophthalmology pressure readings.
- Glaucoma medication changes.
- Cardiology murmur/echo notes.
- Anesthesia clearance.
- Oncology/cytology reports.
- Internal medicine consults.

Preferred connector method:

1. Specialist portal/export if available.
2. Clinic email attachments.
3. Uploaded PDF/image.

## Normalized timeline schema

Every imported record becomes one or more structured events.

Required fields:

- `pet_id`
- `event_date`
- `source_clinic`
- `record_type`
- `problem`
- `observation`
- `test_or_procedure`
- `result_value`
- `unit`
- `medication`
- `dose`
- `frequency`
- `clinician_assessment`
- `owner_observation`
- `confidence`
- `next_action`
- `source_attachment`
- `source_hash`
- `import_method`
- `coverage_note`

## Import methods

### 1. OAuth/API connector

Use when a vet provider supports authorized third-party access.

Steps:

1. User chooses provider.
2. User authorizes access.
3. System requests read-only records.
4. Raw payload is stored privately or transformed immediately.
5. Timeline events are generated.
6. User sees source coverage and missing categories.

Required UX:

- Show exactly which provider is connected.
- Show sync date/time.
- Show what categories were found.
- Show what categories were not available.
- Allow disconnect.

### 2. Portal export ingestion

Use when no API is available.

Steps:

1. User downloads records from portal.
2. User uploads PDF/CSV/image/document to Mirror Cartographer.
3. Parser extracts dates, values, diagnoses, meds, vaccines, instructions, and clinician notes.
4. User reviews extracted timeline.
5. Corrections are saved with provenance.

### 3. Gmail veterinary email import

Use when clinics email records, invoices, reminders, prescriptions, or attachments.

Steps:

1. User authorizes Gmail read/search.
2. Search queries target veterinary senders and keywords.
3. Attachments are read.
4. Parser extracts medical events.
5. Emails are not modified unless user explicitly requests it.

Candidate queries:

- `from:(banfield.com OR vca.com) (Bugsy OR O'Malley OR Griffey OR Nimbus)`
- `(veterinary OR vet OR discharge OR invoice OR lab OR vaccine OR medication) has:attachment`
- clinic-specific sender domains once known.

### 4. Manual correction layer

Manual input is allowed for:

- Owner observations.
- Symptom timing.
- Appetite, breathing, behavior, stool, pain, medication reaction.
- Corrections to extracted data.
- Missing records not yet received.

Manual input should not replace record ingestion when records exist.

## Animal health modules

### O'Malley module

Known starting facts:

- FIV-positive.
- Multiple enlarged lymph nodes.
- Possible breathing effect.
- Lymphoma concern.

Immediate mapped actions:

- Confirm FIV/FeLV status if documentation incomplete.
- Lymph-node anatomical map.
- FNA/cytology of abnormal node(s).
- CBC with differential.
- Chemistry panel.
- Urinalysis.
- Thoracic imaging if breathing is affected.
- Track resting respiratory rate, appetite, weight, gum color, lymph-node size.

### Bugsy module

Known starting facts:

- Chihuahua.
- Glaucoma.
- Heart murmur.
- Gabapentin reaction after travel: pacing/spinning/restlessness/vomiting.
- Eye swelling concern after travel.

Immediate mapped actions:

- Preserve exact medication timing and dose history.
- Ophthalmology pressure history.
- Cardiac murmur/echo/anesthesia clearance history.
- Medication adverse reaction log.
- Avoid sedation decisions without heart/eye context.

### Griffey + Nimbus module

Known starting facts:

- Facial scabs / skin lesions.
- Shared household exposure.

Immediate mapped actions:

- Flea control timeline.
- Skin cytology/scrape if persistent.
- Household exposure map.
- Separate parasite/allergy/infection/stress layers.

## Research engine behavior

For each problem, the system must output:

1. What is known.
2. What is unknown.
3. What is urgent.
4. What tests/procedures change the map.
5. What results would mean.
6. What results cannot prove.
7. Which records are missing.
8. Which clinic/source may hold them.
9. Vet question packet.
10. Research hypotheses, clearly labeled as hypotheses.

## FIV module

The FIV section must keep two layers separate:

Clinical current layer:

- Protect the living cat.
- Diagnose lymph nodes/breathing accurately.
- Treat secondary disease.
- Track weight, appetite, breathing, oral health, infections, labs.

Cure-discovery layer:

- Proviral erasure.
- Latency lock.
- Expose-and-clear.
- Entry-proof immune replacement.
- Immune ecological conversion.
- Vaccine/prevention research.

## Prevention module for FIV-negative cats

Prevention hierarchy:

1. Test before mixing cats.
2. Prevent deep bites.
3. Keep cats indoors or protected from unknown outdoor fighting exposure.
4. Use slow introductions and resource separation.
5. Consider FIV vaccine only where available and vet-justified.
6. Preserve vaccine history because antibody testing can become harder to interpret.
7. Future vaccine goal: broader subtype coverage and DIVA-compatible diagnostics.

## Website modules

Current front-end modules:

- Atlas.
- Animal Health.
- Vet Hub.
- Records.
- FIV Cure.
- Engine.

Next implementation modules:

- Upload Records.
- Gmail Vet Import.
- Provider Authorization.
- Timeline Review.
- Vet Packet Export.
- Missing Records Checklist.
- Medication Reaction Tracker.
- Lab Trend Viewer.

## Validation strategy without labs

Validation can begin before wet-lab access:

- Verify record extraction against original documents.
- Compare timeline against owner memory and clinic records.
- Check whether generated vet packets improve appointment clarity.
- Track whether missing-test detection catches real gaps.
- Literature-ground every research hypothesis.
- Build computational analyses for FIV sequence/conserved-target questions when data is available.

Wet-lab validation is needed only for claims about actual FIV cure mechanisms.

## Deployment note

The React app is now mounted from root `index.html`. If the live site still shows an old prototype or loading screen, the issue is deployment aliasing, stale Vercel output, or Vercel build-rate limiting, not the root app entry file.
