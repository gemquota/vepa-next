// ============================================================================
// VEPA4 v9.0.0 — WebGPU Compute Module
//
// Offloads the pairwise force hot loop to the GPU. Architecture:
//
//   1. CPU builds neighbour pairs (flattened list of (particle_i, particle_j))
//      from the spatial grid — same data the exact solver iterates.
//   2. CPU uploads: particle buffer (pos, mass), neighbour pairs, law state.
//   3. GPU compute shader: one invocation per pair, computing gravity + collision
//      forces and atomically accumulating into per-particle force buffers.
//   4. CPU downloads force accumulators, adds them to the solver's force arrays.
//
// The CPU still handles: per-particle laws (PLANETARY, CHAOS, etc.), lifecycle,
// integration, DNA-dependent laws — everything that is not embarrassingly parallel.
//
// Fallback: if WebGPU is unavailable, the exact grid solver is used unchanged.
// ============================================================================

const OX = 0, OY = 1, OZ = 2, MASS = 6, RADIUS = 56;
const PARTICLE_STRIDE = 100;

// ── WGSL compute shader ──
// One workgroup per grid cell, one invocation per neighbour pair.
// Each invocation: load particle_i and particle_j from storage buffers,
// compute gravity + collision forces, atomically add to force_i.
const COMPUTE_SHADER = /* wgsl */ `
struct Particle {
  pos_x: f32, pos_y: f32, pos_z: f32,
  mass:   f32,
  radius: f32,
  _pad0: f32, _pad1: f32, _pad2: f32,
};

struct NeighbourPair {
  i: u32,
  j: u32,
};

struct Params {
  particle_count: u32,
  pair_count:     u32,
  world_size:     f32,
  G:              f32,
  softening:      f32,
  max_force:      f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read> pairs: array<NeighbourPair>;
@group(0) @binding(2) var<storage, read_write> force_x: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> force_y: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> force_z: array<atomic<i32>>;
@group(0) @binding(5) var<uniform> params: Params;

fn wrap_coord(v: f32, ws: f32) -> f32 {
  return ((v % ws) + ws) % ws;
}

fn min_image(d: f32, ws: f32) -> f32 {
  let inv = 1.0 / ws;
  return d - round(d * inv) * ws;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.pair_count) { return; }

  let pair = pairs[idx];
  let pi = pair.i;
  let pj = pair.j;

  var pos_i = vec3f(particles[pi].pos_x, particles[pi].pos_y, particles[pi].pos_z);
  var pos_j = vec3f(particles[pj].pos_x, particles[pj].pos_y, particles[pj].pos_z);

  // Minimum-image displacement
  var rx = pos_i.x - pos_j.x;
  var ry = pos_i.y - pos_j.y;
  var rz = pos_i.z - pos_j.z;
  rx = min_image(rx, params.world_size);
  ry = min_image(ry, params.world_size);
  rz = min_image(rz, params.world_size);

  let d2 = rx * rx + ry * ry + rz * rz + params.softening;
  let inv_d = 1.0 / sqrt(d2);
  let inv_d3 = inv_d * inv_d * inv_d;

  // Gravity (attractive): F = -G * m_i * m_j * r / r^3
  let mj = particles[pj].mass;
  let gf = params.G * mj * inv_d3;
  let gfx = -gf * rx;
  let gfy = -gf * ry;
  let gfz = -gf * rz;

  // Collision (repulsive): F = stiffness * (r_i + r_j - dist) / dist
  let dist = d2 * inv_d; // d2 / sqrt(d2) = sqrt(d2) ≈ dist
  let combined_radius = particles[pi].radius + particles[pj].radius;
  let overlap = combined_radius - dist;
  var cfx = 0.0f;
  var cfy = 0.0f;
  var cfz = 0.0f;
  if (overlap > 0.0 && dist > 0.001) {
    let stiffness = 0.5;
    let cf = stiffness * overlap * inv_d;
    cfx = cf * rx;
    cfy = cf * ry;
    cfz = cf * rz;
  }

  var fx = gfx + cfx;
  var fy = gfy + cfy;
  var fz = gfz + cfz;

  // Clamp
  let fmag2 = fx * fx + fy * fy + fz * fz;
  let max_f2 = params.max_force * params.max_force;
  if (fmag2 > max_f2) {
    let scale = params.max_force / sqrt(fmag2);
    fx = fx * scale;
    fy = fy * scale;
    fz = fz * scale;
  }

  // WGSL has no portable floating-point atomics. Accumulate fixed-point
  // micro-forces instead; the CPU converts back after the readback. This is
  // deterministic enough for the GPU path and, unlike f32 writes, race-free.
  let fixed_scale = 1000000.0;
  atomicAdd(&force_x[pi], i32(round(fx * fixed_scale)));
  atomicAdd(&force_y[pi], i32(round(fy * fixed_scale)));
  atomicAdd(&force_z[pi], i32(round(fz * fixed_scale)));
}
`;

