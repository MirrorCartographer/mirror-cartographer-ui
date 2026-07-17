#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = data => createHash("sha256").update(data).digest("hex");
const utf8 = new TextDecoder("utf-8", { fatal: true });
const TEXT_EXTENSIONS = new Set([".c", ".cc", ".css", ".csv", ".go", ".h", ".html", ".ini", ".java", ".js", ".json", ".jsx", ".md", ".mjs", ".py", ".rs", ".sh", ".sql", ".svg", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml"]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/
];

const ext = path => {
  const i = path.lastIndexOf(".");
  return i < 0 ? "" : path.slice(i).toLowerCase();
};

function canonicalPath(path) {
  if (path.includes("\0") || path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`unsafe path: ${path}`);
  }
  const normalized = path.normalize("NFC");
  if (Buffer.byteLength(normalized) > 1024) throw new Error(`path too long: ${path}`);
  return normalized;
}

function canonicalMode(path, mode) {
  const executable = (mode & 0o111) !== 0;
  if (!executable) return "0644";
  if (!(path.startsWith("scripts/") || path.startsWith("bin/"))) {
    throw new Error(`executable outside allowlist: ${path}`);
  }
  return "0755";
}

function normalizeText(bytes, path) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error(`UTF-8 BOM rejected: ${path}`);
  }
  const text = utf8.decode(bytes);
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) throw new Error(`secret-like material rejected: ${path}`);
  }
  return Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
}

export async function normalizeTree(rootPath, limits = { maxFiles: 10000, maxFileBytes: 10485760, maxTotalBytes: 104857600 }) {
  const root = resolve(rootPath);
  const entries = [];
  const names = new Map();
  let files = 0;
  let total = 0;

  async function walk(dir) {
    const children = await readdir(dir, { withFileTypes: true });
    for (const child of children) {
      const absolute = resolve(dir, child.name);
      const rawRelative = relative(root, absolute).split(sep).join("/");
      const path = canonicalPath(rawRelative);
      if (!path || path.startsWith("../")) throw new Error(`path escaped root: ${rawRelative}`);
      const collision = path.toLocaleLowerCase("en-US");
      if (names.has(collision) && names.get(collision) !== path) {
        throw new Error(`case or Unicode path collision: ${names.get(collision)} <> ${path}`);
      }
      names.set(collision, path);
      const st = await lstat(absolute);
      if (st.isSymbolicLink()) throw new Error(`symlink rejected: ${path}`);
      if (st.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!st.isFile()) throw new Error(`special file rejected: ${path}`);
      files += 1;
      total += st.size;
      if (files > limits.maxFiles) throw new Error("file-count limit exceeded");
      if (st.size > limits.maxFileBytes) throw new Error(`file-size limit exceeded: ${path}`);
      if (total > limits.maxTotalBytes) throw new Error("total-size limit exceeded");
      const original = await readFile(absolute);
      const bytes = TEXT_EXTENSIONS.has(ext(path)) ? normalizeText(original, path) : original;
      entries.push({ path, type: "file", mode: canonicalMode(path, st.mode), size: bytes.length, digest: `sha256:${sha256(bytes)}` });
    }
  }

  await walk(root);
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const manifestCore = { version: 1, algorithm: "sha256", entries };
  const serialized = Buffer.from(JSON.stringify(manifestCore) + "\n", "utf8");
  return { ...manifestCore, manifest_digest: `sha256:${sha256(serialized)}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node reader.mjs <directory>");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await normalizeTree(target), null, 2));
  } catch (error) {
    console.error(`REJECT ${error.message}`);
    process.exit(1);
  }
}
