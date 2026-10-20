'use strict';

/**
 * Operations-only reference implementation for HOURLY_REPERTORY.v1.json.
 * This file is deliberately outside the application runtime. It performs no
 * network, audio, storage, analytics, commerce, or deployment operations.
 */

function assertIntegerHour(utcHour) {
  if (!Number.isInteger(utcHour) || utcHour < 0 || utcHour > 23) {
    throw new RangeError('utcHour must be an integer from 0 through 23');
  }
}

function validateRepertory(repertory) {
  if (!repertory || typeof repertory !== 'object' || Array.isArray(repertory)) {
    throw new TypeError('repertory must be an object');
  }
  if (repertory.selection_rule?.type !== 'deterministic_hour_slot' ||
      repertory.selection_rule?.expression !== 'hour_slots[utc_hour]') {
    throw new Error('repertory must use the canonical direct hour-slot rule');
  }

  const productions = repertory.productions;
  const slots = repertory.hour_slots;
  if (!Array.isArray(productions) || productions.length === 0) {
    throw new Error('repertory.productions must be a non-empty array');
  }
  if (!Array.isArray(slots) || slots.length !== 24) {
    throw new Error('repertory.hour_slots must contain exactly 24 entries');
  }

  const productionIds = new Set();
  for (const production of productions) {
    if (!production || typeof production.id !== 'string' || production.id.trim() === '') {
      throw new Error('every production must have a non-empty string id');
    }
    if (productionIds.has(production.id)) throw new Error(`duplicate production id: ${production.id}`);
    productionIds.add(production.id);
  }

  const seenHours = new Set();
  const editionIds = new Set();
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
      throw new Error('every hour slot must be an object');
    }
    assertIntegerHour(slot.utc_hour);
    if (seenHours.has(slot.utc_hour)) throw new Error(`duplicate utc_hour slot: ${slot.utc_hour}`);
    seenHours.add(slot.utc_hour);
    if (typeof slot.edition_id !== 'string' || slot.edition_id.trim() === '') {
      throw new Error('programmed hour slot must declare a non-empty edition_id');
    }
    if (editionIds.has(slot.edition_id)) throw new Error(`duplicate edition_id: ${slot.edition_id}`);
    editionIds.add(slot.edition_id);
    if (!productionIds.has(slot.production_id)) {
      throw new Error(`unknown production_id in hour slot: ${slot.production_id}`);
    }
  }

  for (let hour = 0; hour < 24; hour += 1) {
    if (!seenHours.has(hour)) throw new Error(`missing utc_hour slot: ${hour}`);
  }
  return true;
}

function selectHourlyProduction(repertory, utcHour) {
  assertIntegerHour(utcHour);
  validateRepertory(repertory);

  const slot = repertory.hour_slots.find((candidate) => candidate.utc_hour === utcHour);
  const production = repertory.productions.find((candidate) => candidate.id === slot.production_id);
  return Object.freeze({
    utc_hour: utcHour,
    edition_id: slot.edition_id,
    edition_cue: slot.edition_cue,
    production_id: production.id,
    title: production.title,
    form: production.form,
    continuity_role: production.continuity_role,
    status: production.status,
  });
}

function selectForDate(repertory, date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('date must be a valid Date');
  }
  return selectHourlyProduction(repertory, date.getUTCHours());
}

module.exports = { selectForDate, selectHourlyProduction, validateRepertory };
