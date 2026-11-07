import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('db/004_agency_preserving_memory_ledger.sql', 'utf8');
const service = fs.readFileSync('src/services/sharedWorld.js', 'utf8');
const panel = fs.readFileSync('src/components/SharedWorldPanel.jsx', 'utf8');
const edge = fs.readFileSync('supabase/functions/resident-dialogue/index.ts', 'utf8');
const workflow = fs.readFileSync('.github/workflows/publish-github-pages.yml', 'utf8');

for (const field of ['memory_class','source_scope','retention_class','source_pointer','source_summary','confidence','sensitivity_class','claim_status','allowed_uses','prohibited_uses','reason_for_retention','expiration_or_review_date','user_visible','user_editable','last_user_reviewed_at','derived_from_ids']) {
  assert.ok(schema.includes(field), 'memory ledger schema must include ' + field);
}
assert.ok(schema.includes('enable row level security'), 'memory ledger must enforce RLS');
assert.ok(schema.includes('auth.uid() = owner_id'), 'memory ledger access must be owner-scoped');
assert.ok(schema.includes('retention_class <> \'private-durable\' or (user_visible = true and user_editable = true)'), 'durable private memories must be visible and editable');
assert.ok(schema.includes("source_scope = 'public-safe-abstraction' and sensitivity_class = 'low'"), 'public-safe entries must be abstracted and low-sensitivity');
assert.ok(service.includes("memory_class: 'user-approved'"), 'only explicitly approved visitor choices enter durable memory');
assert.ok(service.includes("reason_for_retention: 'Visitor explicitly enabled cross-device memory sync"), 'each durable choice must retain its reason');
assert.ok(service.includes('loadPrivateMemoryLedger'), 'the UI must be able to retrieve memory ledger entries');
assert.ok(service.includes('updatePrivateMemoryNote'), 'the visitor must be able to revise a memory note');
assert.ok(service.includes('deletePrivateMemoryEntry'), 'the visitor must be able to delete an individual memory');
assert.ok(panel.includes('PRIVATE MEMORY LEDGER'), 'the memory ledger must be visible in the interface');
assert.ok(panel.includes('SAVE NOTE') && panel.includes('FORGET'), 'the interface must expose edit and delete actions');
assert.ok(panel.includes('Let Tazar and Jello consult my private memory when replying'), 'provider use of memory must have a separate opt-in');
assert.ok(service.includes('includeMemory: isPrivateMemorySyncEnabled() && isResidentMemoryUseEnabled()'), 'provider memory access must require both storage and provider-use consent');
assert.ok(edge.includes("eq('memory_class', 'user-approved')"), 'the provider may read only user-approved entries');
assert.ok(edge.includes("eq('retention_class', 'private-durable')"), 'the provider may read only private durable entries');
assert.ok(edge.includes("eq('sensitivity_class', 'low')"), 'the provider may read only low-sensitivity entries');
assert.ok(edge.includes(".contains('allowed_uses', ['personalization'])"), 'the provider must honor allowed-use metadata');
assert.ok(!edge.includes('user_note'), 'visitor-authored ledger notes must not be sent to the model provider');
assert.ok(workflow.includes('npm run test:agency-memory-ledger'), 'the Pages workflow must run the agency memory contract');
console.log('PASS: agency-preserving memory schema, RLS, review/edit/delete, and provider-use consent.');
