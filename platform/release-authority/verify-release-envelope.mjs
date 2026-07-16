#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const stop = message => { console.error(message); process.exit(1); };
const [policyFile, envelopeFile, provenanceFile, sbomFile] = process.argv.slice(2);
if (![policyFile, envelopeFile, provenanceFile, sbomFile].every(Boolean)) stop('four input files required');

const policy = JSON.parse(readFileSync(policyFile, 'utf8'));
const envelope = JSON.parse(readFileSync(envelopeFile, 'utf8'));
const provenanceBytes = readFileSync(provenanceFile);
const provenance = JSON.parse(provenanceBytes.toString('utf8'));
const sbomBytes = readFileSync(sbomFile);
const hash = value => createHash('sha256').update(value).digest('hex');

const imagePattern = /^.+@sha256:[a-f0-9]{64}$/;
if (envelope.schemaVersion !== policy.schemaVersion) stop('unsupported schema');
if (envelope.authority !== policy.authority) stop('authority mismatch');
if (!imagePattern.test(envelope.image)) stop('image reference must be digest-only');
if (envelope.imageDigest !== envelope.image.split('@')[1]) stop('image digest mismatch');
if (!/^[a-f0-9]{40}$/.test(envelope?.source?.commit ?? '')) stop('full source commit required');
if (envelope?.provenance?.sha256 !== hash(provenanceBytes)) stop('provenance hash mismatch');
if (envelope?.sbom?.sha256 !== hash(sbomBytes)) stop('SBOM hash mismatch');
if (provenance.predicateType !== policy.requiredPredicateType) stop('predicate type not allowed');
const builder = provenance?.predicate?.runDetails?.builder?.id;
if (!policy.allowedBuilderIds.includes(builder)) stop('builder identity not allowed');
if (envelope?.provenance?.builderId !== builder) stop('builder identity mismatch');
console.log(`ACCEPT ${envelope.image}`);
