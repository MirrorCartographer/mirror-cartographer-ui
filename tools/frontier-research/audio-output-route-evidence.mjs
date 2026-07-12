const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,199}$/;
const SESSION_ID = /^[A-Za-z0-9_-]{16,128}$/;
const ROUTE_API_STATES = new Set(['supported', 'unsupported', 'unobservable']);
const SETTLEMENTS = new Set(['fulfilled', 'rejected', 'not_attempted']);

export function validateAudioOutputRouteEvidence(input = {}) {
  const commitSha = normalize(input.commit_sha);
  const deploymentId = normalize(input.deployment_id);
  const sessionId = normalize(input.session_id);

  if (!SHA40.test(commitSha)) return fail('invalid_commit_sha');
  if (!DEPLOYMENT_ID.test(deploymentId)) return fail('invalid_deployment_id');
  if (!SESSION_ID.test(sessionId)) return fail('invalid_session_id');

  const apiState = input.route_api_state;
  if (!ROUTE_API_STATES.has(apiState)) return fail('invalid_route_api_state');

  if (apiState === 'unsupported') {
    return validResult('route_api_unsupported', commitSha, deploymentId, sessionId, {
      route_api_state: apiState,
      requested_sink_id: null,
      observed_sink_id: null,
      enumerated_audiooutput_ids: [],
      devicechange_observed: null
    });
  }

  if (apiState === 'unobservable') {
    return validResult('route_unobservable', commitSha, deploymentId, sessionId, {
      route_api_state: apiState,
      requested_sink_id: null,
      observed_sink_id: null,
      enumerated_audiooutput_ids: [],
      devicechange_observed: null
    });
  }

  const settlement = input.set_sink_id_status;
  if (!SETTLEMENTS.has(settlement)) return fail('invalid_set_sink_id_status');
  if (settlement === 'rejected') {
    return validResult('route_selection_rejected', commitSha, deploymentId, sessionId, {
      route_api_state: apiState,
      requested_sink_id: normalizeNullable(input.requested_sink_id),
      observed_sink_id: normalizeNullable(input.observed_sink_id),
      enumerated_audiooutput_ids: sanitizeIds(input.enumerated_audiooutput_ids),
      devicechange_observed: booleanOrNull(input.devicechange_observed),
      rejection_name: normalizeNullable(input.rejection_name)
    });
  }
  if (settlement !== 'fulfilled') return fail('route_selection_not_fulfilled');

  const requestedSinkId = normalizeNullable(input.requested_sink_id);
  const observedSinkId = normalizeNullable(input.observed_sink_id);
  const ids = sanitizeIds(input.enumerated_audiooutput_ids);
  if (ids === null) return fail('invalid_enumerated_audiooutput_ids');

  if (containsExposedLabel(input.enumerated_audiooutputs)) return fail('unredacted_device_label');

  const changed = booleanOrNull(input.devicechange_observed);
  if (input.devicechange_observed !== undefined && changed === null) return fail('invalid_devicechange_observation');

  if (requestedSinkId === '') {
    if (observedSinkId !== '') return fail('default_route_observation_mismatch');
    return validResult('user_agent_default_route_only', commitSha, deploymentId, sessionId, {
      route_api_state: apiState,
      requested_sink_id: '',
      observed_sink_id: '',
      enumerated_audiooutput_ids: ids,
      devicechange_observed: changed
    });
  }

  if (!requestedSinkId) return fail('missing_requested_sink_id');
  if (observedSinkId !== requestedSinkId) return fail('requested_observed_sink_mismatch');
  if (!ids.includes(requestedSinkId)) return fail('observed_sink_not_enumerated');

  return validResult('non_default_route_bound', commitSha, deploymentId, sessionId, {
    route_api_state: apiState,
    requested_sink_id: requestedSinkId,
    observed_sink_id: observedSinkId,
    enumerated_audiooutput_ids: ids,
    devicechange_observed: changed
  });
}

function validResult(classification, commitSha, deploymentId, sessionId, route) {
  return Object.freeze({
    valid: true,
    reason: classification,
    classification,
    binding: Object.freeze({ commit_sha: commitSha, deployment_id: deploymentId, session_id: sessionId }),
    route: Object.freeze(route),
    epistemic_limits: Object.freeze([
      'Browser-visible route binding does not prove that acoustic energy reached a physical speaker.',
      'An available sink can become unavailable after selection while the stored sink identifier remains unchanged.',
      'Human audibility requires a separate physical observation.'
    ])
  });
}

function sanitizeIds(value) {
  if (!Array.isArray(value)) return null;
  const ids = value.map(normalizeNullable);
  if (ids.some((id) => id === null)) return null;
  return [...new Set(ids)];
}

function containsExposedLabel(value) {
  if (!Array.isArray(value)) return false;
  return value.some((entry) => entry && typeof entry.label === 'string' && entry.label.trim() !== '');
}

function booleanOrNull(value) {
  return value === true || value === false ? value : null;
}

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullable(value) {
  return typeof value === 'string' ? value.trim() : null;
}

function fail(reason) {
  return Object.freeze({ valid: false, reason, classification: null });
}
