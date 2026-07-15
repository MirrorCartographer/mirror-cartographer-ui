import { enforceUnicodeConfusablesSource } from './verify-unicode-confusables-source.mjs';

/**
 * Verify exact Unicode confusables source bytes before allowing dataset construction.
 * The parser is injected so this boundary can wrap the repository's current parser
 * without duplicating its semantic implementation.
 */
export function constructVerifiedConfusablesDataset(bytes, manifest, parseConfusables) {
  if (typeof parseConfusables !== 'function') {
    throw new TypeError('parseConfusables must be a function');
  }

  const verification = enforceUnicodeConfusablesSource(bytes, manifest);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const dataset = parseConfusables(text, { expectedVersion: manifest.unicodeVersion });

  if (dataset == null) {
    const error = new Error('Confusables parser returned no dataset');
    error.code = 'ERR_UNICODE_CONFUSABLES_DATASET';
    throw error;
  }

  return Object.freeze({
    dataset,
    source: Object.freeze({
      sourceUrl: manifest.sourceUrl,
      unicodeVersion: manifest.unicodeVersion,
      sha256: verification.observed.sha256,
      byteLength: verification.observed.byteLength,
      recordCount: verification.observed.recordCount,
      dataDate: verification.observed.dataDate
    })
  });
}
