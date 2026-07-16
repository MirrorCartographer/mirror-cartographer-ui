#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const [image, sourceCommit, provenancePath, sbomPath, outputPath = 'release-envelope.json'] = process.argv.slice(2);
if (!image || !sourceCommit || !provenancePath || !sbomPath) {
  fail('usage: create-release-envelope.mjs <image@sha256:digest> <40-char-source-commit> <provenance.json> <sbom-file> [output.json]');
}
if (!/^.+@sha256:[a-f0-9]{64}$/.test(image)) fail('image must be an immutable sha256 digest reference');
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) fail('source commit must be a full 40-character lowercase Git SHA-1');

const provenanceBytes = readFileSync(provenancePath);
const sbomBytes = readFileSync(sbomPath);
let provenance;
try { provenance = JSON.parse(provenanceBytes.toString('utf8')); } catch { fail('provenance must be valid JSON'); }
if (provenance.predicateType !== 'https://slsa.dev/provenance/v1') fail('provenance predicateType must be SLSA v1');
const builderId = provenance?.predicate?.runDetails?.builder?.id;
if (!builderId) fail('provenance must include predicate.runDetails.builder.id');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const envelope = {
  schemaVersion: 1,
  authority: 'foundation-intelligence-release-root',
  image,
  imageDigest: image.split('@')[1],
  source: {
    repository: 'https://github.com/MirrorCartographer/mirror-cartographer-ui',
    commit: sourceCommit
  },
  provenance: {
    predicateType: provenance.predicateType,
    builderId,
    sha256: sha256(provenanceBytes)
  },
  sbom: {
    sha256: sha256(sbomBytes)
  }
};

writeFileSync(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o644 });
console.log(outputPath);
