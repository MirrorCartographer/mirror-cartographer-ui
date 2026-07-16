import crypto from 'node:crypto';

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function keyFor(event) {
  return `${event.type}|${event.target ?? ''}|${JSON.stringify(event.value ?? null)}`;
}

export function analyzeInteractionHistory(records, options = {}) {
  if (!Array.isArray(records)) return { valid: false, errors: ['records must be an array'] };

  const now = options.now instanceof Date ? options.now : new Date();
  const minArtifacts = options.minArtifacts ?? 3;
  const maxAgeDays = options.maxAgeDays ?? 365;
  const errors = [];
  const unique = new Map();

  records.forEach((record, index) => {
    if (record?.sourceClass !== 'user_exported_interaction_artifact') errors.push(`records[${index}] has unsupported sourceClass`);
    else if (record?.consent?.interactionLearning !== true) errors.push(`records[${index}] lacks consent`);
    else if (!record?.evidenceId || !Array.isArray(record?.events)) errors.push(`records[${index}] is not normalized`);
    else if (!unique.has(record.evidenceId)) unique.set(record.evidenceId, record);
  });

  if (errors.length) return { valid: false, errors };

  const deduplicated = [...unique.values()];
  const fresh = deduplicated.filter((record) => {
    const timestamp = Date.parse(record.exportedAt);
    return Number.isFinite(timestamp) && now.getTime() - timestamp <= maxAgeDays * 86400000;
  });
  const staleCount = deduplicated.length - fresh.length;
  const patterns = new Map();

  for (const record of fresh) {
    const seenInArtifact = new Set();
    for (const event of record.events) {
      const key = keyFor(event);
      if (seenInArtifact.has(key)) continue;
      seenInArtifact.add(key);
      const item = patterns.get(key) ?? { event, artifacts: [], eventIds: [] };
      item.artifacts.push(record.artifactId);
      item.eventIds.push(event.eventId);
      patterns.set(key, item);
    }
  }

  const inferences = [];
  const hypotheses = [];
  const triggers = new Map();

  for (const [key, item] of patterns) {
    const support = item.artifacts.length;
    const ratio = fresh.length ? support / fresh.length : 0;

    if (support >= minArtifacts && ratio >= 0.6) {
      inferences.push({
        claimClass: 'history_supported_inference',
        statement: `The exported pattern ${key} recurred across ${support} consented artifacts.`,
        evidenceEventIds: item.eventIds,
        confidence: Math.min(0.9, Number((0.5 + ratio * 0.4).toFixed(2))),
        alternatives: ['Export selection may favor this pattern.', 'The interface may make this action unusually easy or necessary.'],
        limits: [`Based on ${fresh.length} fresh deduplicated artifacts.`, 'Does not establish motive or behavior outside exported sessions.']
      });
      const trigger = {
        kind: 'review_repeated_pattern',
        targetTeam: item.event.type === 'navigation_selected' ? 'accessibility-navigation' : 'composition-design',
        evidenceEventIds: item.eventIds,
        proposedAction: `Test whether ${key} persists after removing defaults and clarifying controls.`
      };
      trigger.triggerId = digest(trigger);
      triggers.set(trigger.triggerId, trigger);
    } else if (support >= 2) {
      hypotheses.push({
        claimClass: 'testable_hypothesis',
        statement: `${key} may be a recurring exported interaction pattern.`,
        evidenceEventIds: item.eventIds,
        confidence: null,
        alternatives: ['Export-selection bias', 'Interface default', 'Coincidental repetition'],
        limits: [`Observed in ${support} of ${fresh.length} fresh artifacts; inference threshold not met.`]
      });
    }
  }

  return {
    valid: true,
    errors: [],
    report: {
      schemaVersion: '1.0.0',
      analyzedAt: now.toISOString(),
      evidenceInspected: {
        submittedRecords: records.length,
        deduplicatedRecords: deduplicated.length,
        freshRecords: fresh.length,
        staleRecordsExcluded: staleCount
      },
      observations: fresh.flatMap((record) => record.claims ?? []).filter((claim) => claim.claimClass === 'observed_interaction'),
      historySupportedInferences: inferences,
      testableHypotheses: hypotheses,
      rejectedInferences: [{
        claimClass: 'rejected_inference',
        statement: 'Interaction recurrence establishes a private internal state.',
        evidenceEventIds: [],
        confidence: 1,
        alternatives: [],
        limits: ['Rejected because the evidence records actions, not internal state.']
      }],
      unknowns: [
        'Whether exports represent all sessions or a selected subset.',
        'Whether repeated actions were choices, defaults, recovery actions, or accessibility workarounds.'
      ],
      adversarialChecks: {
        duplicateRecordsRemoved: records.length - deduplicated.length,
        staleEvidenceExcluded: staleCount,
        contradictoryBehaviorRetained: true,
        selectionBiasResolved: false,
        internalStateInferenceAllowed: false,
        minimumIndependentArtifacts: minArtifacts
      },
      peerTriggers: [...triggers.values()]
    }
  };
}
