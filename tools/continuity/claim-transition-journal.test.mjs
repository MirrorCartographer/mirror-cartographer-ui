import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaimTransitionJournal, emptyTransitionJournal } from './claim-transition-journal.mjs';
import { computeTransitionDigest } from './validate-claim-state-transition.mjs';

class MemoryBackend {
  constructor() {
    const initial = emptyTransitionJournal();
    this.document = initial.document;
    this.etag = initial.etag;
  }

  async read() {
    return { document: structuredClone(this.document), etag: this.etag };
  }

  async compareAndSet({ expectedEtag, nextEtag, document }) {
    await new Promise((resolve) => setImmediate(resolve));
    if (expectedEtag !== this.etag) return { ok: false, reason: 'precondition-failed' };
    this.document = structuredClone(document);
    this.etag = nextEtag;
    return { ok: true };
  }
}

function transition(overrides = {}) {
  const record = {
    schema_version: 1,
    transition_id: 't-1',
    claim_id: 'M-004',
    prior_state: 'unresolved',
    next_state: 'inferred',
    observed_at: '2026-07-13T10:00:00Z',
    actor: 'continuity_mining',
    evidence_refs: [{ locator: 'operations/ACTIVE_QUEUE.json', class: 'repository_state' }],
    reason: 'bounded inference',
    privacy_class: 'project_internal',
    falsification_route: 'locate immutable assigning source',
    prior_transition_digest: null,
    coverage_digest: null,
    ...overrides
  };
  record.transition_digest = computeTransitionDigest(record);
  return record;
}

test('records first transition and accepts identical retry idempotently', async () => {
  const backend = new MemoryBackend();
  const journal = new ClaimTransitionJournal({ backend });
  const record = transition();

  assert.equal((await journal.append(record)).status, 'recorded');
  assert.equal((await journal.append(record)).status, 'idempotent');
  assert.equal(backend.document.transitions.length, 1);
});

test('two writers sharing a backend cannot overwrite the same claim head', async () => {
  const backend = new MemoryBackend();
  const a = new ClaimTransitionJournal({ backend });
  const b = new ClaimTransitionJournal({ backend });

  const first = transition({ transition_id: 't-a', next_state: 'inferred', reason: 'candidate A' });
  first.transition_digest = computeTransitionDigest(first);
  const second = transition({
    transition_id: 't-b',
    next_state: 'observed',
    evidence_refs: [{ locator: 'decision-log.json', class: 'direct_inspectable_source' }],
    reason: 'candidate B'
  });
  second.transition_digest = computeTransitionDigest(second);

  const results = await Promise.allSettled([a.append(first), b.append(second)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(backend.document.transitions.length, 1);
});

test('stale prior digest fails closed before persistence', async () => {
  const backend = new MemoryBackend();
  const journal = new ClaimTransitionJournal({ backend });
  await journal.append(transition());

  const stale = transition({
    transition_id: 't-2',
    prior_state: 'inferred',
    next_state: 'observed',
    prior_transition_digest: 'wrong',
    evidence_refs: [{ locator: 'decision-log.json', class: 'direct_inspectable_source' }]
  });
  stale.transition_digest = computeTransitionDigest(stale);

  await assert.rejects(() => journal.append(stale), /stale-transition-head/);
  assert.equal(backend.document.transitions.length, 1);
});
