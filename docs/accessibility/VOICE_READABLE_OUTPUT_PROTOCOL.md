# Voice-Readable Output Protocol

Critical instructions must not exist only inside code fences, boxed text, tables, screenshots, or downloadable files.

Every technical output should include:

1. A voice-readable plain-language summary.
2. A file list with plain descriptions.
3. Claim and proof status in normal prose.
4. Code files for execution when exact syntax matters.
5. Code blocks only as supplemental layers, not the sole source of meaning.

Reason:
The user relies on voice reading. If the reader skips code blocks or boxed regions, the essential work becomes inaccessible.

Required pattern:

- Say what the code does in normal prose.
- Provide the actual code in files or blocks after that.
- State what is proven and what is not proven.
- State next executable step.
