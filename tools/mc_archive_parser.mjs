#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
const outDir = process.argv[3] || 'mc_knowledge_output';

if (!input) {
  console.log('Usage: node tools/mc_archive_parser.mjs <conversations.json> [output_dir]');
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const conversations = Array.isArray(raw) ? raw : raw.conversations || [];

const lanes = {
  mirror: ['mirror', 'cartographer', 'symbol', 'field', 'glyph', 'lyr', 'portal'],
  animals: ['vet', 'cat', 'dog', 'animal', 'fiv', 'glaucoma', 'murmur'],
  body: ['symptom', 'doctor', 'eye', 'pain', 'blood', 'heart', 'autoimmune', 'neurology'],
  creative: ['song', 'music', 'image', 'video', 'art', 'film', 'visual', 'album'],
  proof: ['proof', 'research', 'benchmark', 'arc', 'validate', 'evidence', 'source'],
  money: ['money', 'job', 'rent', 'work', 'remote', 'resume', 'van', 'travel'],
  build: ['github', 'vercel', 'website', 'code', 'connector', 'tool', 'app'],
  learning: ['learn', 'teach', 'explain', 'meaning', 'biology', 'physics', 'math'],
};

const roleRules = {
  evidence: ['record', 'result', 'date', 'file', 'source', 'commit', 'test', 'lab'],
  symbol: ['symbol', 'song', 'image', 'color', 'nickname', 'glyph', 'field', 'light'],
  constraint: ['stop', 'never', 'always', 'prefer', 'accessibility', 'read aloud', 'blocked'],
  artifact: ['create', 'build', 'pdf', 'site', 'resume', 'image', 'report', 'file'],
  instruction: ['make', 'fix', 'connect', 'add', 'update', 'deploy', 'finish'],
  question: ['why', 'how', 'what', 'where', '?'],
};

function messageText(message) {
  const parts = message?.content?.parts || [];
  return parts.map((part) => typeof part === 'string' ? part : '').filter(Boolean).join('\n').trim();
}

function getMessages(conversation) {
  const nodes = Object.values(conversation.mapping || {});
  return nodes
    .map((node) => node.message)
    .filter(Boolean)
    .map((message) => ({
      role: message.author?.role || 'unknown',
      time: message.create_time || null,
      text: messageText(message),
    }))
    .filter((item) => item.text)
    .sort((a, b) => (a.time || 0) - (b.time || 0));
}

function tagsFor(text, dictionary) {
  const lower = text.toLowerCase();
  return Object.entries(dictionary)
    .filter(([, words]) => words.some((word) => lower.includes(word)))
    .map(([key]) => key);
}

const conversationIndex = [];
const knowledgeObjects = [];
const edgeCandidates = [];

for (const [index, conversation] of conversations.entries()) {
  const title = conversation.title || `Conversation ${index}`;
  const messages = getMessages(conversation);
  const joined = `${title}\n${messages.filter((m) => m.role === 'user').slice(0, 12).map((m) => m.text).join('\n')}`;
  const laneTags = tagsFor(joined, lanes);
  conversationIndex.push({ index, id: conversation.id, title, message_count: messages.length, lane_tags: laneTags });

  for (const [messageIndex, message] of messages.entries()) {
    const roleTags = tagsFor(message.text, roleRules);
    const msgLanes = tagsFor(message.text, lanes);
    if (!roleTags.length && !msgLanes.length) continue;
    const object = {
      id: `c${index}-m${messageIndex}`,
      conversation_index: index,
      conversation_title: title,
      author_role: message.role,
      time: message.time,
      lanes: [...new Set([...laneTags, ...msgLanes])],
      roles: roleTags.length ? roleTags : ['context'],
      text_excerpt: message.text.slice(0, 600),
    };
    knowledgeObjects.push(object);
  }

  for (let i = 0; i < laneTags.length; i += 1) {
    for (let j = i + 1; j < laneTags.length; j += 1) {
      edgeCandidates.push({ source: laneTags[i], target: laneTags[j], conversation_index: index, conversation_title: title });
    }
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'conversation_index.json'), JSON.stringify(conversationIndex, null, 2));
fs.writeFileSync(path.join(outDir, 'knowledge_objects.json'), JSON.stringify(knowledgeObjects, null, 2));
fs.writeFileSync(path.join(outDir, 'relationship_edges.json'), JSON.stringify(edgeCandidates, null, 2));
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  conversation_count: conversations.length,
  indexed_message_count: knowledgeObjects.length,
  edge_candidate_count: edgeCandidates.length,
  rule: 'Every conversation is project material by default; classify fragments by lane and object role instead of treating chats as isolated chats.'
}, null, 2));

console.log(`Wrote Mirror Cartographer knowledge output to ${outDir}`);
