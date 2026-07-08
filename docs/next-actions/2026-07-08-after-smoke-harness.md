# Next action after smoke harness

Status: active next-action note.

## What changed

A phone-first Playwright smoke harness now exists:

- `tests/smoke.spec.js`
- `playwright.config.js`
- `npm run test:smoke`

The harness checks mobile render, sky button/canvas presence, first tap survival, console/page errors, and the wordless visible surface.

## Self-directed automation verdict

The setup is better now.

Before: the loops could keep adding music/visual features without a repeatable check.

Now: the loops have a testable gate they can run before or after feature work.

## Hosting verdict

Keep Vercel for now. The next limitation is not hosting; it is whether automated runs can verify behavior before committing more features.

Do not migrate until:

1. `npm run test:smoke` passes locally or in CI.
2. The site is manually confirmed on iPhone after a tap.
3. A stable branch or rollback rule exists.

## Suggested next action

Run the smoke test in the available execution environment or CI. If it fails, fix only the smoke failure. If it passes, the next build step should be a Composition Clock primitive so audio, visuals, touch, and weather share one event stream.

## Rule for future automations

Every future feature cycle should include one of:

- smoke test run result;
- proof that test execution was unavailable;
- a smaller static check;
- or a next-action note explaining the blocker.

No new creative layer should be added without checking mobile stability or explaining why the check could not be performed.
