import assert from 'node:assert/strict';
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

console.log(JSON.stringify({ rooms: ROOMS.length, layersPerRoom: LAYERS_PER_ROOM, totalLayers: ROOMS.length * LAYERS_PER_ROOM, uniqueSignatures: new Set(signatures).size }, null, 2));
