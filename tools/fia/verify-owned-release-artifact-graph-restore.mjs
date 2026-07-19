#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GRAPH_SCHEMA = 'fia.owned-release-artifact-graph.v1';
const OUTPUT_SCHEMA = 'fia.owned-release-artifact-graph-restore.v1';
const OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json';
const GRAPH_MEDIA = 'application/vnd.fia.release-artifact-graph.v1+json';
const ARTIFACT_MEDIA = 'application/vnd.fia.artifact.v1+json';
const SHA = /^[a-f0-9]{64}$/;

function fail(message) { throw new Error(message); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function exactKeys(value, keys, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${where} must be object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join('\0') !== expected.join('\0')) fail(`${where} fields mismatch: ${actual.join(',')}`);
}
function parseDigest(value, where) {
  if (typeof value !== 'string' || !value.startsWith('sha256:') || !SHA.test(value.slice(7))) fail(`${where} invalid digest`);
  return value.slice(7);
}
async function exclusiveJson(file, object) {
  const handle = await open(file, 'wx');
  try { await handle.writeFile(`${canonical(object)}\n`); await handle.sync(); } finally { await handle.close(); }
}
async function readDescriptorBlob(layoutDir, descriptor, where) {
  exactKeys(descriptor, ['mediaType', 'digest', 'size', ...(descriptor.annotations ? ['annotations'] : [])], where);
  if (!Number.isSafeInteger(descriptor.size) || descriptor.size < 0) fail(`${where} invalid size`);
  const sha = parseDigest(descriptor.digest, where);
  const blobPath = path.join(layoutDir, 'blobs', 'sha256', sha);
  const info = await stat(blobPath).catch(() => null);
  if (!info?.isFile()) fail(`${where} blob missing`);
  const bytes = await readFile(blobPath);
  if (bytes.length !== descriptor.size || digest(bytes) !== sha) fail(`${where} descriptor mismatch`);
  return { sha, bytes, blobPath };
}
function recomputeGraph(graph) {
  exactKeys(graph, ['schema','releaseIdentity','contentIdentity','nodes','edges','rootNodeId','rollbackNodeId','policy','identity'], 'graph');
  if (graph.schema !== GRAPH_SCHEMA || !SHA.test(graph.releaseIdentity) || !SHA.test(graph.contentIdentity) || !SHA.test(graph.identity)) fail('graph identity metadata invalid');
  const withoutIdentity = { ...graph }; delete withoutIdentity.identity;
  if (digest(Buffer.from(canonical(withoutIdentity))) !== graph.identity) fail('graph identity mismatch');
  const content = {
    releaseIdentity: graph.releaseIdentity,
    nodes: graph.nodes.map(n => ({ nodeId:n.nodeId, role:n.role, schema:n.schema, identity:n.identity, artifactSha256:n.artifactSha256, artifactSize:n.artifactSize })),
    edges: graph.edges,
    rollbackNodeId: graph.rollbackNodeId
  };
  if (digest(Buffer.from(canonical(content))) !== graph.contentIdentity) fail('graph contentIdentity mismatch');
}
function validateClosure(graph) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || graph.nodes.length < 2) fail('graph nodes/edges invalid');
  const ids = new Set();
  for (const node of graph.nodes) {
    exactKeys(node, ['name','role','path','schema','identity','releaseIdentity','sha256','size','nodeId','artifactSha256','artifactSize','sourcePath'], 'graph node');
    for (const field of ['identity','releaseIdentity','sha256','nodeId','artifactSha256']) if (!SHA.test(node[field])) fail(`node ${field} invalid`);
    if (node.releaseIdentity !== graph.releaseIdentity || node.sha256 !== node.artifactSha256 || node.size !== node.artifactSize) fail('node authority mismatch');
    if (ids.has(node.nodeId)) fail('duplicate graph nodeId'); ids.add(node.nodeId);
    const expected = digest(Buffer.from(canonical({schema:node.schema,identity:node.identity,artifactSha256:node.artifactSha256,size:node.artifactSize,role:node.role,releaseIdentity:graph.releaseIdentity})));
    if (expected !== node.nodeId) fail('nodeId mismatch');
  }
  if (!ids.has(graph.rootNodeId) || !ids.has(graph.rollbackNodeId)) fail('root or rollback node missing');
  const edgeKeys = new Set(); const adj = new Map();
  for (const edge of graph.edges) {
    exactKeys(edge, ['from','to','type'], 'graph edge');
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) fail('invalid graph edge');
    const key = canonical(edge); if (edgeKeys.has(key)) fail('duplicate graph edge'); edgeKeys.add(key);
    if (!adj.has(edge.from)) adj.set(edge.from, []); adj.get(edge.from).push(edge.to);
  }
  const seen = new Set([graph.rootNodeId]), queue = [graph.rootNodeId];
  while (queue.length) for (const target of adj.get(queue.shift()) || []) if (!seen.has(target)) { seen.add(target); queue.push(target); }
  if (seen.size !== ids.size) fail('restored graph is not fully reachable');
  if (!graph.edges.some(e => e.type === 'rolls-back-to' && e.to === graph.rollbackNodeId)) fail('rollback lineage missing');
}

