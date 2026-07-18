#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const [graphPath, fixturePath, evidencePath] = process.argv.slice(2);
if (!graphPath || !fixturePath || !evidencePath) {
  console.error("usage: execute-build-graph.mjs GRAPH FIXTURE EVIDENCE");
  process.exit(2);
}
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const fixture = path.resolve(fixturePath);
const work = fs.mkdtempSync(path.join(os.tmpdir(), "foundation-build-"));
const hash = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const copy = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};
const outputDigests = {};
const actions = [];

try {
  for (const entry of fs.readdirSync(fixture, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const parent = entry.parentPath ?? entry.path;
    const relative = path.relative(fixture, path.join(parent, entry.name));
    copy(path.join(fixture, relative), path.join(work, relative));
  }

  const remaining = new Map(graph.actions.map(action => [action.id, action]));
  const done = new Set();
  while (remaining.size) {
    const ready = [...remaining.values()]
      .filter(action => action.deps.every(dependency => done.has(dependency)))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!ready.length) throw new Error("cycle or unavailable dependency");

    for (const action of ready) {
      if (action.network !== false) throw new Error(`network enabled: ${action.id}`);
      const inputDigests = [];
      for (const input of action.inputs) {
        const file = path.join(work, input.path);
        if (!fs.existsSync(file)) throw new Error(`missing input ${input.path}`);
        const actual = hash(fs.readFileSync(file));
        if (input.digest && actual !== input.digest) throw new Error(`input digest mismatch ${input.path}: ${actual}`);
        inputDigests.push({ path: input.path, digest: actual });
      }

      const actionKey = hash(Buffer.from(JSON.stringify({
        command: action.command,
        env: action.env,
        inputs: inputDigests,
        outputs: action.outputs,
        toolchain: graph.toolchains[action.toolchain].digest,
        source: graph.source_digest,
        policy: graph.policy_digest
      })));

      const before = new Set(fs.readdirSync(work, { recursive: true }).filter(item => fs.statSync(path.join(work, item)).isFile()));
      const cleanEnvironment = {
        PATH: process.env.PATH ?? "",
        HOME: work,
        TMPDIR: path.join(work, "tmp"),
        ...action.env
      };
      fs.mkdirSync(cleanEnvironment.TMPDIR, { recursive: true });
      const result = spawnSync(process.execPath, action.command, {
        cwd: work,
        env: cleanEnvironment,
        encoding: "utf8",
        timeout: action.timeout_seconds * 1000
      });
      if (result.status !== 0) throw new Error(`action failed ${action.id}: ${result.stderr}`);

      const after = new Set(fs.readdirSync(work, { recursive: true }).filter(item => fs.statSync(path.join(work, item)).isFile()));
      const created = [...after].filter(item => !before.has(item) && !item.startsWith("tmp/")).sort();
      const allowed = new Set(action.outputs);
      const undeclared = created.filter(item => !allowed.has(item));
      if (undeclared.length) throw new Error(`undeclared outputs from ${action.id}: ${undeclared.join(",")}`);

      const outputs = [];
      for (const relative of action.outputs) {
        const file = path.join(work, relative);
        if (!fs.existsSync(file)) throw new Error(`missing declared output ${relative}`);
        const actual = hash(fs.readFileSync(file));
        outputDigests[relative] = actual;
        outputs.push({ path: relative, digest: actual });
      }
      actions.push({
        id: action.id,
        action_key: actionKey,
        inputs: inputDigests,
        outputs,
        stdout_digest: hash(Buffer.from(result.stdout ?? "")),
        stderr_digest: hash(Buffer.from(result.stderr ?? ""))
      });
      done.add(action.id);
      remaining.delete(action.id);
    }
  }

  const evidence = {
    schema_version: 1,
    graph_digest: hash(fs.readFileSync(graphPath)),
    source_digest: graph.source_digest,
    actions,
    final_outputs: outputDigests
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  console.log(evidence.final_outputs["dist/artifact.json"]);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
