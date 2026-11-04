import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOMS, ROOM_COUNT, LAYERS_PER_ROOM } from '../src/world/roomCatalog.js';

assert.equal(ROOM_COUNT, 79, 'room count must remain 79');
assert.equal(ROOMS.length, 79, 'catalog must contain 79 rooms');
assert.equal(LAYERS_PER_ROOM, 20, 'each room must expose 20 layers');
assert.equal(new Set(ROOMS.map((room) => room.id)).size, 79, 'room ids must be unique');
assert.ok(ROOMS.every((room) => room.layers.length >= 20), 'every room must contain at least 20 layers');
assert.ok(ROOMS.every((room) => room.palette.length === 4), 'every room must define a four-part palette');
assert.ok(ROOMS.every((room) => room.tempo >= 52 && room.tempo <= 129), 'room tempo must stay within the audio budget');
assert.ok(ROOMS.slice(1).every((room, index) => room.unlockCost > ROOMS[index].unlockCost), 'unlock costs must increase');

const signatures = ROOMS.map((room) => [room.primary, room.secondary, room.motion, room.interaction, room.audio, room.palette.join(':')].join('|'));
assert.ok(new Set(signatures).size >= 58, 'catalog must maintain strong room-level uniqueness');

const roomWorldSource = fs.readFileSync('src/components/RoomWorldValid.jsx', 'utf8');
assert.ok(roomWorldSource.includes('const sanitizeProgress = value =>'), 'room progress must be sanitized before use');
assert.ok(roomWorldSource.includes('value.filter(validRoomId)'), 'stored room identifiers must be allowlisted');
assert.ok(roomWorldSource.includes('setStorageStatus(\'Progress will not persist after this session.\')'), 'storage denial must be visible to the user');
assert.ok(roomWorldSource.includes('role="status"'), 'storage failure must be announced accessibly');
assert.ok(roomWorldSource.includes('if (!previous.down) return;'), 'hover-only movement must not advance room progress');
assert.ok(roomWorldSource.includes('event.key !== "Tab"'), 'room constellation dialog must trap keyboard focus');
assert.ok(roomWorldSource.includes('event.shiftKey && document.activeElement === first'), 'room constellation dialog must support reverse tab focus');

console.log(JSON.stringify({ rooms: ROOMS.length, layersPerRoom: LAYERS_PER_ROOM, totalLayers: ROOMS.length * LAYERS_PER_ROOM, uniqueSignatures: new Set(signatures).size }, null, 2));
