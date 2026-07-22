#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { probeRegistry } from "./oci-registry-gate.mjs";

const digest = "sha256:" + "a".repeat(64);

async function withRegistry(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function goodHandler(req, res) {
  res.setHeader("Docker-Distribution-Api-Version", "registry/2.0");
  if (req.url === "/v2/") { res.writeHead(200); return res.end(); }
  if (req.method === "HEAD" && req.url === `/v2/foundation/app/manifests/${digest}`) {
    res.setHeader("Docker-Content-Digest", digest);
    res.writeHead(200); return res.end();
  }
  if (req.url === `/v2/foundation/app/referrers/${digest}`) {
    res.setHeader("Content-Type", "application/vnd.oci.image.index.v1+json");
    res.writeHead(200);
    return res.end(JSON.stringify({ schemaVersion: 2, mediaType: "application/vnd.oci.image.index.v1+json", manifests: [] }));
  }
  res.writeHead(404); res.end();
}

test("accepts exact digest custody plus OCI 1.1 discovery", async () => {
  await withRegistry(goodHandler, async (url) => {
    const report = await probeRegistry({ baseUrl: url, repository: "foundation/app", digest, requireTls: false });
    assert.equal(report.status, "pass");
  });
});

test("fails when registry returns a different digest", async () => {
  await withRegistry((req, res) => {
    if (req.url === "/v2/") {
      res.setHeader("Docker-Distribution-Api-Version", "registry/2.0");
      res.writeHead(200); return res.end();
    }
    if (req.method === "HEAD") {
      res.setHeader("Docker-Content-Digest", "sha256:" + "b".repeat(64));
      res.writeHead(200); return res.end();
    }
    res.writeHead(404); res.end();
  }, async (url) => {
    const report = await probeRegistry({ baseUrl: url, repository: "foundation/app", digest, requireTls: false });
    assert.equal(report.status, "fail");
    assert.equal(report.checks.find(c => c.name === "manifest_by_digest").status, "fail");
  });
});

test("fails closed when referrers are unavailable", async () => {
  await withRegistry((req, res) => {
    res.setHeader("Docker-Distribution-Api-Version", "registry/2.0");
    if (req.url === "/v2/") { res.writeHead(200); return res.end(); }
    if (req.method === "HEAD") {
      res.setHeader("Docker-Content-Digest", digest);
      res.writeHead(200); return res.end();
    }
    res.writeHead(404); res.end();
  }, async (url) => {
    const report = await probeRegistry({ baseUrl: url, repository: "foundation/app", digest, requireTls: false });
    assert.equal(report.status, "fail");
  });
});

test("rejects insecure transport when TLS is required", async () => {
  await withRegistry(goodHandler, async (url) => {
    const report = await probeRegistry({ baseUrl: url, repository: "foundation/app", digest, requireTls: true });
    assert.equal(report.status, "fail");
    assert.equal(report.checks.find(c => c.name === "tls").status, "fail");
  });
});

test("accepts explicit referrers fallback mode but reports it", async () => {
  await withRegistry((req, res) => {
    res.setHeader("Docker-Distribution-Api-Version", "registry/2.0");
    if (req.url === "/v2/") { res.writeHead(200); return res.end(); }
    if (req.method === "HEAD") {
      res.setHeader("Docker-Content-Digest", digest);
      res.writeHead(200); return res.end();
    }
    res.writeHead(404); res.end();
  }, async (url) => {
    const report = await probeRegistry({
      baseUrl: url, repository: "foundation/app", digest, requireTls: false, requireReferrers: false
    });
    assert.equal(report.status, "pass");
    assert.equal(report.checks.find(c => c.name === "referrers").evidence.mode, "fallback-required");
  });
});
