const ADVANCE_EPSILON = 0.0005;
const SAMPLE_DELAY_MS = 420;
const DIAGNOSTIC_FREQUENCY_HZ = 523.25;
const DIAGNOSTIC_DURATION_SECONDS = 0.22;
const DIAGNOSTIC_GAIN = 0.08;

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

export async function playDiagnosticPulse(AudioContextCtor) {
  if (!AudioContextCtor) return { played: false, reason: 'unsupported' };
  const context = new AudioContextCtor();
  try {
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') {
      return { played: false, reason: 'activation-blocked-or-suspended', state: context.state };
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(DIAGNOSTIC_FREQUENCY_HZ, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(DIAGNOSTIC_GAIN, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + DIAGNOSTIC_DURATION_SECONDS);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + DIAGNOSTIC_DURATION_SECONDS);

    return {
      played: true,
      frequencyHz: DIAGNOSTIC_FREQUENCY_HZ,
      durationSeconds: DIAGNOSTIC_DURATION_SECONDS,
      gain: DIAGNOSTIC_GAIN,
      state: context.state,
      context,
    };
  } catch (error) {
    return { played: false, reason: 'pulse-error', message: error instanceof Error ? error.message : String(error), context };
  }
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

function ensureDiagnosticButton(AudioContextCtor, observeContext) {
  let button = document.querySelector('[data-audio-diagnostic]');
  if (button) return button;
  button = document.createElement('button');
  button.type = 'button';
  button.dataset.audioDiagnostic = 'ready';
  button.textContent = 'Test sound';
  button.setAttribute('aria-describedby', 'mc-audio-diagnostic-help');
  Object.assign(button.style, {
    position: 'fixed',
    right: 'max(18px, env(safe-area-inset-right))',
    bottom: 'max(18px, env(safe-area-inset-bottom))',
    zIndex: '21',
    minWidth: '44px',
    minHeight: '44px',
    border: '1px solid rgba(255,255,255,.38)',
    borderRadius: '999px',
    padding: '10px 14px',
    background: 'rgba(8,12,24,.78)',
    color: 'white',
    font: '600 13px/1 system-ui, sans-serif',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  });

  const help = document.createElement('span');
  help.id = 'mc-audio-diagnostic-help';
  help.textContent = 'Plays a short C5 tone and measures browser audio progress.';
  Object.assign(help.style, {
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

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.dataset.audioDiagnostic = 'playing';
    const result = await playDiagnosticPulse(AudioContextCtor);
    const context = result.context;
    window.__MC_AUDIO_PULSE__ = {
      played: result.played,
      reason: result.reason || null,
      frequencyHz: result.frequencyHz || null,
      durationSeconds: result.durationSeconds || null,
      state: result.state || context?.state || 'unknown',
      startedAt: new Date().toISOString(),
    };
    button.dataset.audioDiagnostic = result.played ? 'played' : result.reason || 'failed';
    button.textContent = result.played ? 'Sound sent' : 'Sound blocked';
    if (context) observeContext(context);
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Test sound';
      button.dataset.audioDiagnostic = 'ready';
    }, 1200);
  });

  document.body.append(help, button);
  return button;
}

export function installAudioObservabilityRuntime() {
  if (typeof window === 'undefined' || window.__MC_AUDIO_OBSERVABILITY_INSTALLED__) return;
  window.__MC_AUDIO_OBSERVABILITY_INSTALLED__ = true;

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeAudioContext) {
    window.addEventListener('DOMContentLoaded', () => {
      present('unsupported', { supported: false });
      ensureDiagnosticButton(null, () => {});
    }, { once: true });
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

  const observeContext = (context) => {
    const before = sample(context);
    window.setTimeout(() => {
      const after = sample(context);
      present(classifyAudioObservation(before, after), after);
    }, SAMPLE_DELAY_MS);
  };

  const observe = () => {
    const context = contexts.at(-1);
    if (!context) {
      window.setTimeout(() => {
        const lateContext = contexts.at(-1);
        if (!lateContext) return present('activation-blocked-or-suspended', { supported: true, state: 'not-created' });
        observeContext(lateContext);
      }, 0);
      return;
    }
    observeContext(context);
  };

  window.addEventListener('pointerdown', observe, { capture: false, passive: true });
  window.addEventListener('touchend', observe, { capture: false, passive: true });
  window.addEventListener('DOMContentLoaded', () => {
    ensureMeter();
    ensureDiagnosticButton(TrackedAudioContext, observeContext);
  }, { once: true });
}
