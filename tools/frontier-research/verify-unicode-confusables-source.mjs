import { createHash } from 'node:crypto';

const VERSION_RE = /^#\s*Version:\s*([^\s#]+)\s*$/mu;
const DATE_RE = /^#\s*Date:\s*(.+?)\s*$/mu;
const RECORD_RE = /^\s*[0-9A-F]+(?:\s+[0-9A-F]+)*\s*;\s*[0-9A-F]+(?:\s+[0-9A-F]+)*\s*;\s*MA\s*(?:#.*)?$/u;

export function verifyUnicodeConfusablesSource(bytes, manifest) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array');
  if (!manifest || typeof manifest !== 'object') throw new TypeError('manifest is required');
  const required = ['sourceUrl', 'unicodeVersion', 'sha256', 'byteLength', 'recordCount'];
  for (const key of required) if (!(key in manifest)) throw new Error(`manifest missing ${key}`);
  if (!/^https:\/\/www\.unicode\.org\/Public\/\d+\.\d+\.\d+\/security\/confusables\.txt$/u.test(manifest.sourceUrl)) {
    throw new Error('sourceUrl must be an exact versioned Unicode confusables URL');
  }

  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const observed = {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.byteLength,
    unicodeVersion: text.match(VERSION_RE)?.[1] ?? null,
    dataDate: text.match(DATE_RE)?.[1] ?? null,
    recordCount: text.split(/\r?\n/u).filter((line) => RECORD_RE.test(line)).length
  };
  const mismatches = [];
  for (const key of ['sha256', 'byteLength', 'unicodeVersion', 'recordCount']) {
    if (observed[key] !== manifest[key]) mismatches.push({ field: key, expected: manifest[key], observed: observed[key] });
  }
  return Object.freeze({ verified: mismatches.length === 0, observed: Object.freeze(observed), mismatches: Object.freeze(mismatches) });
}

export function enforceUnicodeConfusablesSource(bytes, manifest) {
  const result = verifyUnicodeConfusablesSource(bytes, manifest);
  if (!result.verified) {
    const error = new Error('Unicode confusables source verification failed');
    error.code = 'ERR_UNICODE_CONFUSABLES_SOURCE';
    error.result = result;
    throw error;
  }
  return result;
}
