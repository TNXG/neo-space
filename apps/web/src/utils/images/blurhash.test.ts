import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeBlurhash } from "./blurhash";
import { getImageBounds } from "./bounds";

/** Missing alpha or incorrect DC conversion breaks even a flat black placeholder. */
test("decodes a constant black BlurHash into opaque RGBA pixels", () => {
  assert.deepEqual(decodeBlurhash("000000", 2, 2), new Uint8ClampedArray([
    0, 0, 0, 255, 0, 0, 0, 255,
    0, 0, 0, 255, 0, 0, 0, 255,
  ]));
});

/** The packed DC channel must not be treated as linear RGB or have its channels swapped. */
test("decodes the red sRGB DC fixture", () => {
  // TI:j is 29*83^3 + 18*83^2 + 70*83 + 45 = 0xff0000.
  assert.deepEqual(decodeBlurhash("00TI:j", 1, 1), new Uint8ClampedArray([255, 0, 0, 255]));
});

/** Persisted malformed data must not crash rendering or allocate unbounded canvases. */
test("rejects malformed hashes and invalid decode sizes", () => {
  for (const hash of ["", "00000", "00000!", "~00000", "L00000"]) {
    assert.equal(decodeBlurhash(hash), null);
  }
  assert.equal(decodeBlurhash("000000", 0, 32), null);
  assert.equal(decodeBlurhash("000000", Infinity, 32), null);
  assert.equal(decodeBlurhash("000000", 1024, 1024), null);
});

/** Dropping AC coefficients would incorrectly produce a flat-color placeholder. */
test("decodes spatial variation in the reference BlurHash", () => {
  const pixels = decodeBlurhash("LEHV6nWB2yk8pyo0adR*.7kCMdnj", 8, 6);
  assert.ok(pixels);
  assert.equal(pixels.length, 192);
  assert.notDeepEqual([...pixels.slice(0, 3)], [...pixels.slice(-4, -1)]);
  for (let index = 3; index < pixels.length; index += 4) assert.equal(pixels[index], 255);
});

/** Portraits must be bounded before loading while retaining their exact aspect ratio. */
test("reserves bounded portrait dimensions without enlarging small images", () => {
  assert.deepEqual(getImageBounds({ width: 400, height: 2400 }), { width: 100, height: 600 });
  assert.deepEqual(getImageBounds({ width: 32, height: 16 }), { width: 32, height: 16 });
  assert.deepEqual(getImageBounds({ width: 0, height: 20 }), { width: 600, height: 337.5 });
  assert.deepEqual(getImageBounds({ width: Infinity, height: 20 }), { width: 600, height: 337.5 });
});
