import assert from 'node:assert/strict';

export function verifyAudioDeviceEvidenceSlice({ runtimeSource, mainSource, contractSource }) {
  const checks = {
    runtimeRequiresDocument: runtimeSource.includes('!target?.document'),
    runtimeUsesInjectedDocument: runtimeSource.includes('target.document.documentElement.dataset.audioDeviceViewport'),
    zeroViewportUnknown: runtimeSource.includes('width > 0') && runtimeSource.includes("'unknown'"),
    mainInjectsDocument: mainSource.includes('installAudioDeviceEvidenceRuntime({ window, navigator, document })'),
    privacyAssertionsPresent: contractSource.includes('rawUserAgentCollected')
      && contractSource.includes('exactViewportCollected')
      && contractSource.includes('persistentIdentifierCollected'),
    unknownViewportTestPresent: contractSource.includes("unknown.viewport.widthBucket, 'unknown'")
      && contractSource.includes("unknown.viewport.orientation, 'unknown'"),
  };

  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: failures.length === 0 ? 'pass' : 'fail',
    checks,
    failures,
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const fixture = verifyAudioDeviceEvidenceSlice({
    runtimeSource: "if (!target?.window || !target?.navigator || !target?.document) return null; const hasViewport = width > 0; target.document.documentElement.dataset.audioDeviceViewport = 'unknown';",
    mainSource: 'installAudioDeviceEvidenceRuntime({ window, navigator, document });',
    contractSource: "rawUserAgentCollected exactViewportCollected persistentIdentifierCollected unknown.viewport.widthBucket, 'unknown' unknown.viewport.orientation, 'unknown'",
  });
  assert.equal(fixture.status, 'pass');

  const broken = verifyAudioDeviceEvidenceSlice({ runtimeSource: '', mainSource: '', contractSource: '' });
  assert.equal(broken.status, 'fail');
  assert.equal(broken.failures.length, 6);

  console.log(JSON.stringify({ tests: 2, passed: 2, failed: 0, fixture }, null, 2));
}
