const BASE83 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";
export const COMPONENTS_X = 4;
export const COMPONENTS_Y = 3;

/** Encode an integer with exactly the requested number of BlurHash base83 digits. */
const encode83 = (value: number, length: number): string => {
  let encoded = "";
  for (let digit = length - 1; digit >= 0; digit--) {
    encoded += BASE83[Math.floor(value / 83 ** digit) % 83];
  }
  return encoded;
};

/** Convert a byte-range sRGB channel to linear light. */
const toLinear = (value: number): number => {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

/** Convert linear light to a clamped byte-range sRGB channel. */
const toSrgb = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.floor((clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055) * 255 + 0.5);
};

/** Composite transparent pixels onto white and prepare identical linear RGBA input for CPU and GPU. */
export const linearizePixels = (rgba: Uint8ClampedArray): Float32Array => {
  const pixels = new Float32Array(rgba.length);
  for (let index = 0; index < rgba.length; index += 4) {
    const alpha = rgba[index + 3] / 255;
    pixels[index] = toLinear(rgba[index] * alpha + 255 * (1 - alpha));
    pixels[index + 1] = toLinear(rgba[index + 1] * alpha + 255 * (1 - alpha));
    pixels[index + 2] = toLinear(rgba[index + 2] * alpha + 255 * (1 - alpha));
    pixels[index + 3] = 1;
  }
  return pixels;
};

/** Compute cosine coefficients using cached bases and double-precision accumulation before GPU-sized output. */
export const computeCpuCoefficients = (pixels: Float32Array, width: number, height: number): Float32Array => {
  const coefficients = new Float32Array(COMPONENTS_X * COMPONENTS_Y * 4);
  const horizontal = new Float64Array(COMPONENTS_X * width);
  const vertical = new Float64Array(COMPONENTS_Y * height);
  for (let component = 0; component < COMPONENTS_X; component++) for (let x = 0; x < width; x++) {
    horizontal[component * width + x] = Math.cos(Math.PI * component * x / width);
  }
  for (let component = 0; component < COMPONENTS_Y; component++) for (let y = 0; y < height; y++) {
    vertical[component * height + y] = Math.cos(Math.PI * component * y / height);
  }
  for (let componentY = 0; componentY < COMPONENTS_Y; componentY++) {
    for (let componentX = 0; componentX < COMPONENTS_X; componentX++) {
      const offset = (componentY * COMPONENTS_X + componentX) * 4;
      const normalization = (componentX === 0 && componentY === 0 ? 1 : 2) / (width * height);
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let y = 0; y < height; y++) {
        const rowBasis = vertical[componentY * height + y] * normalization;
        for (let x = 0; x < width; x++) {
          const basis = horizontal[componentX * width + x] * rowBasis;
          const pixel = (y * width + x) * 4;
          red += basis * pixels[pixel];
          green += basis * pixels[pixel + 1];
          blue += basis * pixels[pixel + 2];
        }
      }
      coefficients[offset] = red;
      coefficients[offset + 1] = green;
      coefficients[offset + 2] = blue;
    }
  }
  return coefficients;
};

/** Quantize one signed AC channel using the standard BlurHash square-root curve. */
const quantizeAc = (value: number, maximum: number): number => {
  const scaled = value / maximum;
  return Math.max(0, Math.min(18, Math.floor(Math.sign(scaled) * Math.sqrt(Math.abs(scaled)) * 9 + 9.5)));
};

/** Serialize CPU- or GPU-produced coefficients as a compact low-frequency 4×3 BlurHash. */
export const blurhashFromCoefficients = (coefficients: Float32Array): string => {
  let maximum = 0;
  for (let index = 4; index < coefficients.length; index++) {
    if (index % 4 !== 3) maximum = Math.max(maximum, Math.abs(coefficients[index]));
  }
  const quantizedMaximum = Math.max(0, Math.min(82, Math.floor(maximum * 166 - 0.5)));
  const scale = (quantizedMaximum + 1) / 166;
  const dc = (toSrgb(coefficients[0]) << 16) + (toSrgb(coefficients[1]) << 8) + toSrgb(coefficients[2]);
  let hash = encode83((COMPONENTS_X - 1) + (COMPONENTS_Y - 1) * 9, 1)
    + encode83(quantizedMaximum, 1) + encode83(dc, 4);
  for (let index = 4; index < coefficients.length; index += 4) {
    hash += encode83(quantizeAc(coefficients[index], scale) * 19 * 19
      + quantizeAc(coefficients[index + 1], scale) * 19 + quantizeAc(coefficients[index + 2], scale), 2);
  }
  return hash;
};
