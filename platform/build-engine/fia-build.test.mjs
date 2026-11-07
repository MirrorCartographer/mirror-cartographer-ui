import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "./fia-build.mjs";

async function fixture(html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>MC</title></head><body><img alt="" src="x.png"></body></html>') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fia-build-"));
  const input = path.join(root, "dist");
  await fs.mkdir(input);
  await fs.writeFile(path.join(input, "index.html"), html);
  await fs.writeFile(path.join(input, "x.png"), Buffer.from([1, 2, 3]));
  return { root, input, output: path.join(root, "release") };
}

test("equivalent clean inputs produce identical release identity", async () => {
  const a = await fixture();
  const b = await fixture();
  const ma = await build({ input: a.input, output: a.output, sourceIdentity: "git:test" });
  const mb = await build({ input: b.input, output: b.output, sourceIdentity: "git:test" });
  assert.equal(ma.releaseIdentity, mb.releaseIdentity);
  assert.equal(JSON.parse(await fs.readFile(path.join(a.output, "manifest.json"), "utf8")).releaseIdentity, ma.releaseIdentity);
});

test("source byte mutation changes identity", async () => {
  const a = await fixture();
  const b = await fixture();
  await fs.appendFile(path.join(b.input, "index.html"), "<!--changed-->");
  const ma = await build({ input: a.input, output: a.output, sourceIdentity: "git:test" });
  const mb = await build({ input: b.input, output: b.output, sourceIdentity: "git:test" });
  assert.notEqual(ma.releaseIdentity, mb.releaseIdentity);
});

test("accessibility and autoplay gates fail closed", async () => {
  for (const html of [
    "<html><head><title>x</title></head><body></body></html>",
    '<!doctype html><html lang="en"><head><meta name="viewport" content="x"><title>x</title></head><body><video autoplay></video></body></html>',
  ]) {
    const f = await fixture(html);
    await assert.rejects(build({ input: f.input, output: f.output }));
    await assert.rejects(fs.access(f.output));
  }
});

test("symlinks and existing output are rejected", async () => {
  const f = await fixture();
  await fs.symlink(path.join(f.input, "index.html"), path.join(f.input, "alias.html"));
  await assert.rejects(build({ input: f.input, output: f.output }));
  const g = await fixture();
  await fs.mkdir(g.output);
  await fs.writeFile(path.join(g.output, "sentinel"), "keep");
  await assert.rejects(build({ input: g.input, output: g.output }));
  assert.equal(await fs.readFile(path.join(g.output, "sentinel"), "utf8"), "keep");
});

test("root route is mandatory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fia-build-"));
  const input = path.join(root, "dist");
  await fs.mkdir(input);
  await fs.writeFile(path.join(input, "about.html"), '<!doctype html><html lang="en"><head><meta name="viewport" content="x"><title>x</title></head><body></body></html>');
  await assert.rejects(build({ input, output: path.join(root, "out") }), /missing root route/);
});
