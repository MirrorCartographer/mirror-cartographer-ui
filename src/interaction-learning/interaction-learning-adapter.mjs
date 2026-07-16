import crypto from 'node:crypto';

const ALLOWED_EVENT_TYPES = new Set([
  'composition_exported','feedback_submitted','pattern_saved','navigation_selected',
  'mood_selected','tempo_changed','artifact_replayed','artifact_erased','artifact_returned','user_correction'
]);
const CLAIM_CLASSES = new Set([
  'observed_interaction','history_supported_inference','testable_hypothesis','rejected_inference','unknown'
]);
const FORBIDDEN_KEYS = new Set([
  'email','name','fullName','ip','ipAddress','userAgent','deviceFingerprint','rawText','transcript','psychology','diagnosis'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function findForbidden(value, path = '$', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) findings.push(next);
    findForbidden(child, next, findings);
  }
  return findings;
}

export function normalizeConsentedInteractionArtifact(input) {
  const errors = [];
  if (input?.consent?.interactionLearning !== true) errors.push('explicit interactionLearning consent is required');
  if (!input?.artifactId) errors.push('artifactId is required');
  if (!input?.exportedAt) errors.push('exportedAt is required');
  if (!Array.isArray(input?.events) || input.events.length === 0) errors.push('events must be a non-empty array');

  const forbidden = findForbidden(input);
  if (forbidden.length) errors.push(`forbidden private fields: ${forbidden.join(', ')}`);

  const seen = new Set();
  const events = [];
  for (const [index, event] of (input?.events ?? []).entries()) {
    if (!ALLOWED_EVENT_TYPES.has(event?.type)) {
      errors.push(`events[${index}] has unsupported type: ${event?.type ?? 'missing'}`);
      continue;
    }
    if (!event?.at) errors.push(`events[${index}].at is required`);
    const normalized = {
      type: event.type,
      at: event.at,
      target: event.target ?? null,
      value: event.value ?? null,
      context: event.context ?? null
    };
    const eventId = hash(normalized);
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    events.push({ eventId, ...normalized });
  }

  if (errors.length) return { valid: false, errors };

  const evidenceId = hash({ artifactId: input.artifactId, exportedAt: input.exportedAt, events });
  return {
    valid: true,
    errors: [],
    record: {
      schemaVersion: '1.0.0',
      evidenceId,
      artifactId: input.artifactId,
      exportedAt: input.exportedAt,
      sourceClass: 'user_exported_interaction_artifact',
      consent: { interactionLearning: true, consentedAt: input.consent.consentedAt ?? null },
      privacyBoundary: {
        containsDirectIdentifiers: false,
        containsRawFreeText: false,
        allowedUse: 'foundation_interaction_learning'
      },
      events,
      claims: events.map((event) => ({
        claimClass: 'observed_interaction',
        statement: `${event.type}${event.target ? `:${event.target}` : ''}`,
        evidenceEventIds: [event.eventId],
        confidence: 1,
        alternatives: [],
        limits: ['Records an exported interaction event only; does not establish motive, preference, or psychology.']
      })),
      adversarialChecks: {
        duplicateEventsRemoved: (input.events?.length ?? 0) - events.length,
        privateFieldScanPassed: true,
        staleEvidence: false,
        contradictoryBehavior: 'not_evaluated_single_artifact',
        selectionBias: 'unknown_export_selection'
      }
    }
  };
}

export function validateLearningClaim(claim) {
  const errors = [];
  if (!CLAIM_CLASSES.has(claim?.claimClass)) errors.push('invalid claimClass');
  if (!claim?.statement) errors.push('statement is required');
  if (!Array.isArray(claim?.evidenceEventIds)) errors.push('evidenceEventIds must be an array');
  if (claim?.claimClass === 'history_supported_inference') {
    if (!Array.isArray(claim.alternatives) || claim.alternatives.length === 0) errors.push('history_supported_inference requires alternatives');
    if (!Array.isArray(claim.limits) || claim.limits.length === 0) errors.push('history_supported_inference requires limits');
    if (typeof claim.confidence !== 'number' || claim.confidence <= 0 || claim.confidence >= 1) errors.push('history_supported_inference confidence must be between 0 and 1');
  }
  if (claim?.claimClass === 'observed_interaction' && claim?.confidence !== 1) errors.push('observed_interaction confidence must be 1');
  return { valid: errors.length === 0, errors };
}
