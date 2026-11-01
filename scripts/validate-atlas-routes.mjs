import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const repoRoot = resolve('.');
const atlasRoot = resolve('public/atlas');
const legacyHost = /(?:vercel\.app|netlify\.app|pages\.dev)/i;
const experimentSlugs = [
  '001-observatory',
  '002-machine-garden',
  '003-echo-cathedral',
  '004-carnival-of-thought',
  '005-ocean',
  '006-living-blueprint',
  '007-dream-library',
  '008-signal-forest',
  '009-impossible-museum',
  '010-composer',
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}

function localTarget(file, rawValue) {
  const value = rawValue.trim();
  if (!value || value.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
  const pathPart = value.split(/[?#]/, 1)[0];
  if (!pathPart) return null;

  const sourceRoute = relative(repoRoot, file).replace(/^public\//, '').split(sep).join('/');
  const base = new URL(sourceRoute, 'https://atlas.invalid/');
  const resolved = new URL(pathPart, base);
  if (resolved.origin !== 'https://atlas.invalid') return null;

  let pathname;
  try {
    pathname = decodeURIComponent(resolved.pathname);
  } catch {
    throw new Error('Invalid URL encoding in ' + relative(repoRoot, file));
  }

  const target = pathname === '/'
    ? resolve(repoRoot, 'index.html')
    : resolve(repoRoot, 'public', '.' + pathname);
  const rel = relative(repoRoot, target);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error('Atlas route escapes repository root: ' + relative(repoRoot, file));
  }

  const candidates = [];
  if (existsSync(target) && statSync(target).isDirectory()) candidates.push(join(target, 'index.html'));
  candidates.push(target);
  if (!extname(target)) candidates.push(join(target, 'index.html'));
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!found) throw new Error('Broken local atlas route or asset: ' + relative(repoRoot, file) + ' -> ' + rawValue);
  return found;
}

const htmlFiles = walk(atlasRoot).filter((file) => extname(file).toLowerCase() === '.html');
let checkedReferences = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const tags = [...html.matchAll(/<[a-z][^>]*>/gi)].map((match) => match[0]);
  const attributes = tags.flatMap((tag) => [...tag.matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
    .map((match) => match[1] ?? match[2] ?? match[3]));
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  const css = styles.flatMap((style) => [...style.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)]
    .map((match) => (match[1] ?? match[2] ?? match[3]).trim()));
  for (const value of attributes) {
    if (/^https?:/i.test(value) && legacyHost.test(value)) {
      throw new Error('Legacy hosting URL found in public Atlas route: ' + relative(repoRoot, file));
    }
    if (localTarget(file, value)) checkedReferences += 1;
  }
  for (const value of css) {
    if (localTarget(file, value)) checkedReferences += 1;
  }
}

const experimentsPath = join(atlasRoot, 'worlds', 'experiments.html');
const experimentsHtml = readFileSync(experimentsPath, 'utf8');
for (const slug of experimentSlugs) {
  const route = 'https://mirrorcartographer.github.io/MirrorCartographer/experiments/' + slug + '/';
  if (!experimentsHtml.includes(route)) throw new Error('Missing core Pages experiment route: ' + slug);
}

const indexHtml = readFileSync(join(atlasRoot, 'index.html'), 'utf8');
const localCopies = [...indexHtml.matchAll(/:\s*['"](\.\/worlds\/[^'"]+)['"]/g)].map((match) => match[1]);
for (const route of localCopies) {
  const target = resolve(atlasRoot, route.replace(/^\.\//, ''));
  if (!existsSync(target)) throw new Error('Missing local mirror target: ' + route);
}

console.log(JSON.stringify({
  result: 'PASS',
  htmlRoutesScanned: htmlFiles.length,
  localReferencesChecked: checkedReferences,
  localMirrorTargetsChecked: localCopies.length,
  coreExperimentRoutesChecked: experimentSlugs.length,
  legacyHostingLinks: 0,
}, null, 2));
