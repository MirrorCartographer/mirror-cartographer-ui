import { readFile } from 'node:fs/promises';

const publicCss = await readFile('public/art-direction.css', 'utf8');
const sourceCss = await readFile('src/assets/art-direction.css', 'utf8');

if (publicCss !== sourceCss) {
  throw new Error('Shared art-direction CSS drifted: public/art-direction.css and src/assets/art-direction.css must remain byte-identical.');
}

console.log('PASS: public and source art-direction CSS are byte-identical.');
