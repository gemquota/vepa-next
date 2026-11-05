// ============================================================================
// VEPA4 — Renderer benchmark harness (Playwright-driven, dev-server served).
//
// Times the two presentation backends on identical deterministic fixtures:
//   - canvas2d: full-frame redraw, flushed with a 1px getImageData readback
//   - pixi:     pooled particle sync, flushed with gl.finish()
//
// Two phases per (backend, scale):
//   submit  — main-thread submission cost only (what the app pays per frame
//             before the browser composites)
//   frame   — submission + forced pipeline flush (full cost including raster)
//
// The harness deliberately shares the app's projection/phenotype/culling
// code paths so the comparison isolates draw submission.
// ============================================================================

import {
  PARTICLE_STRIDE,
  STRIDE_INDEXES,
  WORLD_SIZE,
  MAX_PARTICLES,
  DNA_RANGES,
} from '/src/constants.js';
import { SplitMix32 } from '/src/core/prng.js';
import { createRendererAsync, destroy as destroyRenderer } from '/src/render/renderer.js';
import { syncSprites } from '/src/render/spriteSync.js';
import { createLawState } from '/src/state/lawState.js';
import { finishPixiFrame } from '/src/render/pixiRenderer.js';

const S = STRIDE_INDEXES;
const STAR_MASS_THRESHOLD = 12; // mirrors runtimeConfig.starMass default

function buildFixture(count, seed) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  const rng = new SplitMix32(seed);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = rng.nextFloat(0, WORLD_SIZE);
    view[b + S.POS_Y] = rng.nextFloat(0, WORLD_SIZE);
    view[b + S.POS_Z] = rng.nextFloat(0, WORLD_SIZE);
    view[b + S.VEL_X] = rng.nextFloat(-2, 2);
    view[b + S.VEL_Y] = rng.nextFloat(-2, 2);
    view[b + S.VEL_Z] = rng.nextFloat(-2, 2);
    // ~0.5% stars exercise the Canvas2D radial-gradient corona path.
    view[b + S.MASS] = i % 200 === 0
      ? rng.nextFloat(STAR_MASS_THRESHOLD + 1, 40)
      : rng.nextFloat(0.5, 4);
    view[b + S.SPECIES_ID] = i % 8;
    view[b + S.DEAD] = i % 50 === 0 ? 1 : 0;
    view[b + S.RADIUS] = rng.nextFloat(0.8, 3);
    view[b + S.ENERGY] = 100;
    view[b + S.ALPHA] = 0;
    view[b + S.SIGNAL] = 0;
    view[b + S.MEMORY] = 0;
    view[b + S.COLOR_R] = 60 + (i % 8) * 24;
    view[b + S.COLOR_G] = 180 - (i % 8) * 16;
    view[b + S.COLOR_B] = 120 + (i % 5) * 28;
    // DNA cache: defaults from DNA_RANGES so phenotype math runs for real.
    for (let d = 0; d < 42; d++) {
      const range = DNA_RANGES[d] || [0, 1, 0.5];
      view[b + S.DNA_CACHE_START + d] = range[2] ?? ((range[0] + range[1]) * 0.5);
    }
  }
  return view;
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = sum / sorted.length;
  return {
    mean: +mean.toFixed(4),
    p50: +pick(0.5).toFixed(4),
    p95: +pick(0.95).toFixed(4),
    min: +sorted[0].toFixed(4),
    max: +sorted[sorted.length - 1].toFixed(4),
    fps: +(1000 / mean).toFixed(1),
  };
}

function webglInfo() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2')
      || probe.getContext('webgl')
      || probe.getContext('experimental-webgl');
    if (!gl) return { webgl: false, renderer: null, vendor: null };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      webgl: true,
      renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      vendor: dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
      version: String(gl.getParameter(gl.VERSION)),
    };
  } catch (error) {
    return { webgl: false, renderer: null, vendor: null, error: String(error) };
  }
}

/** Pixi renderer-type enum: 1=WEBGL, 2=WEBGPU, 4=CANVAS (fallback). */
const RENDERER_TYPE_NAMES = { 1: 'webgl', 2: 'webgpu', 4: 'canvas' };

/** Pull the live GL strings off an engaged pixi renderer (authoritative). */
function pixiGlInfo(renderer) {
  try {
    const pixiRenderer = renderer?.app?.renderer;
    const gl = pixiRenderer?.gl ?? pixiRenderer?.canvasContext?.gl ?? pixiRenderer?.context?.gl ?? null;
    if (!gl || typeof gl.getParameter !== 'function') return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      vendor: dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
    };
  } catch {
    return null;
  }
}

async function runBackend(backend, count, seed, frameSamples) {
  // Fresh canvas per backend: a canvas can hold only one context type.
  const canvas = document.createElement('canvas');
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  document.body.appendChild(canvas);

  const initStart = performance.now();
  const renderer = await createRendererAsync(canvas, count, { backend });
  const initMs = +(performance.now() - initStart).toFixed(2);

  const view = buildFixture(count, seed);
  const lawState = createLawState();
  const noop = () => {};
  const makeFlush = () => {
    if (renderer.mode === 'pixi') return () => finishPixiFrame(renderer);
    const ctx = renderer.ctx;
    // 1px readback is a full sync point for queued 2D commands.
    return () => ctx.getImageData(0, 0, 1, 1);
  };

  const time = (frames, flush) => {
    const samples = [];
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now();
      syncSprites(renderer, view, count, PARTICLE_STRIDE, WORLD_SIZE, lawState);
      flush();
      samples.push(performance.now() - t0);
    }
    return samples;
  };

  // Warmup: phenotype cache cadence (6 frames), JIT, first-draw uploads.
  time(10, makeFlush());

  const submitSamples = time(frameSamples, noop);
  const frameSamplesFlushed = time(frameSamples, makeFlush());

  const result = {
    backend,
    mode: renderer.mode,
    requestedBackend: backend,
    backendError: renderer.backendError || null,
    gl: renderer.mode === 'pixi' ? pixiGlInfo(renderer) : null,
    rendererType: renderer.rendererType ?? null,
    rendererTypeName: RENDERER_TYPE_NAMES[renderer.rendererType] ?? null,
    count,
    initMs,
    submit: stats(submitSamples),
    frame: stats(frameSamplesFlushed),
  };

  destroyRenderer(renderer);
  canvas.remove();
  return result;
}

window.__VEPA_BENCH__ = {
  async run({ scales, frameSamples = 30, seed = 0x9e3779b9 }) {
    const info = webglInfo();
    const results = [];
    for (const backend of ['canvas2d', 'pixi']) {
      for (const count of scales) {
        results.push(await runBackend(backend, count, seed, frameSamples));
      }
    }
    return {
      environment: {
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...info,
      },
      config: { scales, frameSamples, seed, maxParticles: MAX_PARTICLES },
      results,
    };
  },
};