/**
 * Create a WebGPU compute context. Returns null if WebGPU is unavailable.
 */
export async function createGPUContext() {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return null;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    // Compile the shader module
    const shaderModule = device.createShaderModule({ code: COMPUTE_SHADER });
    // Create the compute pipeline
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'main' },
    });
    return { device, pipeline, adapter };
  } catch (e) {
    console.warn('WebGPU unavailable:', e.message);
    return null;
  }
}

/**
 * Run one GPU compute pass: upload particle data + neighbour pairs, dispatch
 * the compute shader, read back force accumulators.
 *
 * @param {GPUDevice} gpu - from createGPUContext()
 * @param {Float32Array} view - particle buffer (SharedArrayBuffer or ArrayBuffer)
 * @param {number} count - number of alive particles
 * @param {Array<{i:number, j:number}>} pairs - neighbour pair list
 * @param {object} params - { worldSize, G, softening, maxForce }
 * @returns {Float32Array} force buffers {fx, fy, fz} or null on failure
 */
export async function gpuComputeForces(gpu, view, count, pairs, params) {
  const { device, pipeline } = gpu;
  const ws = params.worldSize || 2000;
  const G = params.G || 1.0;
  const eps = params.softening || 0.5;
  const mf = params.maxForce || 50.0;
  const pairCount = pairs.length;

  if (pairCount === 0) {
    return { fx: new Float32Array(count), fy: new Float32Array(count), fz: new Float32Array(count) };
  }

  try {
    // ── Particle buffer (flattened: 4 floats per particle) ──
    const particleData = new Float32Array(count * 8); // 8 floats per particle for alignment
    for (let i = 0; i < count; i++) {
      const b = i * PARTICLE_STRIDE;
      const off = i * 8;
      particleData[off + 0] = view[b + OX];
      particleData[off + 1] = view[b + OY];
      particleData[off + 2] = view[b + OZ];
      particleData[off + 3] = view[b + MASS];
      particleData[off + 4] = view[b + RADIUS];
      particleData[off + 5] = 0;
      particleData[off + 6] = 0;
      particleData[off + 7] = 0;
    }

    // ── Pair buffer ──
    const pairData = new Uint32Array(pairCount * 2);
    for (let k = 0; k < pairCount; k++) {
      pairData[k * 2] = pairs[k].i;
      pairData[k * 2 + 1] = pairs[k].j;
    }

    // ── Uniform params ──
    const uniformData = new Float32Array([count, pairCount, ws, G, eps, mf, 0, 0]);

    // ── Create GPU buffers ──
    const particleBuf = device.createBuffer({
      size: particleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const pairBuf = device.createBuffer({
      size: pairData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const fxBuf = device.createBuffer({
      size: count * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const fyBuf = device.createBuffer({
      size: count * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const fzBuf = device.createBuffer({
      size: count * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const uniformBuf = device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Read-back buffers (mappable)
    const readFx = device.createBuffer({
      size: count * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const readFy = device.createBuffer({
      size: count * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const readFz = device.createBuffer({
      size: count * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // ── Upload ──
    device.queue.writeBuffer(particleBuf, 0, particleData);
    device.queue.writeBuffer(pairBuf, 0, pairData);
    device.queue.writeBuffer(uniformBuf, 0, uniformData);
    // Zero force buffers
    device.queue.writeBuffer(fxBuf, 0, new Int32Array(count));
    device.queue.writeBuffer(fyBuf, 0, new Int32Array(count));
    device.queue.writeBuffer(fzBuf, 0, new Int32Array(count));

    // ── Bind group ──
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuf } },
        { binding: 1, resource: { buffer: pairBuf } },
        { binding: 2, resource: { buffer: fxBuf } },
        { binding: 3, resource: { buffer: fyBuf } },
        { binding: 4, resource: { buffer: fzBuf } },
        { binding: 5, resource: { buffer: uniformBuf } },
      ],
    });

    // ── Dispatch ──
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    const workgroups = Math.ceil(pairCount / 64);
    passEncoder.dispatchWorkgroups(workgroups);
    passEncoder.end();

    // Copy results to read-back buffers
    commandEncoder.copyBufferToBuffer(fxBuf, 0, readFx, 0, count * 4);
    commandEncoder.copyBufferToBuffer(fyBuf, 0, readFy, 0, count * 4);
    commandEncoder.copyBufferToBuffer(fzBuf, 0, readFz, 0, count * 4);

    device.queue.submit([commandEncoder.finish()]);

    // ── Read back ──
    await readFx.mapAsync(GPUMapMode.READ);
    await readFy.mapAsync(GPUMapMode.READ);
    await readFz.mapAsync(GPUMapMode.READ);

    const rawFx = new Int32Array(readFx.getMappedRange().slice(0));
    const rawFy = new Int32Array(readFy.getMappedRange().slice(0));
    const rawFz = new Int32Array(readFz.getMappedRange().slice(0));
    const fx = new Float32Array(count);
    const fy = new Float32Array(count);
    const fz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      fx[i] = rawFx[i] / 1000000;
      fy[i] = rawFy[i] / 1000000;
      fz[i] = rawFz[i] / 1000000;
    }

    readFx.unmap(); readFy.unmap(); readFz.unmap();

    // Cleanup GPU buffers
    particleBuf.destroy(); pairBuf.destroy();
    fxBuf.destroy(); fyBuf.destroy(); fzBuf.destroy();
    uniformBuf.destroy();
    readFx.destroy(); readFy.destroy(); readFz.destroy();

    return { fx, fy, fz };
  } catch (e) {
    console.error('GPU compute failed:', e.message);
    return null;
  }
}

/**
 * Synchronous headless variant: uses a headless WebGPU-like API for Node.js
 * benchmarking. Since Node.js doesn't have WebGPU natively, this returns null.
 * Real GPU acceleration only works in the browser.
 */
export function gpuComputeForcesSync(view, count, pairs, params) {
  // Headless CPU fallback: compute gravity + collision on CPU in a tight loop.
  // This is used by the benchmark runner. In the browser, gpuComputeForces
  // handles the actual WebGPU dispatch.
  const ws = params.worldSize || 2000;
  const G = params.G || 1.0;
  const eps = params.softening || 0.5;
  const mf = params.maxForce || 50.0;
  const fx = new Float32Array(count);
  const fy = new Float32Array(count);
  const fz = new Float32Array(count);
  const invWs = 1 / ws;

  for (let k = 0; k < pairs.length; k++) {
    const pi = pairs[k].i;
    const pj = pairs[k].j;
    const bi = pi * PARTICLE_STRIDE;
    const bj = pj * PARTICLE_STRIDE;

    let rx = view[bi + OX] - view[bj + OX];
    let ry = view[bi + OY] - view[bj + OY];
    let rz = view[bi + OZ] - view[bj + OZ];
    rx -= Math.round(rx * invWs) * ws;
    ry -= Math.round(ry * invWs) * ws;
    rz -= Math.round(rz * invWs) * ws;

    const d2 = rx * rx + ry * ry + rz * rz + eps;
    const inv = 1 / Math.sqrt(d2);
    const inv3 = inv * inv * inv;

    // Gravity
    const mj = view[bj + MASS];
    const gf = G * mj * inv3;
    let gfx = -gf * rx, gfy = -gf * ry, gfz = -gf * rz;

    // Collision
    const dist = d2 * inv;
    const overlap = view[bi + RADIUS] + view[bj + RADIUS] - dist;
    let cfx = 0, cfy = 0, cfz = 0;
    if (overlap > 0 && dist > 0.001) {
      const cf = 0.5 * overlap * inv;
      cfx = cf * rx; cfy = cf * ry; cfz = cf * rz;
    }

    let ffx = gfx + cfx, ffy = gfy + cfy, ffz = gfz + cfz;
    const fm2 = ffx * ffx + ffy * ffy + ffz * ffz;
    if (fm2 > mf * mf) {
      const scale = mf / Math.sqrt(fm2);
      ffx *= scale; ffy *= scale; ffz *= scale;
    }

    fx[pi] += ffx;
    fy[pi] += ffy;
    fz[pi] += ffz;
  }

  return { fx, fy, fz };
}