import { createHash } from 'node:crypto';
import { parseStrictJsonEvidence, StrictJsonEvidenceError } from './strict-json-evidence.mjs';

const DEFAULT_MAX_BYTES = 1024 * 1024;
const DEFAULT_MAX_DEPTH = 64;

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError('input must be a Uint8Array, Buffer, or ArrayBuffer');
}

function assertBoundedStructure(text, maxDepth) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') {
      depth += 1;
      if (depth > maxDepth) {
        throw new StrictJsonEvidenceError('max_depth_exceeded', `JSON nesting exceeds maximum depth ${maxDepth}`, i);
      }
    } else if (ch === '}' || ch === ']') {
      depth -= 1;
    }
  }
}

function assertUnicodeScalars(value, path = '') {
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(i + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          throw new StrictJsonEvidenceError('lone_surrogate', `Lone leading surrogate at ${path || '/'}`, i);
        }
        i += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        throw new StrictJsonEvidenceError('lone_surrogate', `Lone trailing surrogate at ${path || '/'}`, i);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertUnicodeScalars(item, `${path}/${index}`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      assertUnicodeScalars(key, `${path}/<member-name>`);
      assertUnicodeScalars(item, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
    }
  }
}

export function ingestStrictJsonEvidenceBytes(input, options = {}) {
  const bytes = asBytes(input);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive safe integer');
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) throw new TypeError('maxDepth must be a positive safe integer');
  if (bytes.byteLength > maxBytes) {
    throw new StrictJsonEvidenceError('max_bytes_exceeded', `Evidence exceeds maximum byte length ${maxBytes}`, maxBytes);
  }
  if (bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new StrictJsonEvidenceError('utf8_bom_forbidden', 'UTF-8 BOM is forbidden for canonical evidence', 0);
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    throw new StrictJsonEvidenceError('invalid_utf8', `Evidence is not well-formed UTF-8: ${error.message}`, 0);
  }

  assertBoundedStructure(text, maxDepth);
  const result = parseStrictJsonEvidence(text);
  assertUnicodeScalars(result.parsed);

  return {
    ...result,
    raw_sha256: createHash('sha256').update(bytes).digest('hex'),
    raw_byte_length: bytes.byteLength,
    encoding: 'UTF-8',
    bom_policy: 'reject',
    unicode_scalar_policy: 'reject_lone_surrogates',
    limits: { max_bytes: maxBytes, max_depth: maxDepth }
  };
}
