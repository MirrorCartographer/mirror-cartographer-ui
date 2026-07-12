/**
 * Fail-closed classifier for GitHub Actions workflow-run observations.
 * It distinguishes a genuinely absent run from an observation query that
 * could not have seen the expected event or all result pages.
 */
export function classifyWorkflowObservation(input) {
  const {
    expectedHeadSha,
    expectedWorkflow,
    expectedEvents = [],
    query = {},
    runs = [],
  } = input ?? {};

  if (!/^[0-9a-f]{40}$/i.test(expectedHeadSha ?? '')) {
    throw new TypeError('expectedHeadSha must be a 40-character commit SHA');
  }
  if (typeof expectedWorkflow !== 'string' || expectedWorkflow.trim() === '') {
    throw new TypeError('expectedWorkflow is required');
  }
  if (!Array.isArray(expectedEvents) || expectedEvents.length === 0) {
    throw new TypeError('expectedEvents must contain at least one event');
  }
  if (!Array.isArray(runs)) throw new TypeError('runs must be an array');

  const coveredEvents = new Set(query.coveredEvents ?? []);
  const missingEventCoverage = expectedEvents.filter((event) => !coveredEvents.has(event));
  const paginationComplete = query.paginationComplete === true;
  const headShaBound = query.headSha === expectedHeadSha;

  const exactMatches = runs.filter((run) =>
    run &&
    run.head_sha === expectedHeadSha &&
    run.name === expectedWorkflow &&
    expectedEvents.includes(run.event)
  );

  const conflictingMatches = runs.filter((run) =>
    run && run.name === expectedWorkflow && run.head_sha !== expectedHeadSha
  );

  if (exactMatches.length > 0) {
    return {
      classification: 'matching_run_observed',
      runtimeVerified: exactMatches.some((run) => run.status === 'completed' && run.conclusion === 'success'),
      matchingRuns: exactMatches.map(normalizeRun),
      claimBoundary: 'Observation authenticates provider-reported run metadata only; it does not prove artifact contents without separate verification.',
    };
  }

  if (missingEventCoverage.length > 0 || !paginationComplete || !headShaBound) {
    return {
      classification: 'observation_inconclusive',
      runtimeVerified: false,
      reasons: [
        ...(missingEventCoverage.length ? [`missing_event_coverage:${missingEventCoverage.join(',')}`] : []),
        ...(!paginationComplete ? ['pagination_incomplete'] : []),
        ...(!headShaBound ? ['query_not_bound_to_expected_head_sha'] : []),
      ],
      conflictingRuns: conflictingMatches.map(normalizeRun),
    };
  }

  return {
    classification: 'no_matching_run_observed_with_complete_scope',
    runtimeVerified: false,
    reasons: ['complete_query_returned_no_exact_workflow_head_sha_event_match'],
    conflictingRuns: conflictingMatches.map(normalizeRun),
  };
}

function normalizeRun(run) {
  return {
    id: run.id ?? null,
    name: run.name ?? null,
    event: run.event ?? null,
    head_sha: run.head_sha ?? null,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    run_attempt: run.run_attempt ?? null,
    html_url: run.html_url ?? null,
  };
}
