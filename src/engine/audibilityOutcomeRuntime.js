const VALID_OUTCOMES = new Set(['heard', 'not-heard']);

function normalizeRoutingEvidence(routingEvidence) {
  if (!routingEvidence || typeof routingEvidence !== 'object') {
    return {
      status: 'unobserved',
      browserConfirmed: false,
      physicalOutputProven: false,
      sinkId: null,
      sampledAt: null,
      evidenceLimit: 'No browser routing evidence was captured for this attempt.',
    };
  }
  return {
    status: typeof routingEvidence.status === 'string' ? routingEvidence.status : 'unknown',
    browserConfirmed: Boolean(routingEvidence.browserConfirmed),
    physicalOutputProven: Boolean(routingEvidence.physicalOutputProven),
    sinkId: typeof routingEvidence.sinkId === 'string' ? routingEvidence.sinkId : null,
    sampledAt: routingEvidence.sampledAt ?? null,
    evidenceLimit: routingEvidence.evidenceLimit ?? 'Browser routing state does not prove physical speaker emission.',
  };
}

export function classifyAudibilityDiagnostic(outcome, pulse, renderEvidence, routingEvidence = null) {
  if (!VALID_OUTCOMES.has(outcome)) throw new TypeError(`Invalid audibility outcome: ${outcome}`);
  if (!pulse?.played) return 'pulse-not-scheduled';
  if (outcome === 'heard') return 'audible-confirmed';
  if (renderEvidence?.result === 'render-confirmed') {
    const route = normalizeRoutingEvidence(routingEvidence);
    if (route.status === 'selected-output-confirmed') return 'render-confirmed-selected-route-not-heard';
    if (route.status === 'default-output-confirmed') return 'render-confirmed-default-route-not-heard';
    if (route.status === 'unsupported') return 'render-confirmed-routing-unavailable-not-heard';
    if (route.status === 'policy-blocked') return 'render-confirmed-routing-policy-blocked-not-heard';
    return 'render-confirmed-route-unresolved-not-heard';
  }
  if (renderEvidence?.result === 'clock-progress-only') return 'clock-advanced-not-heard';
  return 'not-heard-render-unconfirmed';
}

function normalizedAttemptId(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function createAttemptId(startedAt) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `mc-audio-${startedAt}-${randomPart}`;
}

export function buildAudibilityEvidence(
  outcome,
  pulse,
  renderEvidence,
  recordedAt = new Date().toISOString(),
  routingEvidence = null,
) {
  if (!VALID_OUTCOMES.has(outcome)) throw new TypeError(`Invalid audibility outcome: ${outcome}`);
  const pulseAttemptId = normalizedAttemptId(pulse?.attemptId);
  const renderAttemptId = normalizedAttemptId(renderEvidence?.attemptId);
  const attemptId = pulseAttemptId ?? renderAttemptId;
  const attemptMatched = Boolean(
    attemptId
      && pulseAttemptId === attemptId
      && (!pulse?.played || renderAttemptId === attemptId),
  );
  const routing = normalizeRoutingEvidence(routingEvidence);
  return {
    schemaVersion: '1.3.0',
    attemptId,
    attemptMatched,
    outcome,
    diagnosis: attemptMatched
      ? classifyAudibilityDiagnostic(outcome, pulse, renderEvidence, routing)
      : 'attempt-evidence-mismatch',
    recordedAt,
    pulse: {
      attemptId: pulseAttemptId,
      played: Boolean(pulse?.played),
      reason: pulse?.reason ?? null,
      frequencyHz: Number.isFinite(pulse?.frequencyHz) ? pulse.frequencyHz : null,
      durationSeconds: Number.isFinite(pulse?.durationSeconds) ? pulse.durationSeconds : null,
      state: pulse?.state ?? 'unknown',
      startedAt: pulse?.startedAt ?? null,
    },
    render: {
      attemptId: renderAttemptId,
      result: renderEvidence?.result ?? 'unobserved',
      state: renderEvidence?.state ?? 'unknown',
      outputPosition: Number.isFinite(renderEvidence?.outputPosition) ? renderEvidence.outputPosition : null,
      currentTime: Number.isFinite(renderEvidence?.currentTime) ? renderEvidence.currentTime : null,
      sampledAt: renderEvidence?.sampledAt ?? null,
    },
    routing,
  };
}

