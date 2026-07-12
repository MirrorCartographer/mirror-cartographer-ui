#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const CLAIM_STATES = new Set(['observed', 'inferred', 'proposed', 'superseded', 'unresolved']);
const SOURCE_CLASSES = new Set([
  'direct_original_record',
  'authenticated_copy',
  'derived_structured_memory',
  'retrospective_recollection',
  'inference',
  'proposal'
]);

export function validateContinuityRecord(record) {
  const errors = [];
  const required = ['id', 'team', 'claimState', 'sourceClass', 'privacyBoundary', 'revision'];
  for (const key of required) {
    if (record?.[key] === undefined || record?.[key] === null || record?.[key] === '') {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (record?.team !== 'continuity_mining') errors.push('team must be continuity_mining');
  if (record?.claimState && !CLAIM_STATES.has(record.claimState)) {
    errors.push(`invalid claimState: ${record.claimState}`);
  }
  if (record?.sourceClass && !SOURCE_CLASSES.has(record.sourceClass)) {
    errors.push(`invalid sourceClass: ${record.sourceClass}`);
  }

  if (record?.sourceClass === 'authenticated_copy' && !record?.originQualification) {
    errors.push('authenticated_copy requires originQualification');
  }
  if (record?.claimState === 'superseded' && !record?.supersededBy) {
    errors.push('superseded claim requires supersededBy');
  }
  if (record?.claimState === 'proposed' && record?.implementationStatus === 'implemented') {
    errors.push('proposed claim cannot be marked implemented');
  }

  if (Array.isArray(record?.conflicts) && record.conflicts.length > 0) {
    record.conflicts.forEach((conflict, index) => {
      for (const field of ['claimA', 'claimB', 'conflictType', 'currentOperationalChoice', 'reversalEvidence']) {
        if (!conflict?.[field]) errors.push(`conflicts[${index}] missing ${field}`);
      }
      if (!conflict?.claimA?.sourceClass || !conflict?.claimB?.sourceClass) {
        errors.push(`conflicts[${index}] must retain sourceClass for both claims`);
      }
    });
  }

  if (record?.privacyBoundary?.exposure === 'public' && record?.privacyBoundary?.containsPrivateSourceMaterial === true) {
    errors.push('public record cannot expose private source material');
  }

  return { valid: errors.length === 0, errors };
}

function runCli() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/continuity-record-validator.mjs <record.json>');
    process.exit(2);
  }
  const fullPath = path.resolve(target);
  const record = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const result = validateContinuityRecord(record);
  console.log(JSON.stringify({ file: fullPath, ...result }, null, 2));
  process.exit(result.valid ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) runCli();
