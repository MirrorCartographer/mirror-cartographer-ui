#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("usage: graph-catalog.mjs INPUT OUTPUT");
  process.exit(2);
}
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const digestRe = /^sha256:[0-9a-f]{64}$/;
const byDigest = new Map();
for (const object of input.objects ?? []) {
  if (!digestRe.test(object.digest)) throw new Error(`invalid digest ${object.digest}`);
  if (byDigest.has(object.digest)) throw new Error(`duplicate object ${object.digest}`);
  if (!Number.isInteger(object.size) || object.size < 0) throw new Error(`invalid size ${object.digest}`);
  byDigest.set(object.digest, object);
}
for (const object of byDigest.values()) {
  for (const child of object.references ?? []) {
    if (!byDigest.has(child)) throw new Error(`missing referenced object ${child}`);
  }
  if (object.subject && !byDigest.has(object.subject)) throw new Error(`missing subject ${object.subject}`);
}
const roots = [...new Set(input.roots ?? [])].sort();
for (const root of roots) if (!byDigest.has(root)) throw new Error(`missing root ${root}`);

const reachable = new Set();
const visit = d => {
  if (reachable.has(d)) return;
  reachable.add(d);
  const o = byDigest.get(d);
  for (const child of [...(o.references ?? [])].sort()) visit(child);
};
for (const root of roots) visit(root);
let changed = true;
while (changed) {
  changed = false;
  for (const o of byDigest.values()) {
    if (o.subject && reachable.has(o.subject) && !reachable.has(o.digest)) {
      visit(o.digest);
      changed = true;
    }
  }
}
const objects = [...reachable].sort().map(d => {
  const o = byDigest.get(d);
  return {
    digest: o.digest,
    size: o.size,
    mediaType: o.mediaType,
    artifactType: o.artifactType ?? null,
    subject: o.subject ?? null,
    references: [...(o.references ?? [])].sort()
  };
});
const canonical = {schema:"foundation.artifact.catalog.v1", roots, objects};
const bytes = JSON.stringify(canonical);
canonical.catalogDigest = "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
fs.writeFileSync(outputPath, JSON.stringify(canonical, null, 2) + "\n");
console.log(canonical.catalogDigest);
