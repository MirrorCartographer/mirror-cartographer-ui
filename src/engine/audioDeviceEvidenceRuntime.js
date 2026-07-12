const VIEWPORT_BUCKETS = [360, 390, 430, 768, 1024];

function bucketViewport(width) {
  if (!Number.isFinite(width) || width <= 0) return 'unknown';
  const upper = VIEWPORT_BUCKETS.find((limit) => width <= limit);
  return upper ? `lte-${upper}` : 'gt-1024';
}

function queryMatch(matchMediaImpl, query) {
  try {
    return Boolean(matchMediaImpl?.(query)?.matches);
  } catch {
    return false;
  }
}

export function buildAudioDeviceEvidence({
  innerWidth,
  innerHeight,
  devicePixelRatio,
  maxTouchPoints,
  standalone,
  matchMediaImpl,
  capturedAt = new Date().toISOString(),
} = {}) {
  const width = Number(innerWidth);
  const height = Number(innerHeight);
  const orientation = Number.isFinite(width) && Number.isFinite(height)
    ? width >= height ? 'landscape' : 'portrait'
    : 'unknown';

  return Object.freeze({
    schemaVersion: '1.0.0',
    capturedAt,
    viewport: {
      widthBucket: bucketViewport(width),
      orientation,
      pixelRatioBucket: Number.isFinite(Number(devicePixelRatio))
        ? Number(devicePixelRatio) >= 3 ? 'gte-3' : Number(devicePixelRatio) >= 2 ? 'gte-2' : 'lt-2'
        : 'unknown',
    },
    input: {
      touchCapable: Number(maxTouchPoints) > 0,
      coarsePointer: queryMatch(matchMediaImpl, '(pointer: coarse)'),
      hoverAvailable: queryMatch(matchMediaImpl, '(hover: hover)'),
    },
    display: {
      standalone: Boolean(standalone) || queryMatch(matchMediaImpl, '(display-mode: standalone)'),
      reducedMotion: queryMatch(matchMediaImpl, '(prefers-reduced-motion: reduce)'),
    },
    privacy: {
      rawUserAgentCollected: false,
      exactViewportCollected: false,
      persistentIdentifierCollected: false,
    },
    limits: [
      'Touch capability and viewport buckets do not prove the device is an iPhone.',
      'This context describes the browser session and does not prove speaker output or audibility.',
    ],
  });
}

export function installAudioDeviceEvidenceRuntime(target = globalThis) {
  if (!target?.window || !target?.navigator) return null;
  const evidence = buildAudioDeviceEvidence({
    innerWidth: target.window.innerWidth,
    innerHeight: target.window.innerHeight,
    devicePixelRatio: target.window.devicePixelRatio,
    maxTouchPoints: target.navigator.maxTouchPoints,
    standalone: target.navigator.standalone,
    matchMediaImpl: target.window.matchMedia?.bind(target.window),
  });
  target.window.__MC_AUDIO_DEVICE_EVIDENCE__ = evidence;
  document.documentElement.dataset.audioDeviceViewport = evidence.viewport.widthBucket;
  document.documentElement.dataset.audioDeviceTouch = String(evidence.input.touchCapable);
  return evidence;
}
