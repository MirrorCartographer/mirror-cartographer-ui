const CANONICAL_NODE = 'project:mirror-cartographer';
const CANONICAL_TERM = 'Mirror Cartographer';

const EXACT_ALIASES = new Map([
  ['mirror cartographer', { aliasClass: 'canonical', confidence: 1 }],
  ['mc', { aliasClass: 'abbreviation', confidence: 1 }],
  ['mirrorcartographer', { aliasClass: 'concatenation', confidence: 1 }],
  ['mirror-cartographer', { aliasClass: 'slug', confidence: 1 }],
  ['mc mode', { aliasClass: 'nickname_or_feature_reference', confidence: 0.98, relation: 'mode' }],
]);

const HIGH_CONFIDENCE_MISSPELLINGS = new Map([
  ['miror cartographer', 0.96],
  ['mirror cartograper', 0.96],
]);

function normalizeSurface(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function resolveProjectAlias(surfaceForm) {
  if (typeof surfaceForm !== 'string') {
    return {
      canonicalNode: null,
      canonicalTerm: null,
      originalSurfaceForm: surfaceForm,
      normalizedSurfaceForm: null,
      aliasClass: 'invalid',
      confidence: 0,
      unresolved: true,
      reason: 'surface_form_must_be_string',
    };
  }

  const originalSurfaceForm = surfaceForm;
  const normalizedSurfaceForm = normalizeSurface(surfaceForm);
  if (!normalizedSurfaceForm) {
    return {
      canonicalNode: null,
      canonicalTerm: null,
      originalSurfaceForm,
      normalizedSurfaceForm,
      aliasClass: 'empty',
      confidence: 0,
      unresolved: true,
      reason: 'surface_form_empty',
    };
  }

  const exact = EXACT_ALIASES.get(normalizedSurfaceForm);
  if (exact) {
    return {
      canonicalNode: CANONICAL_NODE,
      canonicalTerm: CANONICAL_TERM,
      originalSurfaceForm,
      normalizedSurfaceForm,
      aliasClass: exact.aliasClass,
      confidence: exact.confidence,
      unresolved: false,
      ...(exact.relation ? { relation: exact.relation } : {}),
    };
  }

  const misspellingConfidence = HIGH_CONFIDENCE_MISSPELLINGS.get(normalizedSurfaceForm);
  if (misspellingConfidence) {
    return {
      canonicalNode: CANONICAL_NODE,
      canonicalTerm: CANONICAL_TERM,
      originalSurfaceForm,
      normalizedSurfaceForm,
      aliasClass: 'likely_misspelling',
      confidence: misspellingConfidence,
      unresolved: false,
      resolutionBasis: ['edit_distance', 'project_salience', 'lexicon_example'],
    };
  }

  return {
    canonicalNode: null,
    canonicalTerm: null,
    originalSurfaceForm,
    normalizedSurfaceForm,
    aliasClass: 'unknown',
    confidence: 0,
    unresolved: true,
    reason: 'insufficient_evidence',
  };
}
