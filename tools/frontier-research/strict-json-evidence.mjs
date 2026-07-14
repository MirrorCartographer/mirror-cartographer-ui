import { createHash } from 'node:crypto';

export class StrictJsonEvidenceError extends Error {
  constructor(code, message, offset) {
    super(message);
    this.name = 'StrictJsonEvidenceError';
    this.code = code;
    this.offset = offset;
  }
}

export function parseStrictJsonEvidence(input) {
  if (typeof input !== 'string') throw new TypeError('input must be a UTF-8 decoded string');
  let i = 0;
  const fail = (code, message, at = i) => { throw new StrictJsonEvidenceError(code, message, at); };
  const ws = () => { while (i < input.length && /[\u0009\u000A\u000D\u0020]/.test(input[i])) i++; };

  function string() {
    if (input[i] !== '"') fail('expected_string', 'Expected JSON string');
    const start = i++;
    while (i < input.length) {
      const ch = input[i++];
      if (ch === '"') {
        const token = input.slice(start, i);
        try { return JSON.parse(token); } catch { fail('invalid_string', 'Invalid JSON string escape or Unicode sequence', start); }
      }
      if (ch === '\\') {
        if (i >= input.length) fail('unterminated_escape', 'Unterminated JSON escape');
        const esc = input[i++];
        if (esc === 'u') {
          const hex = input.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('invalid_unicode_escape', 'Invalid Unicode escape', i);
          i += 4;
        } else if (!'"\\/bfnrt'.includes(esc)) fail('invalid_escape', 'Invalid JSON escape', i - 1);
      } else if (ch.charCodeAt(0) <= 0x1f) fail('control_character', 'Unescaped control character in string', i - 1);
    }
    fail('unterminated_string', 'Unterminated JSON string', start);
  }

  function number() {
    const start = i;
    const match = input.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail('invalid_number', 'Invalid JSON number');
    i += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail('non_finite_number', 'Number exceeds interoperable finite range', start);
    return value;
  }

  function value(path) {
    ws();
    const ch = input[i];
    if (ch === '{') return object(path);
    if (ch === '[') return array(path);
    if (ch === '"') return string();
    if (ch === '-' || /[0-9]/.test(ch ?? '')) return number();
    for (const [token, val] of [['true', true], ['false', false], ['null', null]]) {
      if (input.startsWith(token, i)) { i += token.length; return val; }
    }
    fail('unexpected_token', `Unexpected token at ${path || '/'}`);
  }

  function object(path) {
    i++;
    ws();
    const out = Object.create(null);
    const seen = new Set();
    if (input[i] === '}') { i++; return out; }
    while (true) {
      ws();
      const keyOffset = i;
      const key = string();
      if (seen.has(key)) fail('duplicate_member', `Duplicate JSON member ${JSON.stringify(key)} at ${path || '/'}`, keyOffset);
      seen.add(key);
      ws();
      if (input[i++] !== ':') fail('expected_colon', 'Expected colon after object member name', i - 1);
      out[key] = value(`${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
      ws();
      const ch = input[i++];
      if (ch === '}') return out;
      if (ch !== ',') fail('expected_comma_or_end', 'Expected comma or object end', i - 1);
    }
  }

  function array(path) {
    i++;
    ws();
    const out = [];
    if (input[i] === ']') { i++; return out; }
    let index = 0;
    while (true) {
      out.push(value(`${path}/${index++}`));
      ws();
      const ch = input[i++];
      if (ch === ']') return out;
      if (ch !== ',') fail('expected_comma_or_end', 'Expected comma or array end', i - 1);
    }
  }

  ws();
  const parsed = value('');
  ws();
  if (i !== input.length) fail('trailing_content', 'Trailing content after JSON value');
  return {
    parsed,
    raw_sha256: createHash('sha256').update(input, 'utf8').digest('hex'),
    duplicate_member_policy: 'reject_before_semantic_canonicalization'
  };
}
