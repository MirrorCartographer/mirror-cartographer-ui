#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const OCI_INDEX = "application/vnd.oci.image.index.v1+json";
const OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json";
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function request(url, { method = "GET", headers = {}, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, { method, headers, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    req.end();
  });
}

function pass(name, evidence = {}) { return { name, status: "pass", evidence }; }
function fail(name, reason, evidence = {}) { return { name, status: "fail", reason, evidence }; }

export async function probeRegistry({
  baseUrl,
  repository,
  digest,
  requireTls = true,
  requireReferrers = true,
  authHeader = null,
  timeoutMs = 5000,
}) {
  const base = new URL(baseUrl);
  const checks = [];

  checks.push(requireTls && base.protocol !== "https:"
    ? fail("tls", "registry URL is not HTTPS", { protocol: base.protocol })
    : pass("tls", { protocol: base.protocol }));

  checks.push(!repository || repository.startsWith("/") || repository.includes("..")
    ? fail("repository_name", "repository name is invalid")
    : pass("repository_name", { repository }));

  checks.push(!DIGEST.test(digest ?? "")
    ? fail("digest", "digest must be lowercase sha256")
    : pass("digest", { digest }));

  const headers = authHeader ? { Authorization: authHeader } : {};
  const version = await request(new URL("/v2/", base), { headers, timeoutMs });
  const versionHeader = version.headers["docker-distribution-api-version"];
  checks.push([200, 401].includes(version.status) && versionHeader === "registry/2.0"
    ? pass("distribution_v2", { status: version.status, header: versionHeader })
    : fail("distribution_v2", "missing Registry HTTP API v2 evidence", { status: version.status, header: versionHeader ?? null }));

  if (DIGEST.test(digest ?? "") && repository) {
    const manifest = await request(new URL(`/v2/${repository}/manifests/${digest}`, base), {
      method: "HEAD",
      headers: { ...headers, Accept: `${OCI_MANIFEST}, ${OCI_INDEX}` },
      timeoutMs,
    });
    const returnedDigest = manifest.headers["docker-content-digest"];
    checks.push(manifest.status === 200 && returnedDigest === digest
      ? pass("manifest_by_digest", { status: manifest.status, digest: returnedDigest })
      : fail("manifest_by_digest", "registry did not prove exact digest custody", {
          status: manifest.status, requested: digest, returned: returnedDigest ?? null,
        }));

    const ref = await request(new URL(`/v2/${repository}/referrers/${digest}`, base), {
      headers: { ...headers, Accept: OCI_INDEX },
      timeoutMs,
    });
    if (ref.status === 200 && (ref.headers["content-type"] ?? "").startsWith(OCI_INDEX)) {
      let parsed;
      try { parsed = JSON.parse(ref.body); } catch { parsed = null; }
      checks.push(parsed?.schemaVersion === 2 && Array.isArray(parsed.manifests)
        ? pass("referrers", { count: parsed.manifests.length })
        : fail("referrers", "invalid OCI index response"));
    } else if (!requireReferrers && ref.status === 404) {
      checks.push(pass("referrers", { mode: "fallback-required" }));
    } else {
      checks.push(fail("referrers", "OCI 1.1 referrers API unavailable", {
        status: ref.status, contentType: ref.headers["content-type"] ?? null,
      }));
    }
  }

  const failed = checks.filter((check) => check.status === "fail");
  return {
    schema: "fia.oci-registry-capability.v1",
    registry: base.origin,
    repository,
    digest,
    status: failed.length ? "fail" : "pass",
    checks,
  };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  }));
  if (!args.url || !args.repository || !args.digest) {
    console.error("usage: oci-registry-gate.mjs --url=https://registry.example --repository=foundation/app --digest=sha256:...");
    process.exit(2);
  }
  const report = await probeRegistry({
    baseUrl: args.url,
    repository: args.repository,
    digest: args.digest,
    requireTls: args["allow-http"] !== true,
    requireReferrers: args["allow-referrers-fallback"] !== true,
    authHeader: process.env.FIA_REGISTRY_AUTH || null,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "pass" ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "error", error: error.message }));
    process.exit(2);
  });
}
