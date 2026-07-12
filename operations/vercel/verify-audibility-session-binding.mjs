export function verifyAudibilitySessionBinding(packet = {}) {
  const failures = [];
  const deviceSession = packet.device?.sessionId;

  if (typeof deviceSession !== 'string' || deviceSession.trim() === '') {
    failures.push('missing_device_session');
  } else {
    if (packet.runtimeEvidence?.sessionId !== deviceSession) failures.push('runtime_session_mismatch');
    if (packet.humanCheck?.sessionId !== deviceSession) failures.push('human_session_mismatch');
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: failures.length === 0 ? 'pass' : 'fail',
    sessionBound: failures.length === 0,
    failures: Object.freeze(failures),
  });
}
