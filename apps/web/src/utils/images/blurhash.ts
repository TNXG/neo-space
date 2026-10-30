const BASE83 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

/** Decode an already validated base83 segment. */
function decode83(value: string): number {
  let result = 0;
  for (const character of value) result = result * 83 + BASE83.indexOf(character);
  return result;
}

/** Convert an sRGB byte into a linear-light channel. */
function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Convert a linear-light channel into a clamped sRGB byte. */
function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055));
}

/** Reconstruct a signed AC channel from its quantized value. */
function decodeAc(value: number, maximum: number): number {
  const normalized = (value - 9) / 9;
  return Math.sign(normalized) * normalized * normalized * maximum;
}

/** Decode a BlurHash to a bounded opaque RGBA thumbnail; malformed persisted values return null. */
export function decodeBlurhash(hash: string, width = 32, height = 32): Uint8ClampedArray | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 128 || height > 128) return null;
  if (hash.length < 6 || [...hash].some(character => !BASE83.includes(character))) return null;
  const size = decode83(hash[0]);
  const columns = size % 9 + 1;
  const rows = Math.floor(size / 9) + 1;
  if (rows > 9 || hash.length !== 4 + 2 * columns * rows) return null;
  const maximum = (decode83(hash[1]) + 1) / 166;
  const coefficients: [number, number, number][] = [];
  const dc = decode83(hash.slice(2, 6));
  if (dc > 0xffffff) return null;
  coefficients.push([srgbToLinear(dc >> 16), srgbToLinear((dc >> 8) & 255), srgbToLinear(dc & 255)]);
  for (let index = 1; index < columns * rows; index++) {
    const ac = decode83(hash.slice(4 + index * 2, 6 + index * 2));
    if (ac >= 19 ** 3) return null;
    coefficients.push([
      decodeAc(Math.floor(ac / (19 * 19)), maximum),
      decodeAc(Math.floor(ac / 19) % 19, maximum),
      decodeAc(ac % 19, maximum),
    ]);
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  const horizontal = new Float64Array(columns * width);
  const vertical = new Float64Array(rows * height);
  for (let column = 0; column < columns; column++) for (let x = 0; x < width; x++) {
    horizontal[column * width + x] = Math.cos(Math.PI * x * column / width);
  }
  for (let row = 0; row < rows; row++) for (let y = 0; y < height; y++) {
    vertical[row * height + y] = Math.cos(Math.PI * y * row / height);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const basis = horizontal[column * width + x] * vertical[row * height + y];
          const color = coefficients[column + row * columns];
          red += color[0] * basis;
          green += color[1] * basis;
          blue += color[2] * basis;
        }
      }
      const offset = 4 * (x + y * width);
      pixels[offset] = linearToSrgb(red);
      pixels[offset + 1] = linearToSrgb(green);
      pixels[offset + 2] = linearToSrgb(blue);
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}
