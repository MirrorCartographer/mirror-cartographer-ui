import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVerifiedVercelEvidencePacket } from './assess-verified-vercel-evidence-packet.mjs';

const packet = {
  verified: true,
  coherence_verified: true,
  packet_id: 'pkt-1',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  source_commit_sha: 'a'.repeat(40),
  claim_ceiling: 'retained bytes only',
  deployment_claim_permitted: false
};

const base = {
  marker_path: '/tmp/complete.json',
  observed_at: '2026-07-13T16:54:00Z',
  statuses: [{ context: 'Vercel', state: 'success', target_url: 'https://vercel.example/deployment' }],
  read_packet: async () => packet
};

test('reads verified coherent packet before assessment and binds identity', async () => {
  let seen;
  const result = await assessVerifiedVercelEvidencePacket({
    ...base,
    assess_status(input) {
      seen = input;
      return { accepted: true, deployable: false, deployment_identity_verified: false, decision: 'identity_unverified', ...input };
    }
  });
  assert.equal(seen.repository, packet.repository);
  assert.equal(seen.commit_sha, packet.source_commit_sha);
  assert.equal(result.packet_id, packet.packet_id);
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects unverified or incoherent packets before assessor invocation', async () => {
  let called = false;
  await assert.rejects(
    assessVerifiedVercelEvidencePacket({
      ...base,
      read_packet: async () => ({ ...packet, coherence_verified: false }),
      assess_status() { called = true; }
    }),
    /verified_coherent_packet_required/
  );
  assert.equal(called, false);
});

test('rejects assessor identity divergence', async () => {
  await assert.rejects(
    assessVerifiedVercelEvidencePacket({
      ...base,
      assess_status: () => ({
        accepted: true,
        deployable: false,
        deployment_identity_verified: false,
        repository: 'other/repo',
        commit_sha: 'b'.repeat(40)
      })
    }),
    /assessment_packet_identity_mismatch/
  );
});

test('never promotes deployment permission while packet ceiling forbids it', async () => {
  const result = await assessVerifiedVercelEvidencePacket({
    ...base,
    assess_status: (input) => ({
      accepted: true,
      deployable: true,
      deployment_identity_verified: true,
      ...input
    })
  });
  assert.equal(result.deployment_claim_permitted, false);
});
