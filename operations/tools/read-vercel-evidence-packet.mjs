import { readFile } from 'node:fs/promises';
import { verifyCommittedPacket } from './vercel-evidence-packet-commit.mjs';

function freezeJson(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJson));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, freezeJson(child)])
    ));
  }
  return value;
}

export async function readVerifiedVercelEvidencePacket({ marker_path }) {
  const verification = await verifyCommittedPacket({ marker_path });
  const marker = JSON.parse(await readFile(marker_path, 'utf8'));
  const subjects = new Map(marker.subjects.map((subject) => [subject.role, subject]));
  const receipt = JSON.parse(await readFile(subjects.get('receipt').path, 'utf8'));
  const manifest = JSON.parse(await readFile(subjects.get('manifest').path, 'utf8'));

  return Object.freeze({
    verified: true,
    packet_id: verification.packet_id,
    source_commit_sha: verification.source_commit_sha,
    receipt: freezeJson(receipt),
    manifest: freezeJson(manifest),
    claim_ceiling: 'verified complete-packet identity and exact retained bytes only; workflow outcome, deployment, audio audibility, and human observation remain unproven',
    deployment_claim_permitted: false
  });
}

async function main(argv) {
  if (argv.length !== 1) {
    throw new Error('usage: node read-vercel-evidence-packet.mjs <packet-complete-marker.json>');
  }
  const packet = await readVerifiedVercelEvidencePacket({ marker_path: argv[0] });
  process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
