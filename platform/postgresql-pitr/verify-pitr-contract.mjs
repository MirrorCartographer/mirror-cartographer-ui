#!/usr/bin/env node
import fs from 'node:fs';
const [config, archive, restore] = process.argv.slice(2).map(p => fs.readFileSync(p,'utf8'));
const checks = [
 ['wal_level replica or higher', /wal_level\s*=\s*['\"]?(replica|logical)/i.test(config)],
 ['archive mode enabled', /archive_mode\s*=\s*['\"]?(on|always)/i.test(config)],
 ['archive command delegates', /archive_command\s*=.*archive-wal\.sh/i.test(config)],
 ['full page writes enabled', /full_page_writes\s*=\s*['\"]?on/i.test(config)],
 ['checksums requested', /--checkpoint=fast/.test(config) || /pg_basebackup/.test(config)],
 ['archive is immutable on collision', /immutable WAL collision/.test(archive) && /cmp -s/.test(archive)],
 ['archive writes checksum', /sha256sum/.test(archive)],
 ['restore verifies checksum', /sha256sum -c/.test(restore)],
 ['restore fails missing WAL', /\[\[ -f \"\$src\" && -f \"\$src\.sha256\" \]\] \|\| exit 1/.test(restore)],
];
let bad=0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
