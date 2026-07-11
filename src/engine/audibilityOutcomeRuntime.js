const VALID_OUTCOMES = new Set(['heard', 'not-heard']);

export function buildAudibilityEvidence(outcome, pulse, renderEvidence, recordedAt = new Date().toISOString()) {
  if (!VALID_OUTCOMES.has(outcome)) throw new TypeError(`Invalid audibility outcome: ${outcome}`);
  return {
    schemaVersion: '1.0.0',
    outcome,
    recordedAt,
    pulse: {
      played: Boolean(pulse?.played),
      reason: pulse?.reason ?? null,
      frequencyHz: Number.isFinite(pulse?.frequencyHz) ? pulse.frequencyHz : null,
      durationSeconds: Number.isFinite(pulse?.durationSeconds) ? pulse.durationSeconds : null,
      state: pulse?.state ?? 'unknown',
      startedAt: pulse?.startedAt ?? null,
    },
    render: {
      result: renderEvidence?.result ?? 'unobserved',
      state: renderEvidence?.state ?? 'unknown',
      outputPosition: Number.isFinite(renderEvidence?.outputPosition) ? renderEvidence.outputPosition : null,
      currentTime: Number.isFinite(renderEvidence?.currentTime) ? renderEvidence.currentTime : null,
      sampledAt: renderEvidence?.sampledAt ?? null,
    },
  };
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
      const evidence = buildAudibilityEvidence(
        outcome,
        window.__MC_AUDIO_PULSE__,
        window.__MC_AUDIO_EVIDENCE__,
      );
      window.__MC_AUDIBILITY_EVIDENCE__ = evidence;
      panel.dataset.audibilityPanel = 'recorded';
      panel.dataset.audibilityOutcome = outcome;
      status.value = outcome === 'heard'
        ? 'Audible sound confirmed and paired with browser evidence.'
        : 'Sound was not heard; browser evidence was preserved for diagnosis.';
      question.textContent = outcome === 'heard' ? 'Heard' : 'Not heard';
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
      panel.dataset.audibilityPanel = 'awaiting-pulse';
      panel.style.display = 'none';
      window.setTimeout(() => {
        if (!window.__MC_AUDIO_PULSE__?.played) return;
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
