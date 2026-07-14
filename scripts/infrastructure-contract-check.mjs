import assert from 'node:assert/strict';
import { infrastructureConfig } from '../server/config.js';
import { issueDevelopmentSession, verifyDevelopmentSession } from '../server/auth.js';
import { allowedCollections, createRepository } from '../server/repository.js';

const config = infrastructureConfig({ NODE_ENV: 'development', SESSION_SECRET: 'test-secret-with-enough-entropy' });
assert.equal(config.production, false);
assert.equal(config.supabase.enabled, false);
assert.ok(allowedCollections.includes('animals'));
assert.ok(allowedCollections.includes('evidence_nodes'));

const token = issueDevelopmentSession({ id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' }, config, 60);
const identity = verifyDevelopmentSession(token, config);
assert.equal(identity.email, 'test@example.com');
assert.equal(verifyDevelopmentSession(`${token}tampered`, config), null);

const repository = createRepository(config);
assert.equal(repository.mode, 'memory');
const saved = await repository.upsert(identity.sub, 'animals', {
  title: 'Test animal',
  content: { species: 'cat' },
  privacy: 'private',
});
assert.equal(saved.owner_id, identity.sub);
assert.equal(saved.collection, 'animals');
assert.equal((await repository.list(identity.sub, 'animals')).length, 1);
assert.equal((await repository.list(identity.sub, 'animals', { search: 'cat' })).length, 1);
assert.equal((await repository.exportAll(identity.sub)).length, 1);
await repository.remove(identity.sub, 'animals', saved.id);
assert.equal((await repository.list(identity.sub, 'animals')).length, 0);

console.log('Infrastructure contract: PASS');
