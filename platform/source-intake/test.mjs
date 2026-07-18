#!/usr/bin/env node
import { mkdtemp, mkdir, writeFile, symlink, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeTree } from "./reader.mjs";
import { spawnSync } from "node:child_process";

const base = spawnSync(process.execPath, [new URL("./verify-source-intake-contract.mjs", import.meta.url).pathname], { encoding: "utf8" });
if (base.status !== 0) throw new Error(base.stderr || base.stdout);
console.log("PASS baseline contract");

async function fixture() {
  const d = await mkdtemp(join(tmpdir(), "foundation-reader-"));
  await mkdir(join(d, "src"), { recursive: true });
  await mkdir(join(d, "scripts"), { recursive: true });
  await writeFile(join(d, "src", "hello.txt"), "hello\r\nworld\r\n");
  await writeFile(join(d, "src", "unicode.txt"), Buffer.from("\uFEFFcafe\u0301\rline", "utf8"));
  await writeFile(join(d, "src", "blob.bin"), Buffer.from([0, 255, 1, 2]));
  await writeFile(join(d, "scripts", "build.sh"), "#!/bin/sh\r\necho ok\r\n");
  await chmod(join(d, "scripts", "build.sh"), 0o755);
  return d;
}

const a = await fixture();
const b = await fixture();
try {
  const ma = await normalizeTree(a);
  const mb = await normalizeTree(b);
  if (JSON.stringify(ma) !== JSON.stringify(mb)) throw new Error("determinism failure");
  if (ma.schema !== "foundation.reader.manifest.v2") throw new Error("manifest schema failure");
  if (ma.authority.raw_source_bytes !== "canonical" || ma.authority.reader_projection !== "derived" || ma.authority.projection_may_replace_build_input) throw new Error("authority split failure");
  const text = ma.entries.find(x => x.path === "src/hello.txt");
  if (!text || text.raw_digest === text.projection_digest || text.projection_size !== 12) throw new Error("CRLF projection failure");
  const unicode = ma.entries.find(x => x.path === "src/unicode.txt");
  if (!unicode?.utf8_bom || !unicode.unicode_changed || !unicode.line_endings_changed) throw new Error("Unicode/BOM projection evidence failure");
  const binary = ma.entries.find(x => x.path === "src/blob.bin");
  if (!binary?.opaque || binary.raw_digest !== binary.projection_digest) throw new Error("binary preservation failure");
  console.log("PASS deterministic raw and derived Reader trees");
  console.log("PASS raw source remains canonical");
  console.log("PASS Unicode NFC, BOM, and line-ending evidence");
  console.log("PASS byte-exact opaque binary identity");
} finally {
  await rm(a, { recursive: true, force: true });
  await rm(b, { recursive: true, force: true });
}

async function reject(name, mutate, pattern, limits) {
  const d = await fixture();
  try {
    await mutate(d);
    let failed = false;
    try { await normalizeTree(d, limits); }
    catch (error) { failed = pattern.test(error.message); }
    if (!failed) throw new Error(`expected rejection: ${name}`);
    console.log(`PASS reject-${name}`);
  } finally { await rm(d, { recursive: true, force: true }); }
}

await reject("symlink", async d => symlink("../src/hello.txt", join(d, "scripts", "link")), /symlink/);
await reject("secret", async d => writeFile(join(d, "src", "key.txt"), "-----BEGIN PRIVATE KEY-----\nabc"), /secret-like/);
await reject("executable-outside-allowlist", async d => chmod(join(d, "src", "hello.txt"), 0o755), /executable outside/);
await reject("case-collision", async d => writeFile(join(d, "src", "HELLO.TXT"), "other"), /collision/);
await reject("unicode-collision", async d => { await writeFile(join(d, "src", "é.txt"), "a"); await writeFile(join(d, "src", "e\u0301.txt"), "b"); }, /Unicode path collision/);
await reject("reserved-name", async d => writeFile(join(d, "src", "CON.txt"), "x"), /reserved portable name/);
await reject("invalid-utf8-text", async d => writeFile(join(d, "src", "bad.js"), Buffer.from([0xff, 0xfe])), /valid UTF-8/);
await reject("oversized-file", async d => writeFile(join(d, "src", "huge.bin"), Buffer.alloc(1024)), /file-size/, { maxFiles: 100, maxFileBytes: 100, maxTotalBytes: 10000 });

console.log("PASS adversarial source-intake and Reader controls");
