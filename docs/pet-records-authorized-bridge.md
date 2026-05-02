# Pet Records Authorized Bridge

Status: v0 design committed from ChatGPT session
Owner: Charity Sturgell
Purpose: create a lawful, owner-authorized route for retrieving veterinary records without relying on manual clinic-by-clinic waiting when a self-service or authenticated channel exists.

## Core premise

The goal is not to bypass veterinary systems. The goal is to build an authorization bridge that lets the owner authenticate once, export records from every available owner portal, and feed those records into a root-cause medical reasoning workspace.

The lawful key is not a hidden exploit. The lawful key is owner authorization plus auditable consent.

## Target clinics

1. Banfield Pet Hospital
   - Primary route: MyBanfield / Banfield app records center.
   - Expected data: care history, vaccinations, medications, lab tests, visit summaries, invoices.
   - Gate: owner login and any required 2FA.

2. Imperial Beach Pet Hospital & Urgent Care
   - Primary route: official Pet Portal at petportal.vet.
   - Expected data: visit summaries, invoices, records, medications, labs if portal exposes them.
   - Backup route: official contact form / clinic release request.
   - Gate: owner login and identity verification if required.

3. South Rowan Animal Hospital
   - Primary route: South Rowan Pet Portal / Covetrus route.
   - Backup route: records email/fax request.
   - Expected data: SOAP notes, labs, imaging, medication history, diagnoses, invoices.
   - Gate: owner login or clinic release process.

## Animal records to acquire

### Dog: Bug / Bugsy

Known concerns:
- glaucoma
- heart murmur

Priority evidence:
- tonometry / intraocular pressure readings
- glaucoma type: primary vs secondary
- ophthalmology notes
- current eye drops and response
- vision status
- murmur grade and location
- echocardiogram, if any
- chest x-rays, if any
- ECG, if any
- blood pressure
- CBC / chemistry / urinalysis

### Cats: O'Malley, Griffey, Nimby

Known concerns:
- FIV
- swollen lymph nodes

Priority evidence:
- FIV/FeLV test result proof
- lymph node location, size, duration, growth/shrink pattern
- CBC with differential
- chemistry panel
- urinalysis
- dental/oral exam findings
- fine needle aspirate / cytology
- biopsy / PARR / flow cytometry if performed
- imaging / ultrasound if performed

## System architecture

### Layer 1: Owner authentication

The user authenticates directly with each portal. The system must not store raw passwords. Acceptable future methods:

- OAuth, if portal supports it.
- User-controlled browser session export only if legally and technically permitted.
- Manual file upload from portal download.
- Email forwarding from owner inbox.
- Clinic-generated direct document transfer.

No route may pretend to be clinic staff, evade authentication, scrape private data without permission, or bypass portal access controls.

### Layer 2: Record intake

Accepted intake types:

- PDF
- images / screenshots
- CSV
- portal export zip
- email attachment
- copied visit note text
- lab report image

Every record receives:

- source clinic
- animal name
- date of service
- document type
- SHA-256 hash
- duplicate status
- extraction status
- confidence level

### Layer 3: Extraction

Extract and normalize:

- diagnoses
- medications and dosages
- vitals
- exam findings
- lab values with reference ranges
- imaging findings
- procedures
- clinician assessments
- follow-up recommendations
- unresolved questions

### Layer 4: Root-cause reasoning board

Every finding is mapped to:

1. What system is failing?
2. What upstream causes could explain it?
3. What evidence separates the causes?
4. Which possibilities are fixable, controllable, progressive, irreversible, or research-frontier?
5. What diagnostic test has the highest next information value?

### Layer 5: Escalation engine

If records remain incomplete:

- generate clinic-specific request
- generate legal timeline marker
- generate specialist-transfer packet
- generate missing-data checklist

The escalation engine must distinguish:

- missing because portal hides it
- missing because test was never done
- missing because record is ambiguous
- missing because clinic did not respond

## Product direction

This can become a general owner-authorized veterinary record bridge for people who need root-cause investigation across fragmented clinics.

The product is not a diagnosis replacement. It is a medical-record coherence engine.

## Next implementation tasks

1. Build `/pet-records` page with three clinic cards and animal evidence targets.
2. Add upload component for PDFs/images.
3. Add local file hashing and duplicate detection.
4. Add extraction queue.
5. Add animal timeline view.
6. Add missing diagnostics board.
7. Add vet appointment packet generator.
8. Add portal-route checklist for Banfield, Imperial Beach, and South Rowan.
9. Add compliance note: owner-authorized records only.
10. Add future connector abstraction for any clinic portal that supports lawful export/API access.

## Safety/compliance rule

This system exists to reduce harm by increasing record continuity. It must not perform unauthorized access, impersonation, credential theft, access-control bypass, hidden scraping, or data exfiltration.

## Working phrase

Cure is the mission. Evidence is the machine. Authorization is the bridge.
