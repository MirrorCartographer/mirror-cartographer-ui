import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const OUTPUT_DIR = fileURLToPath(new URL('../public/atlas/', import.meta.url));
const GENERATED_FILES = new Set([
  'public/atlas/catalog-main.json',
  'public/atlas/catalog-ui.json',
  'public/atlas/catalog-index.json',
]);
const REPOSITORIES = [
  { repo: 'MirrorCartographer/MirrorCartographer', label: 'Mirror Cartographer — main project', file: 'catalog-main.json' },
  { repo: 'MirrorCartographer/mirror-cartographer-ui', label: 'Mirror Cartographer — interactive UI', file: 'catalog-ui.json' },
];

async function githubJson(path) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mirror-cartographer-atlas-catalog-builder',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
  return response.json();
}

async function buildManifest(source) {
  const commit = await githubJson(`/repos/${source.repo}/commits/main`);
  const treeSha = commit.commit?.tree?.sha;
  if (!/^[0-9a-f]{40}$/i.test(commit.sha) || !/^[0-9a-f]{40}$/i.test(treeSha || '')) {
    throw new Error(`Invalid commit/tree provenance for ${source.repo}`);
  }
  const tree = await githubJson(`/repos/${source.repo}/git/trees/${treeSha}?recursive=1`);
  if (tree.truncated) throw new Error(`GitHub returned a truncated tree for ${source.repo}; refusing an incomplete catalog`);
  const items = tree.tree
    .filter((entry) => entry.type === 'blob')
    .filter((entry) => !(source.repo.endsWith('/mirror-cartographer-ui') && GENERATED_FILES.has(entry.path)))
    .map((entry) => ({
      path: entry.path,
      ext: (entry.path.match(/\.([^.\/]+)$/)?.[1] || '').toLowerCase(),
      bytes: Number.isFinite(entry.size) ? entry.size : null,
      sha: entry.sha,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const seen = new Set();
  for (const item of items) {
    if (!item.path || !/^[0-9a-f]{40}$/i.test(item.sha) || seen.has(item.path)) {
      throw new Error(`Invalid or duplicate file entry in ${source.repo}: ${item.path}`);
    }
    seen.add(item.path);
  }
  return {
    schema_version: 1,
    repository: source.repo,
    branch: 'main',
    source_commit: commit.sha,
    tree_sha: treeSha,
    file_count: items.length,
    generated_on: new Date().toISOString().slice(0, 10),
    items,
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const manifests = [];
for (const source of REPOSITORIES) {
  const manifest = await buildManifest(source);
  await writeFile(join(OUTPUT_DIR, source.file), JSON.stringify(manifest));
  manifests.push({
    repo: source.repo,
    label: source.label,
    file: source.file,
    file_count: manifest.file_count,
    source_commit: manifest.source_commit,
    tree_sha: manifest.tree_sha,
  });
  process.stdout.write(`Indexed ${manifest.file_count} files from ${source.repo} at ${manifest.source_commit}\n`);
}
const index = {
  schema_version: 1,
  title: 'Mirror Cartographer Source Catalog',
  generated_on: new Date().toISOString().slice(0, 10),
  source_count: manifests.length,
  file_count: manifests.reduce((sum, source) => sum + source.file_count, 0),
  generated_catalogs_excluded: [...GENERATED_FILES],
  sources: manifests,
};
await writeFile(join(OUTPUT_DIR, 'catalog-index.json'), JSON.stringify(index, null, 2) + '\n');
process.stdout.write(`Catalog complete: ${index.file_count} files across ${index.source_count} repositories.\n`);
