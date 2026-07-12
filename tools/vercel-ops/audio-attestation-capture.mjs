import { randomBytes } from 'node:crypto';
import { validateAudioAttestationBinding } from '../frontier-research/audio-attestation-binding.mjs';

const SESSION_ID_BYTES = 18;
const ALLOWED_CLASSIFICATIONS = new Set(['human_confirmed', 'contradicted']);

export function createAudioAttestationSession(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const random = typeof options.randomBytes === 'function' ? options.randomBytes : randomBytes;
  const sessionId = toBase64Url(random(SESSION_ID_BYTES));

  const state = {
    session_id: sessionId,
    user_activation_at: null,
    runtime_observed_at: null,
    human_observed_at: null,
    audio_context_state: null,
    source_started: false,
    destination_connected: false,
    human_reported_audible: null,
    classification: null
  };

  return Object.freeze({
    session_id: sessionId,
    recordActivation(at = now()) {
      assertUnset(state.user_activation_at, 'activation_already_recorded');
      state.user_activation_at = requireTime(at, 'invalid_activation_time');
      return this;
    },
    recordRuntime(observation = {}, at = now()) {
      if (!state.user_activation_at) throw new Error('activation_required');
      assertUnset(state.runtime_observed_at, 'runtime_already_recorded');
      state.runtime_observed_at = requireTime(at, 'invalid_runtime_time');
      state.audio_context_state = observation.audio_context_state ?? null;
      state.source_started = observation.source_started === true;
      state.destination_connected = observation.destination_connected === true;
      return this;
    },
    recordHumanOutcome(audible, at = now()) {
      if (!state.runtime_observed_at) throw new Error('runtime_required');
      assertUnset(state.human_observed_at, 'human_outcome_already_recorded');
      if (typeof audible !== 'boolean') throw new Error('audibility_must_be_boolean');
      state.human_observed_at = requireTime(at, 'invalid_human_time');
      state.human_reported_audible = audible;
      state.classification = audible ? 'human_confirmed' : 'contradicted';
      return this;
    },
    finalize(identity = {}, options = {}) {
      if (!ALLOWED_CLASSIFICATIONS.has(state.classification)) throw new Error('terminal_outcome_required');
      const candidate = {
        commit_sha: identity.commit_sha,
        deployment_id: identity.deployment_id,
        session_id: state.session_id,
        device_class: identity.device_class,
        classification: state.classification,
        human_reported_audible: state.human_reported_audible,
        user_activation_at: state.user_activation_at,
        runtime_observed_at: state.runtime_observed_at,
        human_observed_at: state.human_observed_at,
        audio_context_state: state.audio_context_state,
        source_started: state.source_started,
        destination_connected: state.destination_connected
      };
      return validateAudioAttestationBinding(candidate, { now: options.now ?? now() });
    }
  });
}

function toBase64Url(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < SESSION_ID_BYTES) {
    throw new Error('insufficient_session_entropy');
  }
  return Buffer.from(bytes).toString('base64url');
}

function requireTime(value, reason) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(reason);
  return new Date(ms).toISOString();
}

function assertUnset(value, reason) {
  if (value !== null) throw new Error(reason);
}