export function buildPulseFailureEvidence(
  pulse,
  renderEvidence,
  recordedAt = new Date().toISOString(),
  routingEvidence = null,
) {
  if (pulse?.played) throw new TypeError('Pulse failure evidence requires an unscheduled pulse');
  return buildAudibilityEvidence('not-heard', pulse, renderEvidence, recordedAt, routingEvidence);
}

export function resetAudibilityAttempt(target, startedAt = new Date().toISOString(), attemptId = createAttemptId(startedAt)) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
    throw new TypeError('Audibility attempt target must be an object');
  }
  if (!normalizedAttemptId(attemptId)) throw new TypeError('Audibility attempt id must be a non-empty string');
  const pendingPulse = {
    attemptId,
    played: false,
    reason: 'pending',
    frequencyHz: null,
    durationSeconds: null,
    state: 'pending',
    startedAt,
  };
  target.__MC_AUDIO_ATTEMPT_ID__ = attemptId;
  target.__MC_AUDIO_PULSE__ = pendingPulse;
  target.__MC_AUDIO_EVIDENCE__ = null;
  target.__MC_AUDIBILITY_EVIDENCE__ = null;
  return pendingPulse;
}

function correlateAttemptEvidence(target, attemptId) {
  if (target.__MC_AUDIO_ATTEMPT_ID__ !== attemptId) return false;
  if (target.__MC_AUDIO_PULSE__ && !target.__MC_AUDIO_PULSE__.attemptId) {
    target.__MC_AUDIO_PULSE__.attemptId = attemptId;
  }
  if (target.__MC_AUDIO_EVIDENCE__ && !target.__MC_AUDIO_EVIDENCE__.attemptId) {
    target.__MC_AUDIO_EVIDENCE__.attemptId = attemptId;
  }
  return true;
}