async function main() {
  const pairs = process.argv.slice(2).reduce((out, item, index, all) => item.startsWith('--') ? (out.push([item.slice(2), all[index + 1]]), out) : out, []);
  const args = Object.fromEntries(pairs);
  for (const key of ['layoutDir','restoreDir','output']) if (!args[key]) fail(`missing --${key}`);
  if (await stat(args.restoreDir).then(() => true, () => false)) fail('restoreDir already exists');
  if (await stat(args.output).then(() => true, () => false)) fail('output already exists');

  const layoutDir = path.resolve(args.layoutDir);
  const layout = JSON.parse(await readFile(path.join(layoutDir, 'oci-layout')));
  exactKeys(layout, ['imageLayoutVersion'], 'oci-layout');
  if (layout.imageLayoutVersion !== '1.0.0') fail('unsupported OCI layout version');
  const indexBytes = await readFile(path.join(layoutDir, 'index.json')); const index = JSON.parse(indexBytes);
  exactKeys(index, ['schemaVersion','manifests'], 'index');
  if (index.schemaVersion !== 2 || !Array.isArray(index.manifests) || index.manifests.length !== 1) fail('index must contain exactly one manifest');
  const manifestDescriptor = index.manifests[0];
  const { bytes: manifestBytes, sha: manifestSha } = await readDescriptorBlob(layoutDir, manifestDescriptor, 'manifest descriptor');
  if (manifestDescriptor.mediaType !== OCI_MANIFEST) fail('manifest mediaType mismatch');
  const manifest = JSON.parse(manifestBytes);
  exactKeys(manifest, ['schemaVersion','mediaType','config','layers'], 'manifest');
  if (manifest.schemaVersion !== 2 || manifest.mediaType !== OCI_MANIFEST || !Array.isArray(manifest.layers)) fail('manifest invalid');
  const config = await readDescriptorBlob(layoutDir, manifest.config, 'graph descriptor');
  if (manifest.config.mediaType !== GRAPH_MEDIA) fail('graph mediaType mismatch');
  const graph = JSON.parse(config.bytes); recomputeGraph(graph); validateClosure(graph);
  if (manifestDescriptor.annotations?.['fia.graph.identity'] !== graph.identity || manifestDescriptor.annotations?.['org.opencontainers.image.ref.name'] !== graph.releaseIdentity) fail('index graph annotations mismatch');

  const layerByDigest = new Map();
  for (let i = 0; i < manifest.layers.length; i++) {
    const descriptor = manifest.layers[i];
    if (descriptor.mediaType !== ARTIFACT_MEDIA) fail(`layer ${i} mediaType mismatch`);
    const layer = await readDescriptorBlob(layoutDir, descriptor, `layer ${i}`);
    if (layerByDigest.has(layer.sha)) fail('duplicate layer descriptor');
    layerByDigest.set(layer.sha, { descriptor, ...layer });
  }
  if (layerByDigest.size !== graph.nodes.length) fail('layer count does not match graph nodes');
  for (const node of graph.nodes) {
    const layer = layerByDigest.get(node.artifactSha256);
    if (!layer || layer.bytes.length !== node.artifactSize) fail(`missing artifact blob for ${node.name}`);
    const parsed = JSON.parse(layer.bytes);
    if (parsed.schema !== node.schema || parsed.identity !== node.identity) fail(`artifact evidence mismatch for ${node.name}`);
    if (parsed.releaseIdentity !== undefined && parsed.releaseIdentity !== graph.releaseIdentity) fail(`cross-release artifact ${node.name}`);
    if (layer.descriptor.annotations?.['fia.node.id'] !== node.nodeId || layer.descriptor.annotations?.['fia.role'] !== node.role || layer.descriptor.annotations?.['org.opencontainers.image.title'] !== node.name) fail(`layer annotations mismatch for ${node.name}`);
  }

  const blobDir = path.join(layoutDir, 'blobs', 'sha256');
  const present = (await readdir(blobDir)).sort();
  const expected = new Set([manifestSha, config.sha, ...graph.nodes.map(n => n.artifactSha256)]);
  for (const name of present) if (!SHA.test(name) || !expected.has(name)) fail(`unreferenced or invalid blob ${name}`);
  if (present.length !== expected.size) fail('blob closure mismatch');

  const stage = `${args.restoreDir}.staging-${process.pid}`; await rm(stage, { recursive:true, force:true });
  try {
    await mkdir(path.join(stage, 'evidence'), { recursive:true });
    for (const node of graph.nodes) await writeFile(path.join(stage, 'evidence', `${node.nodeId}.json`), layerByDigest.get(node.artifactSha256).bytes, { flag:'wx' });
    await writeFile(path.join(stage, 'graph.json'), config.bytes, { flag:'wx' });
    await writeFile(path.join(stage, 'index.json'), indexBytes, { flag:'wx' });
    await rename(stage, args.restoreDir);
  } catch (error) { await rm(stage, { recursive:true, force:true }); throw error; }

  const result = {
    schema: OUTPUT_SCHEMA,
    releaseIdentity: graph.releaseIdentity,
    graphIdentity: graph.identity,
    contentIdentity: graph.contentIdentity,
    manifestDigest: `sha256:${manifestSha}`,
    graphDigest: `sha256:${config.sha}`,
    restoredNodes: graph.nodes.map(n => ({ nodeId:n.nodeId, artifactSha256:n.artifactSha256, artifactSize:n.artifactSize, role:n.role })).sort((a,b) => a.nodeId.localeCompare(b.nodeId)),
    policy: { registryRequired:false, exactDescriptorBytes:true, completeBlobClosure:true, unreferencedBlobsRejected:true, rollbackLineageVerified:true }
  };
  result.identity = digest(Buffer.from(canonical(result)));
  await exclusiveJson(args.output, result);
  process.stdout.write(`${JSON.stringify({schema:OUTPUT_SCHEMA,identity:result.identity,nodes:result.restoredNodes.length})}\n`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
