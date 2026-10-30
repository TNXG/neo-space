import assert from "node:assert/strict";
import { test } from "node:test";

import { downloadScanImage, ImageScanError } from "./image-scan-download";

/** Supply only the browser URL base at the download boundary, restoring the original global afterward. */
const withDocument = async (work: () => Promise<void>): Promise<void> => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { baseURI: "https://editor.test/write" } });
  try { await work(); } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
};

test("browser downloads omit credentials and report CORS failure without underlying secrets", async (context) => {
  await withDocument(async () => {
    context.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
      assert.equal(url.href, "https://editor.test/photo.png");
      assert.equal(options.credentials, "omit");
      assert.equal(options.mode, "cors");
      assert.equal(options.referrerPolicy, "no-referrer");
      throw new Error("secret-token-in-network-error");
    });
    await assert.rejects(downloadScanImage("/photo.png", new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof ImageScanError);
      assert.match(error.message, /CORS/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    });
  });
});

test("embedded credentials and non-HTTP image sources are rejected before fetch", async (context) => {
  await withDocument(async () => {
    context.mock.method(globalThis, "fetch", async () => { assert.fail("Unsafe URL reached fetch"); });
    for (const src of ["https://user:secret@images.test/a.png", "data:image/png;base64,AAAA", "file:///tmp/a.png"]) {
      await assert.rejects(downloadScanImage(src, new AbortController().signal), ImageScanError);
    }
  });
});
