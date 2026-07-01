# Mirror Cartographer Vet History Connector Architecture

Status: implementation blueprint and product boundary  
Created: 2026-07-01  
Repository: `MirrorCartographer/mirror-cartographer-ui`

## Purpose

Mirror Cartographer should not make the owner manually remember every medical detail. The website needs a way to collect veterinary history from portals, emails, PDFs, screenshots, invoices, discharge notes, medication labels, lab reports, and owner observations, then normalize that material into one per-pet timeline.

The goal is not to replace veterinarians. The goal is continuity:

- preserve source records,
- separate raw source text from interpretation,
- detect missing history,
- map contradictions,
- generate appointment questions,
- track tests/procedures/medications,
- keep O'Malley, Bugsy, Griffey, and Nimbus in one structured medical atlas.

## Hard boundary

Do not build this by scraping vet portals with stored passwords or bypassing access controls.

Allowed ingestion paths:

1. User-authorized portal export.
2. Official API or OAuth if the clinic platform supports it.
3. User-uploaded PDFs, images, screenshots, CSVs, or text.
4. User-forwarded or connected email records.
5. Manual entry when no export exists.
6. Clinic-requested complete medical record packet.

## Target sources

### Banfield / PetWare-style portal

Likely useful records:

- visit summaries,
- vaccine history,
- lab summaries,
- medication history,
- diagnosis/problem list,
- invoices,
- appointment history.

Best path:

- official account export or downloaded PDFs first,
- email import second,
- manual entry fallback.

### VCA / emergency or hospital visit records

Likely useful records:

- discharge instructions,
- exam findings,
- vitals,
- medication instructions,
- imaging/lab attachments,
- invoices,
- emergency triage notes.

Best path:

- visit summary PDFs and emailed discharge notes.

### Local/private clinics

Likely useful records:

- complete medical record PDF,
- lab attachments,
- cytology reports,
- imaging reports,
- vaccination records,
- medication refill history.

Best path:

- request full record by email,
- ingest PDF or pasted email.

### Specialists

Likely useful records:

- ophthalmology pressure logs,
- glaucoma diagnosis details,
- eye medication changes,
- cardiology/echo report,
- anesthesia clearance notes,
- oncology/cytology reports,
- dental/oral exam records.

Best path:

- specialist PDF reports and medication tables.

## Normalized timeline schema

Each imported item becomes a structured event.

Required fields:

- `event_id`
- `pet_id`
- `pet_name`
- `species`
- `event_date`
- `source_clinic`
- `source_type`
- `record_type`
- `raw_source_text`
- `source_attachment_name`
- `source_attachment_hash`
- `problem`
- `observation`
- `test_or_procedure`
- `result_value`
- `unit`
- `reference_range`
- `medication`
- `dose`
- `frequency`
- `route`
- `start_date`
- `stop_date`
- `adverse_reaction`
- `clinician_assessment`
- `owner_observation`
- `interpretation`
- `confidence`
- `next_action`
- `needs_vet_review`
- `created_at`
- `updated_at`

## Ingestion pipeline

### Step 1: Collect source

Inputs:

- PDF,
- image/screenshot,
- email text,
- copied portal text,
- CSV,
- manual entry,
- future API response.

Output:

- immutable raw source object.

Rule:

Never overwrite source truth with interpretation.

### Step 2: Extract entities

Extract:

- pet name,
- date,
- clinic,
- clinician,
- diagnosis,
- test,
- procedure,
- medication,
- dose,
- frequency,
- result values,
- body system,
- recommendation,
- follow-up date,
- warning signs.

### Step 3: Normalize

Convert extracted text into timeline fields.

Examples:

- “IOP 38 OD” becomes eye pressure value, right eye, unit mmHg if documented.
- “heart murmur grade III/VI” becomes cardiac finding.
- “FIV positive” becomes infectious disease status with test type/date if known.
- “enlarged mandibular lymph nodes” becomes lymph-node finding by location.

### Step 4: Conflict detection

Flag:

- missing FeLV status,
- missing FIV test type,
- enlarged nodes without cytology,
- breathing concern without thoracic assessment,
- medication reactions without allergy/adverse-event flag,
- glaucoma without pressure trend,
- murmur without echo/anesthesia risk note,
- repeated skin lesions without cytology/parasite control status,
- dose changes without date.

### Step 5: Action mapping

Turn timeline into next physical hinges.

Examples:

- O'Malley: FNA/cytology, CBC/chemistry/urinalysis, FeLV status, thoracic imaging if breathing affected.
- Bugsy: eye pressure trend, glaucoma med log, echo/cardiology status, gabapentin adverse-reaction log.
- Griffey/Nimbus: flea-control record, cytology/skin scrape, household exposure map.

### Step 6: Vet packet export

Generate:

- one-page summary,
- timeline table,
- current meds,
- abnormal values,
- unresolved questions,
- requested tests/procedures,
- owner observations,
- source attachments list.

## Website modules

### Atlas

Public explanation of Mirror Cartographer as cognition infrastructure.

### Animal Health

Current pet map and priority hinges.

### Vet Hub

Connector model and portal/source targets.

### Records

Normalized timeline schema and seed records.

### FIV Cure

Discovery gates: erase, lock, expose-clear, armor, convert ecology, prevent.

### Engine

Architecture and export layer.

## Backend still needed

The current Vercel site can display the architecture and store browser-local data. Full automatic vet-history ingestion requires backend work:

1. Private database.
2. User authentication.
3. File upload storage.
4. PDF/image/email parser.
5. Email connector or forwarding inbox.
6. Optional portal/API integrations.
7. Source attachment hashing.
8. Per-record correction history.
9. Vet packet generator.
10. Privacy/security controls.

## Minimum viable build path

Phase 1: Browser-local prototype

- show animal command center,
- show vet hub,
- show normalized schema,
- allow manual/pasted record entry,
- export JSON.

Phase 2: Private persistence

- add login,
- database,
- file uploads,
- per-pet timeline.

Phase 3: Record ingestion

- PDF/email parser,
- owner correction interface,
- automatic conflict detection.

Phase 4: Connector expansion

- Gmail vet-email search/import,
- clinic record export ingestion,
- optional APIs where available.

Phase 5: Vet-facing packet

- appointment summary,
- questions,
- unresolved tests,
- medication table,
- source citations.

## Completion definition

The vet-history connector is real when:

1. A user can add every pet.
2. A user can import or paste vet records.
3. The system stores raw source separately from interpretation.
4. The system creates a timeline.
5. The system flags missing/conflicting medical information.
6. The system produces a vet-ready packet.
7. The system exports structured data.
8. The system does not require unsafe portal scraping.
