#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = path.join(root, 'revenue', 'offers.json');
const pagePath = path.join(root, 'public', 'commissions.html');

function fail(message) {
  console.error(`revenue-engine: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(manifestPath)) fail('missing revenue/offers.json');
if (!fs.existsSync(pagePath)) fail('missing public/commissions.html');

if (!process.exitCode) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const page = fs.readFileSync(pagePath, 'utf8');

  if (!Array.isArray(manifest.offers) || manifest.offers.length === 0) fail('no offers defined');
  if (!/^https:\/\//u.test(manifest.checkout || '')) fail('checkout must be HTTPS');
  if (!page.includes(manifest.checkout)) fail('commission page does not use canonical checkout');

  const ids = new Set();
  for (const offer of manifest.offers || []) {
    if (!offer.id || ids.has(offer.id)) fail(`missing or duplicate offer id: ${offer.id || '<empty>'}`);
    ids.add(offer.id);
    if (!Number.isFinite(offer.price) || offer.price <= 0) fail(`${offer.id}: price must be positive`);
    if (!Array.isArray(offer.deliverables) || offer.deliverables.length < 3) fail(`${offer.id}: at least three deliverables required`);
    if (!Number.isInteger(offer.capacity_per_week) || offer.capacity_per_week < 1) fail(`${offer.id}: bounded weekly capacity required`);
    if (!page.includes(offer.name) || !page.includes(`$${offer.price}`)) fail(`${offer.id}: page and manifest disagree`);
  }

  if (!process.exitCode) {
    const maxWeeklyRevenue = manifest.offers.reduce(
      (sum, offer) => sum + offer.price * offer.capacity_per_week,
      0,
    );
    console.log(JSON.stringify({
      valid: true,
      offers: manifest.offers.length,
      checkout: manifest.checkout,
      maximum_listed_weekly_capacity_usd: maxWeeklyRevenue,
    }, null, 2));
  }
}
