import fs from 'node:fs';

const app = fs.readFileSync('src/components/App.jsx', 'utf8');
const checks = [
  ['imports phrase memory primitive', app.includes("import { createPhraseMemory } from '../engine/phraseMemory';")],
  ['creates phrase memory during setup', app.includes('phraseMemoryRef.current = createPhraseMemory();')],
  ['remembers tap composition', app.includes('phraseMemoryRef.current?.remember?.(composition)')],
  ['stores contour state for canvas', app.includes('setPhraseContour(phraseMemoryRef.current?.contour?.() ?? null)')],
  ['turns contour into hidden mark', app.includes('function phraseContourMark') && app.includes('phraseContourMark(phraseContour, state')],
  ['feeds contour mark into active canvas memory', app.includes('...safeMarks(contour ? [contour] : [])')],
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
if (failed.length) {
  console.error(`\nPhrase memory score check failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nPhrase memory score check passed: ${checks.length}/${checks.length}`);
