import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeBlurhash } from "@/utils/images/blurhash";
import { blurhashFromCoefficients, computeCpuCoefficients, linearizePixels } from "./image-scan-blurhash";
import { createCoefficientProcessor } from "./image-scan-gpu";

test("encoding and decoding preserve primary color channels", () => {
  for (const color of [[255, 0, 0], [0, 255, 0], [0, 0, 255]]) {
    const rgba = new Uint8ClampedArray(32 * 32 * 4);
    for (let offset = 0; offset < rgba.length; offset += 4) rgba.set([...color, 255], offset);
    const decoded = decodeBlurhash(blurhashFromCoefficients(computeCpuCoefficients(linearizePixels(rgba), 32, 32)), 32, 32);
    assert.ok(decoded);
    const center = (16 * 32 + 16) * 4;
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(decoded[center + channel] - color[channel]) <= 2);
    }
  }
});

test("transparent pixels composite onto white before encoding", () => {
  assert.deepEqual(Array.from(linearizePixels(new Uint8ClampedArray([10, 20, 30, 0]))), [1, 1, 1, 1]);
});

test("CPU transform measures spatial color variation instead of only averaging", () => {
  const coefficients = computeCpuCoefficients(linearizePixels(new Uint8ClampedArray([
    255, 0, 0, 255, 0, 0, 255, 255,
  ])), 2, 1);
  assert.equal(coefficients[0], 0.5);
  assert.equal(coefficients[2], 0.5);
  assert.ok(Math.abs(coefficients[4] - 1) < 0.00001);
  assert.ok(Math.abs(coefficients[6]) < 0.00001);
});

test("real WebGPU coefficients match the CPU transform when an adapter is available", async (context) => {
  const processor = await createCoefficientProcessor();
  if (processor.kind !== "gpu") {
    context.skip("WebGPU adapter unavailable in this runtime");
    processor.dispose();
    return;
  }
  try {
    const rgba = new Uint8ClampedArray(8 * 8 * 4);
    for (let index = 0; index < rgba.length; index += 4) {
      rgba[index] = (index * 17) % 256;
      rgba[index + 1] = (index * 11) % 256;
      rgba[index + 2] = (index * 7) % 256;
      rgba[index + 3] = 255;
    }
    const pixels = linearizePixels(rgba);
    const expected = computeCpuCoefficients(pixels, 8, 8);
    const actual = await processor.compute(pixels, 8, 8);
    for (let index = 0; index < actual.length; index++) {
      assert.ok(Math.abs(actual[index] - expected[index]) < 0.0001, `coefficient ${index}`);
    }
  } finally {
    processor.dispose();
  }
});
