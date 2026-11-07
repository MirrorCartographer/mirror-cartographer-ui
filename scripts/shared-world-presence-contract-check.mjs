import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('db/002_shared_world_presence.sql', 'utf8');

assert.match(sql, /create table if not exists public\.world_connections/i);
assert.match(sql, /create table if not exists public\.world_presence/i);
assert.match(sql, /alter table public\.world_connections enable row level security/i);
assert.match(sql, /alter table public\.world_presence enable row level security/i);
assert.match(sql, /world_connections_participant_read[\s\S]*auth\.uid\(\) = requester_id or auth\.uid\(\) = recipient_id/i);
assert.match(sql, /world_connections_request[\s\S]*auth\.uid\(\) = requester_id and status = 'pending'/i);
assert.match(sql, /world_connections_recipient_decision[\s\S]*auth\.uid\(\) = recipient_id and status = 'pending'/i);
assert.match(sql, /world_connections_requester_revoke[\s\S]*status = 'accepted'[\s\S]*status = 'revoked'/i);
assert.match(sql, /world_connections_undirected_pair_idx[\s\S]*least\(requester_id, recipient_id\)[\s\S]*greatest\(requester_id, recipient_id\)/i);
assert.match(sql, /guard_world_connection_update[\s\S]*participants are immutable/i);
assert.match(sql, /invalid connection status transition/i);
assert.match(sql, /world_connections_guard_update/i);
assert.match(sql, /refresh_world_presence_expiry[\s\S]*interval '90 seconds'/i);
assert.match(sql, /world_presence_refresh_expiry/i);
assert.match(sql, /visibility in \('private','connections','public'\)/i);
assert.match(sql, /activity_state in \('present','wandering','in-conversation','away'\)/i);
assert.match(sql, /expires_at > now\(\)/i);
assert.match(sql, /alter publication supabase_realtime add table public\.world_presence/i);
assert.match(sql, /grant select, insert, update on public\.world_connections to authenticated/i);
assert.match(sql, /grant select, insert, update, delete on public\.world_presence to authenticated/i);
assert.doesNotMatch(sql, /service_role|microphone|transcript|pointer_coordinates|raw_audio/i);

console.log('PASS: shared-world RLS, relationship transitions, expiring presence, Realtime publication, and data minimization contract.');
