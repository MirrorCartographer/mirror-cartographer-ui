import assert from 'node:assert/strict';
import test from 'node:test';
import { isCredentialLikeFile, isPrivateCatalogPath } from './atlas-privacy-policy.mjs';

test('excludes conversation, transcript, journal, and raw-note paths', () => {
  const blocked = [
    'research/conversations/2026-10-21-research-log.md',
    'mind/journal/README.md',
    'exports/chat-history/session.json',
    'transcripts/meeting.txt',
    'private-conversation.md',
    'raw-private-notes.md',
    'research/raw-conversations/session.json',
    'docs/.env.example',
  ];
  for (const path of blocked) assert.equal(isPrivateCatalogPath(path), true, path);
});

test('excludes sensitive health, pet, and financial record paths', () => {
  const blocked = [
    'medical-records/labs.json',
    'health-records/results.csv',
    'pet-records/animal.json',
    'veterinary-records/visit.json',
    'financial-records/budget.csv',
    'bank-data/transactions.json',
    'health-data/record.json',
  ];
  for (const path of blocked) assert.equal(isPrivateCatalogPath(path), true, path);
});

test('preserves public research and tooling that merely discuss privacy or conversations', () => {
  const allowed = [
    'tools/conversation_parallax/README.md',
    'docs/long-context/CONVERSATIONAL_EMOTIONAL_READING_PROTOCOL.md',
    'mind/research/2026-07-01-private-to-public-distillation-gate.md',
    'tools/animal_health_evidence_gate/README.md',
    'research/literature/health-outcomes.md',
  ];
  for (const path of allowed) assert.equal(isPrivateCatalogPath(path), false, path);
});

test('excludes credential names and sensitive key-store/database formats', () => {
  for (const path of ['build/id_rsa', 'settings/credentials.json', 'vault/private-key.pem', 'data/archive.sqlite']) {
    assert.equal(isCredentialLikeFile(path), true, path);
  }
  assert.equal(isCredentialLikeFile('research/literature/health-outcomes.md'), false);
});
