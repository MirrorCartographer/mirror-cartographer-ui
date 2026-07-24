#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const SCHEMA = "foundation.build.release.v1";
const POLICY = Object.freeze({
  providerNeutral: true,
  rejectSymlinks: true,
  requireRootRoute: true,
  requireHtmlLang: true,
  requireTitle: true,
  requireViewport: true,
  rejectAutoplay: true,
});

function sha256(data) {
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function safeRel(rel) {
  const n = rel.normalize("NFC").replaceAll(path.sep, "/");
  if (!n || n.startsWith("/") || n.includes("\\") || n.split("/").some(s => !s || s === "." || s === ".." || s.includes("\0"))) {
    throw new Error(`unsafe path: ${rel}`);
  }
  return n;
}
async function walk(root) {
  const out = [];
  const seen = new Set();
  async function visit(dir) {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = safeRel(path.relative(root, abs));
      const folded = rel.toLocaleLowerCase("en-US");
      if (seen.has(folded)) throw new Error(`case-fold collision: ${rel}`);
      seen.add(folded);
      if (e.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
      if (e.isDirectory()) {
        await visit(abs);
        continue;
      }
      if (!e.isFile()) throw new Error(`unsupported filesystem object: ${rel}`);
      out.push({ path: rel, bytes: await fs.readFile(abs) });
    }
  }
  await visit(root);
  return out;
}
function mime(p) {
  const ext = path.extname(p).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
  })[ext] || "application/octet-stream";
}
function routeFor(p) {
  if (p === "index.html") return "/";
  if (p.endsWith("/index.html")) return `/${p.slice(0, -11)}`;
  if (p.endsWith(".html")) return `/${p.slice(0, -5)}`;
  return null;
}
function validateHtml(p, text) {
  const failures = [];
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(text)) failures.push("missing html lang");
  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(text)) failures.push("missing title");
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i.test(text)) failures.push("missing viewport");
  if (/<(?:audio|video)\b[^>]*\bautoplay\b/i.test(text)) failures.push("autoplay forbidden");
  for (const tag of text.match(/<img\b[^>]*>/gi) || []) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(tag)) failures.push("image missing alt");
  }
  if (failures.length) throw new Error(`${p}: ${[...new Set(failures)].join(", ")}`);
}

export async function build({ input, output, sourceIdentity = "unversioned" }) {
  const inRoot = path.resolve(input);
  const outRoot = path.resolve(output);
  await fs.access(inRoot);
  try {
    await fs.access(outRoot);
    throw new Error(`output exists: ${outRoot}`);
  } catch (error) {
    if (error.code !== "ENOENT" && !String(error.message).startsWith("output exists")) throw error;
    if (String(error.message).startsWith("output exists")) throw error;
  }
  const files = await walk(inRoot);
  if (!files.length) throw new Error("input is empty");
  const stage = `${outRoot}.tmp-${process.pid}`;
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(path.join(stage, "objects", "sha256"), { recursive: true });
  const manifestFiles = [];
  const routes = [];
  try {
    for (const f of files) {
      if (f.path.endsWith(".html")) validateHtml(f.path, f.bytes.toString("utf8"));
      const digest = sha256(f.bytes);
      const objectPath = path.join(stage, "objects", "sha256", digest.slice(7));
      try {
        await fs.writeFile(objectPath, f.bytes, { flag: "wx", mode: 0o444 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      manifestFiles.push({ path: f.path, sha256: digest, size: f.bytes.length, mediaType: mime(f.path) });
      const route = routeFor(f.path);
      if (route) routes.push({ route, file: f.path });
    }
    manifestFiles.sort((a, b) => a.path.localeCompare(b.path, "en"));
    routes.sort((a, b) => a.route.localeCompare(b.route, "en"));
    if (!routes.some(r => r.route === "/")) throw new Error("missing root route index.html");
    const authority = { schema: SCHEMA, sourceIdentity, files: manifestFiles, routes, policy: POLICY };
    const releaseIdentity = sha256(Buffer.from(canonical(authority)));
    const manifest = { ...authority, releaseIdentity };
    const artifacts = {
      "manifest.json": manifest,
      "routes.json": { schema: "foundation.build.routes.v1", releaseIdentity, routes },
      "sbom.json": { schema: "foundation.build.sbom.v1", releaseIdentity, components: manifestFiles.map(f => ({ name: f.path, hashes: [f.sha256], size: f.size, mediaType: f.mediaType })) },
      "provenance.json": { schema: "foundation.build.provenance.v1", releaseIdentity, sourceIdentity, builder: "fia-build", policy: POLICY },
      "rollback.json": { schema: "foundation.build.rollback.v1", releaseIdentity, restore: { kind: "content-addressed-release", manifest: "manifest.json" } },
    };
    for (const [name, artifact] of Object.entries(artifacts)) {
      await fs.writeFile(path.join(stage, name), `${canonical(artifact)}\n`, { flag: "wx", mode: 0o444 });
    }
    await fs.rename(stage, outRoot);
    return manifest;
  } catch (error) {
    await fs.rm(stage, { recursive: true, force: true });
    throw error;
  }
}

async function cli() {
  const args = process.argv.slice(2);
  const get = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const input = get("--input");
  const output = get("--output");
  const sourceIdentity = get("--sourceIdentity") || "unversioned";
  if (!input || !output) throw new Error("usage: fia-build --input <dir> --output <dir> [--sourceIdentity <id>]");
  const result = await build({ input, output, sourceIdentity });
  process.stdout.write(`${result.releaseIdentity}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
