import assert from 'node:assert/strict';
import fs from 'node:fs';

const world = fs.readFileSync('src/components/LivingWorld.jsx', 'utf8');
const style = fs.readFileSync('src/components/LivingWorld.css', 'utf8');
const entry = fs.readFileSync('src/main.jsx', 'utf8');
const pages = fs.readFileSync('.github/workflows/publish-github-pages.yml', 'utf8');

assert.ok(world.includes("const MEMORY_KEY = 'mc-living-world-visitor-v1'"), 'visitor memory must have a stable local key');
assert.ok(world.includes('visitorId: typeof value.visitorId'), 'each browser visitor must receive a persistent identity');
assert.ok(world.includes('visitorSeed(memory.visitorId)'), 'first encounter must be individualized per visitor');
assert.ok(world.includes('memory.choices.includes'), 'return dialogue must respond to remembered choices');
assert.ok(world.includes('onPointerMove={trackPresence}'), 'the environment must respond to continuous pointer presence');
assert.ok(world.includes("onPointerLeave={() => onPresence('away')}"), 'the world must register when a visitor leaves the scene');
assert.ok(world.includes("setPresence('still')"), 'stillness must produce a distinct environmental state');
assert.ok(world.includes('function Morrow'), 'Morrow must be a real character component');
assert.ok(world.includes('function Vesper'), 'Vesper must be a real character component');
assert.ok(world.includes('const toggleSound = async'), 'sound must be an explicit opt-in interaction');
assert.ok(style.includes('.presence-still .morrow-lantern'), 'Morrow must respond to visitor stillness');
assert.ok(style.includes('.presence-still .vesper-body'), 'Vesper must have an independent stillness animation');
assert.ok(style.includes('.morrow-eyes{translate:var(--gaze-x'), 'Morrow must track the visitor');
assert.ok(style.includes('@media(prefers-reduced-motion:reduce)'), 'motion must respect reduced-motion preferences');
assert.ok(entry.includes(': <LivingWorld />'), 'the Pages default route must open the inhabited world');
assert.ok(pages.includes('npm run build:pages'), 'the hosted build must use the GitHub Pages base path');
assert.ok(pages.includes('actions/upload-pages-artifact@v3'), 'the build must upload a Pages artifact');
assert.ok(pages.includes('actions/deploy-pages@v4'), 'the release must deploy through GitHub Pages');

console.log('PASS: visitor-specific memory, passive presence, character response, accessibility, and GitHub Pages release contract.');
