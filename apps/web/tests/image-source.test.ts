import assert from "node:assert/strict";
import { test } from "node:test";
import imageLoader from "../src/lib/network/image-loader";
import { parseRemoteImageUrl } from "../src/lib/network/image-policy";
import { fetchImageSource } from "../src/lib/network/image-source";

// Passing remote URLs straight to /_next/image would bypass the managed server proxy.
test("remote images use a local source while local assets keep default optimization", () => {
  const result = new URL(imageLoader({ src: "https://cdn.tnxg.top/photo.png", width: 640, quality: 75 }), "https://site.test");
  assert.equal(result.pathname, "/_next/image");
  assert.equal(result.searchParams.get("w"), "640");
  const source = new URL(result.searchParams.get("url") || "", "https://site.test");
  assert.equal(source.pathname, "/api/image-source");
  assert.equal(source.searchParams.get("url"), "https://cdn.tnxg.top/photo.png");
  const local = new URL(imageLoader({ src: "/logo.png", width: 128, quality: 75 }), "https://site.test");
  assert.equal(local.searchParams.get("url"), "/logo.png");
});

test("image source policy rejects arbitrary hosts credentials ports and non-HTTPS schemes", () => {
  for (const value of ["https://evil.test/image", "https://cdn.tnxg.top.evil.test/image", "https://user:secret@cdn.tnxg.top/image", "https://cdn.tnxg.top:8443/image", "http://cdn.tnxg.top/image", "file:///etc/passwd", "https://127.0.0.1/image"]) {
    assert.throws(() => parseRemoteImageUrl(value));
  }
  assert.equal(parseRemoteImageUrl("https://lain.bgm.tv/a.jpg").hostname, "lain.bgm.tv");
});

test("image source rejects a redirect escaping the allowlist before making a second request", async () => {
  const response = await fetchImageSource("https://cdn.tnxg.top/start", async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
  assert.equal(response.status, 400);
});

test("image source refuses oversized and active document bodies", async () => {
  const oversized = await fetchImageSource("https://cdn.tnxg.top/large", async () => new Response("", { headers: { "content-type": "image/png", "content-length": "30000000" } }));
  assert.equal(oversized.status, 413);
  const document = await fetchImageSource("https://cdn.tnxg.top/document", async () => new Response("<svg onload='alert(1)'/>", { headers: { "content-type": "image/svg+xml" } }));
  assert.equal(document.status, 415);
});
