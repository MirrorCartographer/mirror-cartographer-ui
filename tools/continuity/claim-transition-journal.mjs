import { createHash } from 'node:crypto';
import { validateClaimTransition } from './validate-claim-state-transition.mjs';

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function journalDigest(document) {
  return createHash('sha256').update(canonical(document)).digest('hex');
}

function assertBackend(backend) {
  if (!backend || typeof backend.read !== 'function' || typeof backend.compareAndSet !== 'function') {
    throw new Error('invalid-journal-backend');
  }
}

export function emptyTransitionJournal() {
  const document = { schema_version: 1, claims: {}, transitions: [] };
  return Object.freeze({ document, etag: journalDigest(document) });
}

export class ClaimTransitionJournal {
  constructor({ backend, maxRetries = 4 } = {}) {
    assertBackend(backend);
    if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new Error('invalid-max-retries');
    this.backend = backend;
    this.maxRetries = maxRetries;
  }

  async append(record, { coverageEvent = null } = {}) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const snapshot = await this.backend.read();
      const document = snapshot?.document ?? emptyTransitionJournal().document;
      const etag = snapshot?.etag ?? journalDigest(document);
      const head = document.claims?.[record.claim_id] ?? null;
      const expectedPriorDigest = head?.transition_digest ?? null;

      if (head && head.transition_id === record.transition_id) {
        if (head.transition_digest === record.transition_digest) {
          return Object.freeze({ status: 'idempotent', transition_digest: head.transition_digest, claim_id: record.claim_id });
        }
        throw new Error('transition-id-conflict');
      }

      if ((record.prior_transition_digest ?? null) !== expectedPriorDigest) {
        throw new Error('stale-transition-head');
      }
      if (head && record.prior_state !== head.next_state) throw new Error('prior-state-head-mismatch');

      validateClaimTransition(record, { coverageEvent, expectedPriorDigest });

      const nextDocument = {
        schema_version: 1,
        claims: {
          ...(document.claims ?? {}),
          [record.claim_id]: {
            transition_id: record.transition_id,
            transition_digest: record.transition_digest,
            next_state: record.next_state,
            observed_at: record.observed_at
          }
        },
        transitions: [...(document.transitions ?? []), record]
      };
      const nextEtag = journalDigest(nextDocument);
      const result = await this.backend.compareAndSet({ expectedEtag: etag, nextEtag, document: nextDocument });
      if (result?.ok === true) {
        return Object.freeze({ status: 'recorded', transition_digest: record.transition_digest, claim_id: record.claim_id, journal_etag: nextEtag });
      }
      if (result?.reason !== 'precondition-failed') throw new Error('journal-write-failed');
    }
    throw new Error('journal-contention-exhausted');
  }
}
