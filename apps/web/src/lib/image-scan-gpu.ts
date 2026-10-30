import { COMPONENTS_X, COMPONENTS_Y, computeCpuCoefficients } from "./image-scan-blurhash";

export interface CoefficientProcessor {
  readonly kind: "gpu" | "cpu";
  compute: (pixels: Float32Array, width: number, height: number) => Promise<Float32Array>;
  dispose: () => void;
}

const COEFFICIENT_COUNT = COMPONENTS_X * COMPONENTS_Y;
const COEFFICIENT_BYTES = COEFFICIENT_COUNT * 4 * Float32Array.BYTES_PER_ELEMENT;
const GPU_TIMEOUT_MS = 3_000;
const SHADER = `
@group(0) @binding(0) var<storage, read> pixels: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> coefficients: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> dimensions: vec4<u32>;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let coefficient = id.x;
  if (coefficient >= ${COEFFICIENT_COUNT}u) { return; }
  let component_x = coefficient % ${COMPONENTS_X}u;
  let component_y = coefficient / ${COMPONENTS_X}u;
  let width = dimensions.x;
  let height = dimensions.y;
  let normalization = select(2.0, 1.0, coefficient == 0u);
  var sum = vec3<f32>(0.0);
  for (var y = 0u; y < height; y = y + 1u) {
    let vertical = cos(3.141592653589793 * f32(component_y * y) / f32(height));
    for (var x = 0u; x < width; x = x + 1u) {
      let basis = normalization * cos(3.141592653589793 * f32(component_x * x) / f32(width))
        * vertical / f32(width * height);
      sum = sum + basis * pixels[y * width + x].rgb;
    }
  }
  coefficients[coefficient] = vec4<f32>(sum, 0.0);
}`;

/** Bound optional GPU initialization/readback so unavailable or lost devices cannot stall a scan. */
const withGpuTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  const deadline = Promise.withResolvers<never>();
  const timer = setTimeout(() => deadline.reject(new Error("GPU operation timed out")), GPU_TIMEOUT_MS);
  try {
    return await Promise.race([promise, deadline.promise]);
  } finally {
    clearTimeout(timer);
  }
};

/** Prefer real WebGPU cosine coefficient computation, falling back permanently to CPU on any failure. */
export const createCoefficientProcessor = async (): Promise<CoefficientProcessor> => {
  let device: GPUDevice | undefined;
  let pipeline: GPUComputePipeline | undefined;
  let unavailable = false;
  let disposed = false;
  try {
    const gpu = typeof navigator === "undefined" ? undefined : navigator.gpu;
    if (!gpu) throw new Error("WebGPU unavailable");
    const adapter = await withGpuTimeout(gpu.requestAdapter({ powerPreference: "high-performance" }));
    if (!adapter) throw new Error("No GPU adapter");
    const requestedDevice = adapter.requestDevice().then((created) => {
      if (unavailable) created.destroy();
      return created;
    });
    device = await withGpuTimeout(requestedDevice);
    device.lost.then(() => {
      if (!unavailable && !disposed) console.info("[image-scan] WebGPU device lost; using CPU BlurHash coefficients.");
      unavailable = true;
    }).catch(() => { unavailable = true; });
    const module = device.createShaderModule({ code: SHADER });
    pipeline = await withGpuTimeout(device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } }));
  } catch {
    unavailable = true;
    device?.destroy();
    console.info("[image-scan] WebGPU unavailable; using CPU BlurHash coefficients.");
  }

  /** Compute on GPU and read back only the cosine coefficients, with scoped resource/error cleanup. */
  const computeOnGpu = async (pixels: Float32Array, width: number, height: number): Promise<Float32Array> => {
    if (!device || !pipeline) throw new Error("GPU unavailable");
    const buffers: GPUBuffer[] = [];
    device.pushErrorScope("validation");
    try {
      const input = device.createBuffer({ size: pixels.byteLength, usage: 128 | 8 }); // STORAGE | COPY_DST
      buffers.push(input);
      const output = device.createBuffer({ size: COEFFICIENT_BYTES, usage: 128 | 4 }); // STORAGE | COPY_SRC
      buffers.push(output);
      const readback = device.createBuffer({ size: COEFFICIENT_BYTES, usage: 1 | 8 }); // MAP_READ | COPY_DST
      buffers.push(readback);
      const dimensions = device.createBuffer({ size: 16, usage: 64 | 8 }); // UNIFORM | COPY_DST
      buffers.push(dimensions);
      device.queue.writeBuffer(input, 0, pixels);
      device.queue.writeBuffer(dimensions, 0, new Uint32Array([width, height, 0, 0]));
      const group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }, { binding: 2, resource: { buffer: dimensions } }],
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(COEFFICIENT_COUNT);
      pass.end();
      encoder.copyBufferToBuffer(output, 0, readback, 0, COEFFICIENT_BYTES);
      device.queue.submit([encoder.finish()]);
      await withGpuTimeout(readback.mapAsync(1)); // GPUMapMode.READ
      const coefficients = new Float32Array(readback.getMappedRange().slice(0));
      readback.unmap();
      if (!coefficients.every(Number.isFinite)) throw new Error("GPU returned invalid coefficients");
      return coefficients;
    } finally {
      buffers.forEach(buffer => buffer.destroy());
      const error = await withGpuTimeout(device.popErrorScope());
      if (error) throw new Error("GPU coefficient computation failed");
    }
  };

  return {
    get kind() { return unavailable ? "cpu" : "gpu"; },
    compute: async (pixels, width, height) => {
      if (disposed) throw new Error("Image processor was disposed");
      if (!unavailable) {
        try {
          return await computeOnGpu(pixels, width, height);
        } catch {
          unavailable = true;
          device?.destroy();
          console.info("[image-scan] WebGPU computation failed or device was lost; using CPU BlurHash coefficients.");
        }
      }
      return computeCpuCoefficients(pixels, width, height);
    },
    dispose: () => { disposed = true; device?.destroy(); },
  };
};
