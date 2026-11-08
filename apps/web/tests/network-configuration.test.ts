import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { Agent } from "undici";
import { loadActiveNetworkOptions } from "../src/lib/network/configuration";

// Returning direct on a missing/true/unavailable status would violate the configured proxy policy.
test("secret-free deployments use direct only when backend confirms active proxy is disabled", async () => {
  let enabled = false;
  const paths: string[] = [];
  const backend = createServer((request, response) => {
    paths.push(request.url || "");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ code: 200, status: "success", data: { proxyEnabled: enabled } }));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const address = backend.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const direct = new Agent();
  try {
    assert.deepEqual(await loadActiveNetworkOptions(base, undefined, direct), { proxyUrl: "", bypassOrigins: [] });
    enabled = true;
    await assert.rejects(loadActiveNetworkOptions(base, undefined, direct), /REVALIDATION_SECRET/);
    assert.deepEqual(paths, ["/api/internal/network/status", "/api/internal/network/status"]);
  } finally {
    await direct.close();
    backend.close();
  }
});

test("unavailable or malformed discovery fails closed instead of silently choosing direct", async () => {
  const backend = createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ data: {} }));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const address = backend.address();
  assert.ok(address && typeof address !== "string");
  const direct = new Agent();
  try {
    await assert.rejects(loadActiveNetworkOptions(`http://127.0.0.1:${address.port}/api`, undefined, direct));
    await assert.rejects(loadActiveNetworkOptions(`http://127.0.0.1:${address.port}/api`, "wrong-secret", direct));
  } finally {
    await direct.close();
    backend.close();
  }
});
