const ADVANCE_EPSILON = 0.0005;
const SAMPLE_DELAY_MS = 420;

export function classifyAudioObservation(before, after) {
  if (!after?.supported) return 'unsupported';
  if (after.state === 'closed') return 'closed';
  if (after.state !== 'running') return 'activation-blocked-or-suspended';

  const outputAdvanced = Number.isFinite(before?.outputPosition)
    && Number.isFinite(after.outputPosition)
    && after.outputPosition - before.outputPosition > ADVANCE_EPSILON;
  if (outputAdvanced) return 'render-confirmed';

  const clockAdvanced = Number.isFinite(before?.currentTime)
    && Number.isFinite(after.currentTime)
    && after.currentTime - before.currentTime > ADVANCE_EPSILON;
  if (clockAdvanced) return 'clock-progress-only';

  return 'running-without-observed-progress';
}

function sample(context) {
  if (!context) return { supported: false };
  let outputPosition = null;
  try {
    const timestamp = context.getOutputTimestamp?.();
    outputPosition = Number.isFinite(timestamp?.contextTime) ? timestamp.contextTime : null;
  } catch {
    outputPosition = null;
  }
  return {
    supported: true,
    state: context.state,
    currentTime: Number.isFinite(context.currentTime) ? context.currentTime : null,
    outputPosition,
    outputLatency: Number.isFinite(context.outputLatency) ? context.outputLatency : null,
    baseLatency: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
  };
}

function ensureMeter() {
  let meter = document.querySelector('[data-audio-observability]');
  if (meter) return meter;
  meter = document.createElement('output');
  meter.dataset.audioObservability = 'idle';
  meter.setAttribute('aria-live', 'polite');
  meter.setAttribute('aria-label', 'audio status');
  meter.title = 'Audio has not been measured yet';
  Object.assign(meter.style, {
    position: 'fixed',
    right: 'max(14px, env(safe-area-inset-right))',
    top: 'max(14px, env(safe-area-inset-top))',
    width: '12px',
    height: '12px',
    borderRadius: '999px',
    zIndex: '20',
    pointerEvents: 'none',
    background: 'rgba(255,255,255,.2)',
    boxShadow: '0 0 0 1px rgba(255,255,255,.25)',
    transition: 'transform .2s ease, background .2s ease, box-shadow .2s ease',
    color: 'transparent',
    overflow: 'hidden',
  });
  document.body.appendChild(meter);
  return meter;
}

function present(result, after) {
  const meter = ensureMeter();
  const confirmed = result === 'render-confirmed';
  const progressing = result === 'clock-progress-only';
  meter.dataset.audioObservability = result;
  meter.dataset.audioState = after?.state || 'unknown';
  meter.dataset.outputPosition = Number.isFinite(after?.outputPosition) ? String(after.outputPosition) : '';
  meter.dataset.currentTime = Number.isFinite(after?.currentTime) ? String(after.currentTime) : '';
  meter.dataset.outputLatency = Number.isFinite(after?.outputLatency) ? String(after.outputLatency) : '';
  meter.dataset.baseLatency = Number.isFinite(after?.baseLatency) ? String(after.baseLatency) : '';
  meter.value = result;
  meter.title = confirmed
    ? 'Browser audio render position is advancing'
    : progressing
      ? 'Audio clock is advancing; rendered output is not yet confirmed'
      : `Audio status: ${result}`;
  meter.style.background = confirmed
    ? 'rgba(167,243,208,.94)'
    : progressing
      ? 'rgba(255,226,191,.9)'
      : 'rgba(255,145,145,.86)';
  meter.style.boxShadow = confirmed
    ? '0 0 22px rgba(167,243,208,.95), 0 0 0 1px rgba(255,255,255,.6)'
    : progressing
      ? '0 0 18px rgba(255,190,116,.8), 0 0 0 1px rgba(255,255,255,.5)'
      : '0 0 16px rgba(255,90,90,.72), 0 0 0 1px rgba(255,255,255,.4)';
  meter.style.transform = confirmed ? 'scale(1.25)' : 'scale(1)';
  window.__MC_AUDIO_EVIDENCE__ = { result, sampledAt: new Date().toISOString(), ...after };
}

export function installAudioObservabilityRuntime() {
  if (typeof window === 'undefined' || window.__MC_AUDIO_OBSERVABILITY_INSTALLED__) return;
  window.__MC_AUDIO_OBSERVABILITY_INSTALLED__ = true;

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeAudioContext) {
    window.addEventListener('DOMContentLoaded', () => present('unsupported', { supported: false }), { once: true });
    return;
  }

  const contexts = [];
  function TrackedAudioContext(...args) {
    const context = new NativeAudioContext(...args);
    contexts.push(context);
    return context;
  }
  TrackedAudioContext.prototype = NativeAudioContext.prototype;
  Object.setPrototypeOf(TrackedAudioContext, NativeAudioContext);
  window.AudioContext = TrackedAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = TrackedAudioContext;

  const observe = () => {
    const context = contexts.at(-1);
    if (!context) {
      window.setTimeout(() => {
        const lateContext = contexts.at(-1);
        if (!lateContext) return present('activation-blocked-or-suspended', { supported: true, state: 'not-created' });
        const before = sample(lateContext);
        window.setTimeout(() => {
          const after = sample(lateContext);
          present(classifyAudioObservation(before, after), after);
        }, SAMPLE_DELAY_MS);
      }, 0);
      return;
    }
    const before = sample(context);
    window.setTimeout(() => {
      const after = sample(context);
      present(classifyAudioObservation(before, after), after);
    }, SAMPLE_DELAY_MS);
  };

  window.addEventListener('pointerdown', observe, { capture: false, passive: true });
  window.addEventListener('touchend', observe, { capture: false, passive: true });
  window.addEventListener('DOMContentLoaded', ensureMeter, { once: true });
}
