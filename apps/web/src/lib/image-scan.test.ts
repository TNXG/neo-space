import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeBlurhash } from "@/utils/images/blurhash";
import { hashImageUrl } from "@/utils/images/common";

import { scanContentImages } from "./image-scan";

/** Replace browser decoding/canvas boundaries while leaving source parsing, download, transforms and orchestration real. */
const withBrowser = async (work: () => Promise<void>, width = 320, height = 180): Promise<void> => {
  const replacements: Record<string, unknown> = {
    window: { setTimeout, clearTimeout },
    document: {
      baseURI: "https://editor.test/write",
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => undefined,
          getImageData: (_x: number, _y: number, width: number, height: number) => {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let index = 3; index < data.length; index += 4) data[index] = 255;
            return { data };
          },
        }),
      }),
    },
    Image: class {
      src = "";
      naturalWidth = width;
      naturalHeight = height;
      decode = async () => undefined;
    },
  };
  const originals = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.entries(replacements).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, value }));
  try { await work(); } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
};

test("scan keeps exact URL keys, deduplicates requests, reports individual failures and completes progress", async (context) => {
  await withBrowser(async () => {
    const header = new Uint8Array(24);
    header.set([137, 80, 78, 71, 13, 10, 26, 10]);
    header.set([73, 72, 68, 82], 12);
    const view = new DataView(header.buffer);
    view.setUint32(16, 320);
    view.setUint32(20, 180);
    const requested: string[] = [];
    context.mock.method(globalThis, "fetch", async (url: URL) => {
      requested.push(url.href);
      if (url.pathname === "/bad.png") throw new Error("credential-secret");
      return new Response(header, { headers: { "content-type": "image/png" } });
    });
    const progress: number[][] = [];
    const result = await scanContentImages("![a](/photo.png?version=2)\n\n![again](/photo.png?version=2)\n\n![bad](/bad.png)", (done, total) => progress.push([done, total]));
    assert.deepEqual(requested, ["https://editor.test/photo.png?version=2", "https://editor.test/bad.png"]);
    const { blurhash, ...image } = result.images[hashImageUrl("/photo.png?version=2")];
    assert.deepEqual(image, { src: "/photo.png?version=2", width: 320, height: 180, bytes: 24 });
    assert.deepEqual(decodeBlurhash(blurhash, 1, 1), new Uint8ClampedArray([0, 0, 0, 255]));
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].src, "/bad.png");
    assert.match(result.errors[0].message, /CORS/);
    assert.doesNotMatch(result.errors[0].message, /credential-secret/);
    assert.deepEqual(progress, [[0, 2], [1, 2], [2, 2]]);
  });
});

test("empty scans do not request images and report zero progress", async (context) => {
  await withBrowser(async () => {
    context.mock.method(globalThis, "fetch", async () => { assert.fail("Empty scan attempted a request"); });
    const progress: number[][] = [];
    assert.deepEqual(await scanContentImages("No images. `![code](/ignored.png)`", (done, total) => progress.push([done, total])), {
      images: {}, errors: [], processor: "cpu",
    });
    assert.deepEqual(progress, [[0, 0]]);
  });
});

test("large intrinsic dimensions are preserved while BlurHash uses a thumbnail", async (context) => {
  await withBrowser(async () => {
    context.mock.method(globalThis, "fetch", async () => new Response("image", { headers: { "content-type": "image/svg+xml" } }));
    const result = await scanContentImages("![Large](/large.svg)");
    assert.deepEqual(result.errors, []);
    const image = result.images[hashImageUrl("/large.svg")];
    assert.equal(image.width, 30_000);
    assert.equal(image.height, 2_000);
  }, 30_000, 2_000);
});

test("each image reports its own queued, processing and terminal status", async (context) => {
  await withBrowser(async () => {
    context.mock.method(globalThis, "fetch", async (url: URL) => {
      if (url.pathname === "/bad.png") return new Response(null, { status: 404 });
      return new Response("image", { headers: { "content-type": "image/png" } });
    });
    const updates: { src: string; status: string }[] = [];
    await scanContentImages("![Good](/good.png)\n\n![Bad](/bad.png)", undefined, update => updates.push({ src: update.src, status: update.status }));
    assert.deepEqual(updates, [
      { src: "/good.png", status: "queued" },
      { src: "/bad.png", status: "queued" },
      { src: "/good.png", status: "processing" },
      { src: "/good.png", status: "success" },
      { src: "/bad.png", status: "processing" },
      { src: "/bad.png", status: "failed" },
    ]);
  });
});
