import { createHash } from 'node:crypto';
import { validateConfusablesSemantics } from './validate-confusables-semantics.mjs';

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertPlainRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must return an object`);
  }
  return value;
}

/**
 * Fail-closed construction boundary for Unicode confusables data.
 *
 * Order is mandatory:
 *   exact source-byte verification -> strict UTF-8 decode -> semantic validation
 *   -> canonical parser -> independent count/digest reconciliation -> promotion envelope.
 *
 * The injected sourceVerifier must authenticate the exact bytes and return a record
 * containing at least verified=true. The injected parser must return canonicalMappings,
 * an array of strings in the validator's canonical `SOURCE;TARGET;MA` form.
 */
export function buildVerifiedConfusablesDataset({
  sourceBytes,
  expectedVersion,
  sourceVerifier,
  parser
}) {
  if (!(sourceBytes instanceof Uint8Array)) {
    throw new TypeError('sourceBytes must be a Uint8Array');
  }
  if (typeof sourceVerifier !== 'function') {
    throw new TypeError('sourceVerifier must be a function');
  }
  if (typeof parser !== 'function') {
    throw new TypeError('parser must be a function');
  }

  const sourceSha256 = sha256(sourceBytes);
  const sourceEvidence = assertPlainRecord(
    sourceVerifier(sourceBytes, { expectedVersion, sourceSha256 }),
    'sourceVerifier'
  );
  if (sourceEvidence.verified !== true) {
    fail('ERR_CONFUSABLES_SOURCE_UNVERIFIED', 'Source-byte verification did not succeed', {
      sourceSha256
    });
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes);
  } catch (cause) {
    fail('ERR_CONFUSABLES_UTF8', 'Confusables source is not valid UTF-8', {
      sourceSha256,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }

  const semanticEvidence = validateConfusablesSemantics(text, { expectedVersion });
  const parsed = assertPlainRecord(
    parser(text, {
      expectedVersion,
      sourceSha256,
      semanticEvidence
    }),
    'parser'
  );

  if (!Array.isArray(parsed.canonicalMappings)) {
    fail('ERR_CONFUSABLES_PARSER_SHAPE', 'Parser must return canonicalMappings array');
  }
  if (!parsed.canonicalMappings.every((record) => typeof record === 'string')) {
    fail('ERR_CONFUSABLES_PARSER_SHAPE', 'canonicalMappings must contain only strings');
  }

  const independentlyCanonicalized = [...parsed.canonicalMappings].sort().join('\n');
  const parserRecordCount = parsed.canonicalMappings.length;
  const parserCanonicalSha256 = createHash('sha256')
    .update(independentlyCanonicalized, 'utf8')
    .digest('hex');

  if (parserRecordCount !== semanticEvidence.recordCount) {
    fail('ERR_CONFUSABLES_RECORD_COUNT_MISMATCH', 'Parser record count diverges from semantic validator', {
      semanticRecordCount: semanticEvidence.recordCount,
      parserRecordCount
    });
  }
  if (parserCanonicalSha256 !== semanticEvidence.canonicalSha256) {
    fail('ERR_CONFUSABLES_CANONICAL_DIGEST_MISMATCH', 'Parser canonical digest diverges from semantic validator', {
      semanticCanonicalSha256: semanticEvidence.canonicalSha256,
      parserCanonicalSha256
    });
  }

  return Object.freeze({
    verified: true,
    claim: 'construction_boundary_only',
    sourceSha256,
    unicodeVersion: semanticEvidence.unicodeVersion,
    recordCount: semanticEvidence.recordCount,
    canonicalSha256: semanticEvidence.canonicalSha256,
    sourceEvidence: Object.freeze({ ...sourceEvidence }),
    semanticEvidence,
    dataset: parsed.dataset,
    limits: Object.freeze([
      'Does not establish complete UTS #39 conformance.',
      'Does not establish identifier-profile, script-resolution, bidiSkeleton, browser, or deployment behavior.'
    ])
  });
}
