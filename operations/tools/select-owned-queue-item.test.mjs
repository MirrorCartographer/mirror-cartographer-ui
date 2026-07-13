import assert from 'node:assert/strict';
import test from 'node:test';
import { selectOwnedQueueItem } from './select-owned-queue-item.mjs';

test('fails closed when the team owns no queue item', () => {
  const result = selectOwnedQueueItem({ items: [{ id: 'V-001', owner: 'vercel_studio', priority: 'highest', state: 'in_progress' }] }, 'cloudflare_research');
  assert.equal(result.status, 'blocked_no_owned_queue_item');
  assert.equal(result.selected_item, null);
});

test('selects the highest-priority active item owned by the team', () => {
  const result = selectOwnedQueueItem({ items: [
    { id: 'C-LOW', owner: 'cloudflare_research', priority: 'low', state: 'in_progress' },
    { id: 'C-HIGH', owner: 'cloudflare_research', priority: 'highest', state: 'proposed' },
  ] }, 'cloudflare_research');
  assert.equal(result.status, 'selected');
  assert.equal(result.selected_item.id, 'C-HIGH');
});

test('ignores completed owned items', () => {
  const result = selectOwnedQueueItem({ items: [
    { id: 'C-DONE', owner: 'cloudflare_research', priority: 'highest', state: 'completed' },
    { id: 'C-NEXT', owner: 'cloudflare_research', priority: 'high', state: 'in_progress' },
  ] }, 'cloudflare_research');
  assert.equal(result.selected_item.id, 'C-NEXT');
});

test('preserves queue order for equal priorities', () => {
  const result = selectOwnedQueueItem({ items: [
    { id: 'C-FIRST', owner: 'cloudflare_research', priority: 'high', state: 'proposed' },
    { id: 'C-SECOND', owner: 'cloudflare_research', priority: 'high', state: 'proposed' },
  ] }, 'cloudflare_research');
  assert.equal(result.selected_item.id, 'C-FIRST');
});
