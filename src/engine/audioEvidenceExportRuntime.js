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

const ROUTING_SAFE_KEYS = [
  'status',
  'browserConfirmed',
  'physicalOutputProven',
  'sinkId',
  'sampledAt',
  'evidenceLimit',
];

function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function selectSafeKeys(source, keys) {
  if (!source || typeof source !== 'object') return null;
  const selected = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) selected[key] = cloneJson(source[key]);
  }
  return selected;
}

export function buildAudioRuntimeEvidencePacket(target = globalThis) {
  const source = target.__MC_AUDIBILITY_EVIDENCE__;
  if (!source || typeof source !== 'object') return null;

  const evidence = selectSafeKeys(source, SAFE_KEYS);
  const routing = selectSafeKeys(target.__MC_AUDIO_ROUTING__, ROUTING_SAFE_KEYS);

  return {
    schemaVersion: '1.1.0',
    kind: 'mirror-cartographer-audio-runtime-evidence',
    capturedAt: new Date().toISOString(),
    deployment: cloneJson(target.__MC_DEPLOYMENT_IDENTITY__ ?? null),
    evidence,
    routing,
    limits: [
      'Human audibility is self-reported.',
      'Browser render evidence does not prove speaker output.',
      'Browser routing state does not prove speaker emission or listener perception.',
      'Deployment identity must be verified independently.',
    ],
  };
}

export function buildAudioEvidenceFilename(packet) {
  const attempt = String(packet?.evidence?.attemptId || 'attempt')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'attempt';
  const stamp = String(packet?.capturedAt || new Date().toISOString())
    .replace(/[:.]/g, '-')
    .replace(/[^a-z0-9TZ_-]+/gi, '');
  return `mirror-cartographer-audio-proof-${attempt}-${stamp}.json`;
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

function downloadPacket(packet) {
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildAudioEvidenceFilename(packet);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'downloaded';
}

function ensureStatusRegion() {
  let status = document.querySelector('[data-audio-evidence-status]');
  if (status) return status;
  status = document.createElement('div');
  status.dataset.audioEvidenceStatus = 'idle';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.position = 'fixed';
  status.style.width = '1px';
  status.style.height = '1px';
  status.style.overflow = 'hidden';
  status.style.clipPath = 'inset(50%)';
  document.body.appendChild(status);
  return status;
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
    const status = ensureStatusRegion();
    button.disabled = true;
    try {
      await copyPacket(packet);
      window.__MC_AUDIO_EXPORT_PACKET__ = packet;
      button.dataset.audioEvidenceExport = 'copied';
      button.textContent = 'Proof copied';
      status.dataset.audioEvidenceStatus = 'copied';
      status.textContent = 'Sound proof copied to clipboard.';
    } catch (error) {
      try {
        downloadPacket(packet);
        window.__MC_AUDIO_EXPORT_PACKET__ = packet;
        button.dataset.audioEvidenceExport = 'downloaded';
        button.textContent = 'Proof downloaded';
        status.dataset.audioEvidenceStatus = 'downloaded';
        status.textContent = 'Clipboard unavailable. Sound proof downloaded as JSON.';
      } catch (downloadError) {
        button.dataset.audioEvidenceExport = 'failed';
        button.textContent = 'Export failed';
        button.title = downloadError instanceof Error ? downloadError.message : String(downloadError);
        status.dataset.audioEvidenceStatus = 'failed';
        status.textContent = 'Sound proof export failed.';
      }
    }
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Copy sound proof';
      button.dataset.audioEvidenceExport = 'ready';
    }, 1400);
  });

  document.body.appendChild(button);
  ensureStatusRegion();
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
