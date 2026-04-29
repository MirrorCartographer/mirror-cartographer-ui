# Workstreams

This repo now treats Mirror Cartographer as a multi-team machine. The teams are functional modules, not necessarily separate people.

## 1. Portal UI Team
Owns the React/Vite interface.

Responsibilities:
- keep the portal usable, alive, accessible, and non-generic
- split monolithic UI into stable components over time
- connect public-facing experience to internal engines only when safe

## 2. ARC Solver Team
Owns offline ARC reasoning.

Responsibilities:
- build no-internet solver code
- generate candidate programs
- run benchmark harnesses
- label failures
- improve one missing primitive at a time

## 3. Proof and Evaluation Team
Owns claim discipline.

Responsibilities:
- define proof standards
- keep claim registers
- reject fake progress
- maintain benchmark result files
- run wrongness audits

## 4. Delegated Action Team
Owns safe assistant-authorized action design.

Responsibilities:
- define permission levels
- separate draft, fill, submit, payment, and legal-action boundaries
- require logs and user confirmation for sensitive actions

## 5. Opportunity Team
Owns competitions and external programs.

Responsibilities:
- scan programs
- rank fit and value
- map program goals into allowed system adaptations
- prepare submission packets

## 6. Accessibility Team
Owns voice-reader usability.

Responsibilities:
- make critical instructions readable in normal prose
- avoid putting essential logic only inside code blocks
- create voice-readable summaries for code and artifacts

## 7. Reports and Submission Team
Owns outgoing packages.

Responsibilities:
- write ARC papers
- write bounty reports
- write applications
- track submission state
- record feedback and postmortems

## Repo rhythm

Every serious change should answer:

1. What workstream owns this?
2. What proof exists?
3. What could be wrong?
4. What test or review catches that failure?
5. What is the next smallest executable step?
