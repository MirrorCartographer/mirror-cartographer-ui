const SAFE_KEYS = [
  'schemaVersion',
  'attemptId',
  'attemptMatched',
  'outcome',
  'diagnosis',
  'recordedAt',
  'pulse',
  'render',
];

function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

export function buildAudioRuntimeEvidencePacket(target = globalThis) {
  const source = target.__MC_AUDIBILITY_EVIDENCE__;
  if (!source || typeof source !== 'object') return null;

  const evidence = {};
  for (const key of SAFE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) evidence[key] = cloneJson(source[key]);
  }

  return {
    schemaVersion: '1.0.0',
    kind: 'mirror-cartographer-audio-runtime-evidence',
    capturedAt: new Date().toISOString(),
    deployment: cloneJson(target.__MC_DEPLOYMENT_IDENTITY__ ?? null),
    evidence,
    limits: [
      'Human audibility is self-reported.',
      'Browser render evidence does not prove speaker output.',
      'Deployment identity must be verified independently.',
    ],
  };
}

async function copyPacket(packet) {
  const text = JSON.stringify(packet, null, 2);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand?.('copy');
  textarea.remove();
  if (!copied) throw new Error('clipboard unavailable');
  return 'copied';
}

function ensureExportButton() {
  let button = document.querySelector('[data-audio-evidence-export]');
  if (button) return button;

  button = document.createElement('button');
  button.type = 'button';
  button.dataset.audioEvidenceExport = 'unavailable';
  button.textContent = 'Copy sound proof';
  button.disabled = true;
  button.setAttribute('aria-label', 'Copy sound test evidence as JSON');
  Object.assign(button.style, {
    position: 'fixed',
    left: 'max(18px, env(safe-area-inset-left))',
    bottom: 'max(18px, env(safe-area-inset-bottom))',
    zIndex: '21',
    minHeight: '44px',
    border: '1px solid rgba(255,255,255,.38)',
    borderRadius: '999px',
    padding: '10px 14px',
    background: 'rgba(8,12,24,.78)',
    color: 'white',
    font: '600 13px/1 system-ui, sans-serif',
    opacity: '.55',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  });

  button.addEventListener('click', async () => {
    const packet = buildAudioRuntimeEvidencePacket(window);
    if (!packet) return;
    button.disabled = true;
    try {
      await copyPacket(packet);
      window.__MC_AUDIO_EXPORT_PACKET__ = packet;
      button.dataset.audioEvidenceExport = 'copied';
      button.textContent = 'Proof copied';
    } catch (error) {
      button.dataset.audioEvidenceExport = 'failed';
      button.textContent = 'Copy failed';
      button.title = error instanceof Error ? error.message : String(error);
    }
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Copy sound proof';
      button.dataset.audioEvidenceExport = 'ready';
    }, 1400);
  });

  document.body.appendChild(button);
  return button;
}

export function installAudioEvidenceExportRuntime() {
  if (typeof window === 'undefined' || window.__MC_AUDIO_EVIDENCE_EXPORT_INSTALLED__) return;
  window.__MC_AUDIO_EVIDENCE_EXPORT_INSTALLED__ = true;

  const install = () => {
    const button = ensureExportButton();
    const refresh = () => {
      const packet = buildAudioRuntimeEvidencePacket(window);
      button.disabled = !packet;
      button.style.opacity = packet ? '1' : '.55';
      button.dataset.audioEvidenceExport = packet ? 'ready' : 'unavailable';
    };

    document.addEventListener('click', () => window.setTimeout(refresh, 0), true);
    window.setInterval(refresh, 500);
    refresh();
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
}
