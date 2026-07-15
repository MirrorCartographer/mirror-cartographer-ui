function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function parseScalarSequence(field, lineNumber, role) {
  const tokens = field.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) {
    fail('ERR_CANONICAL_CONFUSABLES_EMPTY_FIELD', `${role} is empty`, { lineNumber, role });
  }

  return tokens.map((token) => {
    if (!/^[0-9A-Fa-f]{4,6}$/u.test(token)) {
      fail('ERR_CANONICAL_CONFUSABLES_CODE_POINT', `Invalid ${role} code point`, {
        lineNumber,
        role,
        token
      });
    }
    const scalar = Number.parseInt(token, 16);
    if (scalar > 0x10ffff || (scalar >= 0xd800 && scalar <= 0xdfff)) {
      fail('ERR_CANONICAL_CONFUSABLES_SCALAR', `Invalid Unicode scalar in ${role}`, {
        lineNumber,
        role,
        token
      });
    }
    return scalar;
  });
}

function canonicalSequence(sequence) {
  return sequence
    .map((scalar) => scalar.toString(16).toUpperCase().padStart(4, '0'))
    .join(' ');
}

/**
 * Repository-owned canonical parser for an already authenticated and semantically
 * validated Unicode confusables.txt payload.
 *
 * This parser intentionally repeats structural checks instead of trusting the
 * semantic validator's internal representation. Agreement is established later
 * by record count and canonical digest in buildVerifiedConfusablesDataset.
 */
export function parseCanonicalConfusables(text) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }

  const dataset = new Map();
  const lines = text.split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const data = lines[index].split('#', 1)[0].trim();
    if (!data) continue;

    const fields = data.split(';').map((field) => field.trim());
    if (fields.length !== 3) {
      fail('ERR_CANONICAL_CONFUSABLES_FIELD_COUNT', 'Record must contain exactly three fields', {
        lineNumber,
        fieldCount: fields.length
      });
    }

    const source = parseScalarSequence(fields[0], lineNumber, 'source');
    const target = parseScalarSequence(fields[1], lineNumber, 'target');
    if (source.length !== 1) {
      fail('ERR_CANONICAL_CONFUSABLES_SOURCE_ARITY', 'Source must contain exactly one scalar', {
        lineNumber,
        source: canonicalSequence(source)
      });
    }
    if (fields[2] !== 'MA') {
      fail('ERR_CANONICAL_CONFUSABLES_MAPPING_TYPE', 'Mapping type must be MA', {
        lineNumber,
        observedType: fields[2]
      });
    }
    if (dataset.has(source[0])) {
      fail('ERR_CANONICAL_CONFUSABLES_DUPLICATE_SOURCE', 'Duplicate source mapping', {
        lineNumber,
        source: canonicalSequence(source)
      });
    }

    dataset.set(source[0], Object.freeze([...target]));
  }

  if (dataset.size === 0) {
    fail('ERR_CANONICAL_CONFUSABLES_NO_RECORDS', 'Payload contains no mappings');
  }

  const canonicalMappings = [...dataset.entries()]
    .sort(([left], [right]) => left - right)
    .map(([source, target]) => `${canonicalSequence([source])};${canonicalSequence(target)};MA`);

  return {
    canonicalMappings,
    dataset
  };
}