function visuallyHidden(node) {
  Object.assign(node.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
}

function ensurePanel() {
  let panel = document.querySelector('[data-audibility-panel]');
  if (panel) return panel;

  panel = document.createElement('section');
  panel.dataset.audibilityPanel = 'hidden';
  panel.setAttribute('aria-label', 'Sound confirmation');
  Object.assign(panel.style, {
    position: 'fixed',
    right: 'max(18px, env(safe-area-inset-right))',
    bottom: 'max(72px, calc(env(safe-area-inset-bottom) + 72px))',
    zIndex: '22',
    display: 'none',
    gap: '8px',
    alignItems: 'center',
    padding: '10px',
    border: '1px solid rgba(255,255,255,.32)',
    borderRadius: '16px',
    background: 'rgba(8,12,24,.9)',
    color: 'white',
    font: '600 13px/1.2 system-ui, sans-serif',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  });

  const question = document.createElement('span');
  question.textContent = 'Did you hear it?';

  const status = document.createElement('output');
  status.id = 'mc-audibility-status';
  status.setAttribute('aria-live', 'polite');
  visuallyHidden(status);

  for (const [label, outcome] of [['Yes', 'heard'], ['No', 'not-heard']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.audibilityOutcome = outcome;
    button.setAttribute('aria-describedby', status.id);
    Object.assign(button.style, {
      minWidth: '44px',
      minHeight: '44px',
      border: '1px solid rgba(255,255,255,.38)',
      borderRadius: '999px',
      padding: '10px 12px',
      background: 'rgba(255,255,255,.1)',
      color: 'white',
      font: 'inherit',
    });
    button.addEventListener('click', () => {
      correlateAttemptEvidence(window, window.__MC_AUDIO_ATTEMPT_ID__);
      const evidence = buildAudibilityEvidence(
        outcome,
        window.__MC_AUDIO_PULSE__,
        window.__MC_AUDIO_EVIDENCE__,
        new Date().toISOString(),
        window.__MC_AUDIO_ROUTING__,
      );
      window.__MC_AUDIBILITY_EVIDENCE__ = evidence;
      panel.dataset.audibilityPanel = 'recorded';
      panel.dataset.audibilityOutcome = outcome;
      panel.dataset.audibilityDiagnosis = evidence.diagnosis;
      panel.dataset.audioRoutingStatus = evidence.routing.status;
      panel.dataset.audioAttemptId = evidence.attemptId ?? 'missing';
      panel.dataset.audioAttemptMatched = String(evidence.attemptMatched);
      status.value = evidence.attemptMatched
        ? outcome === 'heard'
          ? 'Audible sound confirmed and paired with browser evidence.'
          : `Sound was not heard. Diagnostic classification: ${evidence.diagnosis}. Routing state: ${evidence.routing.status}.`
        : 'The sound response could not be paired with render evidence from the same test attempt. Retry the sound test.';
      question.textContent = evidence.attemptMatched
        ? outcome === 'heard' ? 'Heard' : 'Not heard'
        : 'Retry required';
      panel.querySelectorAll('button').forEach((candidate) => { candidate.disabled = true; });
    });
    panel.appendChild(button);
  }

  panel.prepend(question);
  panel.appendChild(status);
  document.body.appendChild(panel);
  return panel;
}

export function installAudibilityOutcomeRuntime() {
  if (typeof window === 'undefined' || window.__MC_AUDIBILITY_OUTCOME_INSTALLED__) return;
  window.__MC_AUDIBILITY_OUTCOME_INSTALLED__ = true;

  const install = () => {
    const panel = ensurePanel();
    document.addEventListener('click', (event) => {
      const diagnostic = event.target?.closest?.('[data-audio-diagnostic]');
      if (!diagnostic) return;
      const pendingPulse = resetAudibilityAttempt(window);
      const attemptId = pendingPulse.attemptId;
      panel.dataset.audioAttemptId = attemptId;
      panel.dataset.audioAttemptMatched = 'false';
      panel.dataset.audibilityPanel = 'awaiting-pulse';
      delete panel.dataset.audibilityOutcome;
      delete panel.dataset.audibilityDiagnosis;
      delete panel.dataset.audioRoutingStatus;
      panel.style.display = 'none';
      panel.querySelectorAll('button').forEach((candidate) => { candidate.disabled = false; });
      panel.querySelector('span').textContent = 'Did you hear it?';
      window.setTimeout(() => {
        if (!correlateAttemptEvidence(window, attemptId)) return;
        if (!window.__MC_AUDIO_PULSE__?.played) {
          const evidence = buildPulseFailureEvidence(
            window.__MC_AUDIO_PULSE__,
            window.__MC_AUDIO_EVIDENCE__,
            new Date().toISOString(),
            window.__MC_AUDIO_ROUTING__,
          );
          window.__MC_AUDIBILITY_EVIDENCE__ = evidence;
          panel.dataset.audibilityPanel = 'pulse-failed';
          panel.dataset.audibilityOutcome = evidence.outcome;
          panel.dataset.audibilityDiagnosis = evidence.diagnosis;
          panel.dataset.audioRoutingStatus = evidence.routing.status;
          panel.dataset.audioAttemptMatched = String(evidence.attemptMatched);
          panel.querySelector('span').textContent = 'Sound test did not start';
          panel.querySelector('output').value = `The browser did not schedule the sound pulse. Diagnostic classification: ${evidence.diagnosis}. Activate the sound test again to retry.`;
          panel.querySelectorAll('button').forEach((candidate) => { candidate.disabled = true; });
          panel.style.display = 'flex';
          return;
        }
        panel.dataset.audibilityPanel = 'awaiting-response';
        panel.style.display = 'flex';
        panel.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      }, 520);
    }, { capture: true });
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
}
