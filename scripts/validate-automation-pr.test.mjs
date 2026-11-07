import assert from 'node:assert/strict';
import test from 'node:test';

import { extractSections, validatePullRequestBody } from './validate-automation-pr.mjs';

const VALID_BODY = `
## Problem
Automated work was producing broad research output without a bounded repository state change.

## Implemented change
Add a deterministic validator and pull-request workflow for branches prefixed with automation/.

## Test evidence
Command: node --test scripts/validate-automation-pr.test.mjs. Result: 5 tests passed with exit code 0.

## Risks
The textual checks can reject unusually formatted but legitimate evidence until the wording is corrected.

## Rollback
Revert the gate commit or disable the automation-pr-gate workflow file to restore prior behavior.

## Privacy review
No personal data, private conversation text, credentials, secrets, or sensitive records are read or emitted.

## Next executable step
Update the scheduled build prompt to require automation/ branches and this exact pull-request contract.
`;

test('extracts required level-two sections', () => {
  const sections = extractSections(VALID_BODY);
  assert.equal(sections.get('Problem').startsWith('Automated work'), true);
  assert.equal(sections.size, 7);
});

test('accepts a complete, substantive automation pull request body', () => {
  const result = validatePullRequestBody(VALID_BODY);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('rejects missing required sections', () => {
  const result = validatePullRequestBody(VALID_BODY.replace(/## Rollback[^]*?## Privacy review/, '## Privacy review'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Missing required section: ## Rollback/);
});

test('rejects placeholder-only content', () => {
  const result = validatePullRequestBody(VALID_BODY.replace(
    'Automated work was producing broad research output without a bounded repository state change.',
    'TBD',
  ));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Problem is empty or not substantive/);
});

test('requires concrete rollback and test language', () => {
  const body = VALID_BODY
    .replace('Command: node --test scripts/validate-automation-pr.test.mjs. Result: 5 tests passed with exit code 0.', 'Evidence exists and is documented in detail for reviewers.')
    .replace('Revert the gate commit or disable the automation-pr-gate workflow file to restore prior behavior.', 'The impact is understood and manageable by the project team.');
  const result = validatePullRequestBody(body);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Test evidence must name a command/);
  assert.match(result.errors.join('\n'), /Rollback must state a concrete reversal action/);
});
