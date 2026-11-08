import assert from "node:assert/strict";
import { test } from "node:test";
import { composeProxyUrl, parseProxyUrl, splitProxyUrl, updateProxyAddress } from "../src/components/dashboard/settings/network-model";

/** Credentials must move out of the visible address field and survive the round trip encoded. */
test("proxy credentials round-trip without staying in the address", () => {
  const parts = splitProxyUrl("socks5://user:p%40ss@[::1]:1080");
  assert.equal(parts.address, "socks5://[::1]:1080");
  assert.equal(parts.username, "user");
  assert.equal(parts.password, "p@ss");
  assert.equal(composeProxyUrl(parts), "socks5://user:p%40ss@[::1]:1080");
});

/** A bare host:port must stay invalid instead of becoming a custom URL scheme. */
test("bare host input is not mistaken for a custom scheme", () => {
  assert.equal(parseProxyUrl("localhost:7890"), null);
  assert.equal(composeProxyUrl({ address: "127.0.0.1:7890", username: "", password: "" }), "127.0.0.1:7890");
});

/** Invalid drafts are preserved verbatim so the backend can reject them with its own message. */
test("invalid draft keeps the typed address for server validation", () => {
  assert.equal(composeProxyUrl({ address: "http://127.0.0.1:7890/path", username: "u", password: "p" }), "http://u:p@127.0.0.1:7890/path");
  assert.equal(splitProxyUrl("not a url").address, "not a url");
});

/** Editing the host keeps existing credentials; pasting credentials moves them out of the address box. */
test("address edits preserve existing credentials unless new ones are pasted", () => {
  const existing = { address: "http://127.0.0.1:7890", username: "u", password: "p" };
  assert.deepEqual(updateProxyAddress("https://proxy.example:8080", existing), { address: "https://proxy.example:8080", username: "u", password: "p" });
  assert.deepEqual(updateProxyAddress("http://other:p%40ss@proxy.example:8080", existing), { address: "http://proxy.example:8080", username: "other", password: "p@ss" });
});
