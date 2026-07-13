const SHA40 = /^[0-9a-f]{40}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertSha(value, name) {
  if (!SHA40.test(value ?? '')) throw new Error(`invalid ${name}`);
}

function assertTimestamp(value, name) {
  if (!ISO_UTC.test(value ?? '') || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be an ISO UTC timestamp`);
  }
}

function assertSafeRelativePath(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} missing`);
  if (value.startsWith('/') || value.includes('\\')) throw new Error(`${name} must be repository-relative`);
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${name} must be normalized`);
  }
}

function normalizeLookup(lookup, expectedMethod, name, targetCommit) {
  assertObject(lookup, name);
  if (lookup.verification_method !== expectedMethod) throw new Error(`${name} verification method mismatch`);
  assertSafeRelativePath(lookup.path, `${name} path`);
  assertSha(lookup.blob_sha, `${name} blob sha`);
  assertSha(lookup.target_commit, `${name} target commit`);
  if (lookup.target_commit !== targetCommit) throw new Error(`${name} target commit mismatch`);
  assertTimestamp(lookup.verified_at, `${name} verified_at`);
  return lookup;
}

export function reconcileExactCommitSourceBinding({
  target_commit,
  github_contents_lookup,
  git_ls_tree_lookup
}) {
  assertSha(target_commit, 'target commit');
  const contents = normalizeLookup(
    github_contents_lookup,
    'github-contents-at-commit',
    'github contents lookup',
    target_commit
  );
  const tree = normalizeLookup(
    git_ls_tree_lookup,
    'git-ls-tree-at-commit',
    'git ls-tree lookup',
    target_commit
  );

  if (contents.path !== tree.path) throw new Error('source lookup path mismatch');
  if (contents.blob_sha !== tree.blob_sha) throw new Error('source lookup blob sha mismatch');

  const verifiedAt = new Date(Math.max(Date.parse(contents.verified_at), Date.parse(tree.verified_at))).toISOString();
  return Object.freeze({
    path: contents.path,
    blob_sha: contents.blob_sha,
    target_commit,
    verification_method: 'reconciled-independent-exact-commit-lookups',
    verified_at: verifiedAt,
    independent_methods: Object.freeze([
      'github-contents-at-commit',
      'git-ls-tree-at-commit'
    ]),
    agreement_verified: true,
    application_deployment_attempted: false,
    deployment_claim_permitted: false
  });
}
