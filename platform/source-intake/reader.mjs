#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = data => `sha256:${createHash("sha256").update(data).digest("hex")}`;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const TEXT_EXTENSIONS = new Set([".c", ".cc", ".css", ".csv", ".go", ".h", ".html", ".ini", ".java", ".js", ".json", ".jsx", ".md", ".mjs", ".py", ".rs", ".sh", ".sql", ".svg", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml"]);
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const secretPatterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/];
const ext = value => value.includes(".") ? value.slice(value.lastIndexOf(".")).toLowerCase() : "";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function canonicalPath(value) {
  if (value.includes("\0") || value.includes("\\") || value.startsWith("/")) throw new Error(`unsafe path: ${value}`);
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error(`unsafe path: ${value}`);
  for (const part of parts) {
    if (/[\u0000-\u001f\u007f]/u.test(part)) throw new Error(`control character in path: ${value}`);
    if (/[. ]$/u.test(part)) throw new Error(`trailing dot or space: ${value}`);
    if (WINDOWS_RESERVED.test(part)) throw new Error(`reserved portable name: ${value}`);
  }
  const normalized = value.normalize("NFC");
  if (Buffer.byteLength(normalized) > 1024) throw new Error(`path too long: ${value}`);
  return normalized;
}

function canonicalMode(value, mode) {
  const executable = (mode & 0o111) !== 0;
  if (!executable) return "0644";
  if (!(value.startsWith("scripts/") || value.startsWith("bin/"))) throw new Error(`executable outside allowlist: ${value}`);
  return "0755";
}

function projectText(bytes, value) {
  const decoded = utf8.decode(bytes);
  for (const pattern of secretPatterns) if (pattern.test(decoded)) throw new Error(`secret-like material rejected: ${value}`);
  const hadBom = decoded.startsWith("\uFEFF");
  const source = hadBom ? decoded.slice(1) : decoded;
  const normalized = source.replace(/\r\n?/gu, "\n").normalize("NFC");
  return {
    bytes: Buffer.from(normalized, "utf8"),
    had_bom: hadBom,
    line_endings_changed: /\r/u.test(source),
    unicode_changed: source.replace(/\r\n?/gu, "\n") !== normalized,
    line_map: normalized.split("\n").map((_, index) => ({ normalized_line: index + 1, source_line: index + 1 }))
  };
}

export async function normalizeTree(rootPath, limits = { maxFiles: 10000, maxFileBytes: 10485760, maxTotalBytes: 104857600 }) {
  const root = resolve(rootPath);
  const entries = [];
  const seenNfc = new Map();
  const seenFold = new Map();
  let files = 0;
  let total = 0;

  async function walk(dir) {
    const children = await readdir(dir, { withFileTypes: true });
    children.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
    for (const child of children) {
      const absolute = resolve(dir, child.name);
      const rawRelative = relative(root, absolute).split(sep).join("/");
      const canonical = canonicalPath(rawRelative);
      const priorNfc = seenNfc.get(canonical);
      if (priorNfc && priorNfc !== rawRelative) throw new Error(`Unicode path collision: ${priorNfc} <> ${rawRelative}`);
      const folded = canonical.toLocaleLowerCase("und");
      const priorFold = seenFold.get(folded);
      if (priorFold && priorFold !== canonical) throw new Error(`case or Unicode path collision: ${priorFold} <> ${canonical}`);
      seenNfc.set(canonical, rawRelative);
      seenFold.set(folded, canonical);

      const st = await lstat(absolute);
      if (st.isSymbolicLink()) throw new Error(`symlink rejected: ${canonical}`);
      if (st.isDirectory()) { await walk(absolute); continue; }
      if (!st.isFile()) throw new Error(`special file rejected: ${canonical}`);
      if (st.nlink > 1) throw new Error(`hardlink rejected: ${canonical}`);
      files += 1;
      total += st.size;
      if (files > limits.maxFiles) throw new Error("file-count limit exceeded");
      if (st.size > limits.maxFileBytes) throw new Error(`file-size limit exceeded: ${canonical}`);
      if (total > limits.maxTotalBytes) throw new Error("total-size limit exceeded");

      const raw = await readFile(absolute);
      const rawDigest = sha256(raw);
      const mode = canonicalMode(canonical, st.mode);
      if (!TEXT_EXTENSIONS.has(ext(canonical))) {
        entries.push({ schema: "foundation.reader.file.v1", path: canonical, type: "file", kind: "binary", mode, size: raw.length, raw_digest: rawDigest, projection_digest: rawDigest, opaque: true });
        continue;
      }
      let projection;
      try { projection = projectText(raw, canonical); }
      catch (error) { if (error instanceof TypeError) throw new Error(`declared text is not valid UTF-8: ${canonical}`); throw error; }
      entries.push({
        schema: "foundation.reader.file.v1",
        path: canonical,
        type: "file",
        kind: "text",
        mode,
        size: raw.length,
        raw_digest: rawDigest,
        projection_size: projection.bytes.length,
        projection_digest: sha256(projection.bytes),
        utf8_bom: projection.had_bom,
        line_endings_changed: projection.line_endings_changed,
        unicode_changed: projection.unicode_changed,
        line_map: projection.line_map
      });
    }
  }

  await walk(root);
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const rawMaterial = entries.map(entry => `${entry.path}\0${entry.raw_digest}\0${entry.mode}\n`).join("");
  const projectionMaterial = entries.map(entry => `${entry.path}\0${entry.projection_digest}\0${entry.mode}\n`).join("");
  const core = {
    schema: "foundation.reader.manifest.v2",
    authority: { raw_source_bytes: "canonical", reader_projection: "derived", projection_may_replace_build_input: false },
    files,
    total_raw_bytes: total,
    raw_tree_digest: sha256(Buffer.from(rawMaterial)),
    reader_tree_digest: sha256(Buffer.from(projectionMaterial)),
    entries
  };
  return { ...core, manifest_digest: sha256(Buffer.from(`${stable(core)}\n`, "utf8")) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  if (!target) { console.error("usage: node reader.mjs <directory>"); process.exit(2); }
  try { console.log(`${stable(await normalizeTree(target))}\n`); }
  catch (error) { console.error(`REJECT ${error.message}`); process.exit(1); }
}
