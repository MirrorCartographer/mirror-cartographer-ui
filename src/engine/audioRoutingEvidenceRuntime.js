export function classifyAudioRouting({ context, permissionsPolicy, sinkChangeObserved = false } = {}) {
  if (!context || !('sinkId' in context) || typeof context.setSinkId !== 'function') {
    return { status: 'unsupported', browserConfirmed: false, physicalOutputProven: false };
  }

  try {
    const policy = permissionsPolicy || document?.permissionsPolicy || document?.featurePolicy;
    if (policy?.allowsFeature && !policy.allowsFeature('speaker-selection')) {
      return { status: 'policy-blocked', browserConfirmed: false, physicalOutputProven: false };
    }
  } catch {
    // Policy inspection is optional and must not break diagnostics.
  }

  const sinkId = typeof context.sinkId === 'string' ? context.sinkId : '';
  if (!sinkId || sinkId === 'default') {
    return { status: 'default-or-undisclosed', browserConfirmed: false, physicalOutputProven: false, sinkId: sinkId || null };
  }

  if (!sinkChangeObserved) {
    return { status: 'selected-unverified', browserConfirmed: false, physicalOutputProven: false, sinkId };
  }

  return { status: 'selected-confirmed', browserConfirmed: true, physicalOutputProven: false, sinkId };
}

function publish(context, sinkChangeObserved = false) {
  const result = classifyAudioRouting({ context, sinkChangeObserved });
  window.__MC_AUDIO_ROUTING__ = {
    ...result,
    sampledAt: new Date().toISOString(),
    evidenceLimit: 'Browser routing state does not prove speaker emission or listener perception.',
  };
  document.documentElement.dataset.audioRouting = result.status;
  return result;
}

export function installAudioRoutingEvidenceRuntime() {
  if (typeof window === 'undefined' || window.__MC_AUDIO_ROUTING_INSTALLED__) return;
  window.__MC_AUDIO_ROUTING_INSTALLED__ = true;

  const inspectLatestContext = () => {
    const pulseContext = window.__MC_AUDIO_PULSE_CONTEXT__;
    if (pulseContext) publish(pulseContext, false);
  };

  window.addEventListener('mc:audio-context', (event) => {
    const context = event.detail?.context;
    if (!context) return;
    publish(context, false);
    context.addEventListener?.('sinkchange', () => publish(context, true));
  });

  window.addEventListener('pointerdown', inspectLatestContext, { passive: true });
  window.addEventListener('touchend', inspectLatestContext, { passive: true });

  window.addEventListener('DOMContentLoaded', () => {
    window.__MC_AUDIO_ROUTING__ = {
      status: 'awaiting-context',
      browserConfirmed: false,
      physicalOutputProven: false,
      sampledAt: new Date().toISOString(),
      evidenceLimit: 'Browser routing state does not prove speaker emission or listener perception.',
    };
    document.documentElement.dataset.audioRouting = 'awaiting-context';
  }, { once: true });
}
