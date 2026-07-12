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

function observeContext(context) {
  if (!context) return;
  window.__MC_AUDIO_PULSE_CONTEXT__ = context;
  publish(context, false);
  context.addEventListener?.('sinkchange', () => publish(context, true));
}

export function installAudioRoutingEvidenceRuntime() {
  if (typeof window === 'undefined' || window.__MC_AUDIO_ROUTING_INSTALLED__) return;
  window.__MC_AUDIO_ROUTING_INSTALLED__ = true;

  const CurrentAudioContext = window.AudioContext || window.webkitAudioContext;
  if (CurrentAudioContext) {
    function RoutingAwareAudioContext(...args) {
      const context = new CurrentAudioContext(...args);
      observeContext(context);
      return context;
    }
    RoutingAwareAudioContext.prototype = CurrentAudioContext.prototype;
    Object.setPrototypeOf(RoutingAwareAudioContext, CurrentAudioContext);
    window.AudioContext = RoutingAwareAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = RoutingAwareAudioContext;
  }

  window.addEventListener('mc:audio-context', (event) => observeContext(event.detail?.context));

  window.addEventListener('DOMContentLoaded', () => {
    window.__MC_AUDIO_ROUTING__ = window.__MC_AUDIO_ROUTING__ || {
      status: CurrentAudioContext ? 'awaiting-context' : 'unsupported',
      browserConfirmed: false,
      physicalOutputProven: false,
      sampledAt: new Date().toISOString(),
      evidenceLimit: 'Browser routing state does not prove speaker emission or listener perception.',
    };
    document.documentElement.dataset.audioRouting = window.__MC_AUDIO_ROUTING__.status;
  }, { once: true });
}
