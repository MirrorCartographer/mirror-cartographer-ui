import { createHash } from 'node:crypto';

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function parseCodePoints(field, lineNumber, role) {
  const tokens = field.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) {
    fail('ERR_CONFUSABLES_EMPTY_FIELD', `${role} is empty`, { lineNumber, role });
  }

  return tokens.map((token) => {
    if (!/^[0-9A-F]{4,6}$/u.test(token)) {
      fail('ERR_CONFUSABLES_CODE_POINT_SYNTAX', `Invalid ${role} code point`, {
        lineNumber,
        role,
        token
      });
    }
    const value = Number.parseInt(token, 16);
    if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
      fail('ERR_CONFUSABLES_UNICODE_SCALAR', `Invalid Unicode scalar in ${role}`, {
        lineNumber,
        role,
        token
      });
    }
    return value;
  });
}

function canonicalSequence(sequence) {
  return sequence.map((value) => value.toString(16).toUpperCase().padStart(4, '0')).join(' ');
}

/**
 * Validate the semantic invariants of a Unicode confusables.txt payload.
 *
 * This is intentionally separate from byte/source authentication. Call it only
 * after the exact source bytes have passed the pinned-source verifier.
 */
export function validateConfusablesSemantics(text, { expectedVersion } = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }
  if (typeof expectedVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(expectedVersion)) {
    throw new TypeError('expectedVersion must be a Unicode version string');
  }

  const versionMatch = text.match(/^#\s*Version:\s*([^\s]+)\s*$/mu);
  if (!versionMatch) {
    fail('ERR_CONFUSABLES_VERSION_MISSING', 'Unicode confusables version header is missing');
  }
  if (versionMatch[1] !== expectedVersion) {
    fail('ERR_CONFUSABLES_VERSION_MISMATCH', 'Unicode confusables version mismatch', {
      expectedVersion,
      observedVersion: versionMatch[1]
    });
  }

  const mappings = new Map();
  let recordCount = 0;
  const lines = text.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const data = lines[index].split('#', 1)[0].trim();
    if (!data) continue;

    const fields = data.split(';').map((field) => field.trim());
    if (fields.length !== 3) {
      fail('ERR_CONFUSABLES_FIELD_COUNT', 'Confusables record must contain exactly three fields', {
        lineNumber,
        fieldCount: fields.length
      });
    }

    const source = parseCodePoints(fields[0], lineNumber, 'source');
    const target = parseCodePoints(fields[1], lineNumber, 'target');
    if (source.length !== 1) {
      fail('ERR_CONFUSABLES_SOURCE_ARITY', 'UTS #39 confusables source must be one character', {
        lineNumber,
        source: canonicalSequence(source)
      });
    }
    if (fields[2] !== 'MA') {
      fail('ERR_CONFUSABLES_MAPPING_TYPE', 'Confusables mapping type must be MA', {
        lineNumber,
        observedType: fields[2]
      });
    }

    const sourceKey = source[0];
    if (mappings.has(sourceKey)) {
      fail('ERR_CONFUSABLES_DUPLICATE_SOURCE', 'Duplicate confusables source mapping', {
        lineNumber,
        source: canonicalSequence(source)
      });
    }
    mappings.set(sourceKey, Object.freeze(target));
    recordCount += 1;
  }

  if (recordCount === 0) {
    fail('ERR_CONFUSABLES_NO_RECORDS', 'Confusables payload contains no mappings');
  }

  for (const [source, target] of mappings) {
    const remappedTarget = target.flatMap((codePoint) => mappings.get(codePoint) ?? [codePoint]);
    if (canonicalSequence(remappedTarget) !== canonicalSequence(target)) {
      fail('ERR_CONFUSABLES_NOT_IDEMPOTENT', 'Confusables mapping is not idempotent', {
        source: canonicalSequence([source]),
        target: canonicalSequence(target),
        remappedTarget: canonicalSequence(remappedTarget)
      });
    }
  }

  const canonicalMappings = [...mappings.entries()]
    .sort(([left], [right]) => left - right)
    .map(([source, target]) => `${canonicalSequence([source])};${canonicalSequence(target)};MA`)
    .join('\n');

  return Object.freeze({
    unicodeVersion: expectedVersion,
    recordCount,
    canonicalSha256: createHash('sha256').update(canonicalMappings, 'utf8').digest('hex'),
    invariants: Object.freeze({
      exactThreeFieldRecords: true,
      mappingTypeMA: true,
      uniqueSingleScalarSources: true,
      nonemptyScalarTargets: true,
      idempotentMappings: true
    })
  });
}
