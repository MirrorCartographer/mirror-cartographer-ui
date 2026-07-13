import fs from 'node:fs';

const PRIORITY_RANK = new Map([
  ['highest', 0],
  ['high', 1],
  ['medium', 2],
  ['low', 3],
]);

export function selectOwnedQueueItem(queue, owner) {
  if (!queue || !Array.isArray(queue.items)) {
    throw new Error('queue.items must be an array');
  }
  if (typeof owner !== 'string' || owner.length === 0) {
    throw new Error('owner must be a non-empty string');
  }

  const candidates = queue.items
    .filter((item) => item && item.owner === owner)
    .filter((item) => !['completed', 'retired', 'cancelled'].includes(item.state))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = PRIORITY_RANK.get(a.item.priority) ?? Number.MAX_SAFE_INTEGER;
      const bRank = PRIORITY_RANK.get(b.item.priority) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.index - b.index;
    });

  if (candidates.length === 0) {
    return {
      status: 'blocked_no_owned_queue_item',
      owner,
      selected_item: null,
      claim_boundary: 'No implementation work may be attributed to this team until an owned queue item exists.',
    };
  }

  return {
    status: 'selected',
    owner,
    selected_item: candidates[0].item,
    claim_boundary: 'Selection proves queue ownership and priority ordering only; it does not prove implementation or deployment.',
  };
}

function main() {
  const [queuePath, owner] = process.argv.slice(2);
  if (!queuePath || !owner) {
    console.error('usage: node operations/tools/select-owned-queue-item.mjs <queue.json> <owner>');
    process.exit(2);
  }
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  process.stdout.write(`${JSON.stringify(selectOwnedQueueItem(queue, owner), null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
