import { createHash } from 'node:crypto';

const HEX_SEQUENCE = /^[0-9A-F]+(?:\s+[0-9A-F]+)*$/u;

function decodeCodePoints(sequence) {
  if (!HEX_SEQUENCE.test(sequence)) throw new Error(`invalid code point sequence: ${sequence}`);
  return String.fromCodePoint(...sequence.split(/\s+/u).map((value) => Number.parseInt(value, 16)));
}

export function parseConfusables(text, { expectedVersion } = {}) {
  if (typeof text !== 'string') throw new TypeError('confusables data must be text');
  const version = text.match(/^#\s*Version:\s*([^\s#]+)/mu)?.[1] ?? null;
  if (!version) throw new Error('confusables data is missing a Version header');
  if (expectedVersion && version !== expectedVersion) {
    throw new Error(`confusables version mismatch: expected ${expectedVersion}, received ${version}`);
  }

  const mappings = new Map();
  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    const body = rawLine.split('#', 1)[0].trim();
    if (!body) continue;
    const fields = body.split(';').map((field) => field.trim());
    if (fields.length < 3) throw new Error(`invalid confusables record on line ${index + 1}`);
    const [sourceSequence, targetSequence, mappingType] = fields;
    if (mappingType !== 'MA') continue;
    const source = decodeCodePoints(sourceSequence);
    const target = decodeCodePoints(targetSequence);
    if ([...source].length !== 1) throw new Error(`multi-code-point source unsupported on line ${index + 1}`);
    mappings.set(source, target);
  }

  return Object.freeze({
    version,
    sourceSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    mappings
  });
}

export function confusableSkeleton(value, dataset) {
  if (typeof value !== 'string') throw new TypeError('value must be a string');
  if (!dataset?.mappings || !(dataset.mappings instanceof Map)) throw new TypeError('invalid confusables dataset');
  const normalized = value.normalize('NFD');
  let mapped = '';
  for (const codePoint of normalized) mapped += dataset.mappings.get(codePoint) ?? codePoint;
  return mapped.normalize('NFD');
}

function pathFor(parent, key) {
  return `${parent}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

export function auditConfusableObjectKeys(value, dataset, { rootPath = '' } = {}) {
  const collisions = [];
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    if (!node || typeof node !== 'object') return;

    const bySkeleton = new Map();
    for (const key of Object.keys(node)) {
      const skeleton = confusableSkeleton(key, dataset);
      const prior = bySkeleton.get(skeleton);
      if (prior && prior !== key) {
        collisions.push(Object.freeze({
          objectPath: path || '/',
          skeleton,
          keys: Object.freeze([prior, key]),
          unicodeVersion: dataset.version,
          dataSha256: dataset.sourceSha256
        }));
      } else {
        bySkeleton.set(skeleton, key);
      }
      visit(node[key], pathFor(path, key));
    }
  };
  visit(value, rootPath);
  return Object.freeze(collisions);
}

export function enforceNoConfusableObjectKeys(value, dataset, options) {
  const collisions = auditConfusableObjectKeys(value, dataset, options);
  if (collisions.length) {
    const error = new Error('confusable object keys detected');
    error.code = 'ERR_CONFUSABLE_OBJECT_KEYS';
    error.collisions = collisions;
    throw error;
  }
  return value;
}
