// ============================================================================
// VEPA v3 — Canvas2D Renderer
// GPU-free fallback renderer that draws particles directly to a 2D canvas.
// Designed as a drop-in until PixiJS 8.x is available; the API shape
// mirrors what a PixiJS backend would expose so spriteSync.js can target
// either path without branching in hot loops.
// ============================================================================

import { STRIDE_INDEXES } from '../constants.js';
import { SplitMix32 } from '../core/prng.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import {
    computeColor,
    computeRadius,
    computeAlpha,
} from '../dna/expression.js';
import { projectPoint } from '../ui/camera.js';

// ── Constants ──────────────────────────────────────────────────────────────

const BG_COLOR     = '#0a0a0f';
const GRID_COLOR   = 'rgba(40, 50, 70, 0.25)';
const GRID_DIVISIONS = 8;   // grid lines per axis

// ── Canvas2D Renderer ──────────────────────────────────────────────────────

/**
 * Zero-copy particle view for the draw hot path.
 *
 * The render loop is called every frame with either a raw (Shared)ArrayBuffer
 * or an existing Float32Array view. Wrapping a buffer into `new Float32Array`
 * is free, but doing it over an existing Float32Array would copy 1MB+ per
 * frame — and multiplex mode renders up to 16 shards a frame. This helper
 * returns the typed array itself when one is passed in.
 *
 * @param {SharedArrayBuffer|ArrayBuffer|Float32Array} buffer - Particle storage
 * @returns {Float32Array} A live view over the same memory (never a copy)
 */
export function asParticleView(buffer) {
    return buffer instanceof Float32Array ? buffer : new Float32Array(buffer);
}

// ── Phenotype cache ───────────────────────────────────────────────────────────
// computeColor / computeRadius / computeAlpha run rgbToHsl + hslToRgb + DNA
// reads per particle per frame. Their inputs are constant per particle (DNA,
// species colour) except ENERGY/AGE, which drift slowly — so the cached values
// are refreshed on a cadence (PHENOTYPE_CACHE_FRAMES) instead of every frame.
// The cache is bound to a specific view object (identity check), so multiplex
// shards — which pass their own buffers and render in eco mode anyway — never
// read another shard's colours.
const PHENOTYPE_CACHE_FRAMES = 6;
let _phenoFrame = 0;
let _phenoView = null;
let _phenoCount = 0;
let _phenoColor = null;   // Float32Array count * 3 (r,g,b)
let _phenoRadius = null;  // Float32Array count
let _phenoAlpha = null;   // Float32Array count

function refreshPhenotypeCache(view, count, stride) {
    if (!_phenoColor || _phenoColor.length < count * 3) _phenoColor = new Float32Array(count * 3);
    if (!_phenoRadius || _phenoRadius.length < count) _phenoRadius = new Float32Array(count);
    if (!_phenoAlpha || _phenoAlpha.length < count) _phenoAlpha = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const base = i * stride;
        if (view[base + STRIDE_INDEXES.DEAD] >= 0.99) continue; // dead slots skipped by the draw loop
        const speciesId = view[base + STRIDE_INDEXES.SPECIES_ID];
        const c = computeColor(view, speciesId, i, stride);
        _phenoColor[i * 3] = c.r;
        _phenoColor[i * 3 + 1] = c.g;
        _phenoColor[i * 3 + 2] = c.b;
        _phenoRadius[i] = computeRadius(view, speciesId, i, stride);
        _phenoAlpha[i] = computeAlpha(view, speciesId, i, stride);
    }
}

/**
 * Create a Canvas2D renderer bound to the given canvas element.
 *
 * @param {HTMLCanvasElement} canvas      - Target canvas
 * @param {number}           maxParticles - Upper bound on particle count (unused
 *                                          for Canvas2D, reserved for pool sizing)
 * @param {object}           [opts]       - { maxDpr, eco } — cap the device
 *   pixel ratio (multiplex previews run at 1.25×) and start in eco mode
 *   (no glow halos, no reference grid) to cut fill-rate and draw calls.
 * @returns {object} Renderer state object
 *   { ctx, canvas, width, height, dpr, maxDpr, eco, mode: 'canvas2d' }
 */
export function createRenderer(canvas, maxParticles, opts = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas2D renderer: failed to acquire 2d context');
    }
    const maxDpr = Math.max(1, Math.min(2, parseFloat(opts.maxDpr) || 2));
    const dpr = Math.min(
        typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
        maxDpr,
    );
    const rect = canvas.getBoundingClientRect();

    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);

    return {
        ctx,
        canvas,
        width:  rect.width,
        height: rect.height,
        dpr,
        maxDpr,
        eco: opts.eco === true,
        mode: 'canvas2d',
        sprites: null,   // Canvas2D has no sprite pool
    };
}

/**
 * Handle canvas resize (call on window resize or layout change).
 *
 * @param {object} renderer - Renderer state from createRenderer
 */
export function resize(renderer) {
    const { ctx, canvas } = renderer;
    const dpr = Math.min(
        typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
        renderer.maxDpr || 2,
    );
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width  * dpr);
    const h = Math.round(rect.height * dpr);

    // Skip if dimensions haven't actually changed
    if (canvas.width === w && canvas.height === h) return;

    canvas.width  = w;
    canvas.height = h;
    renderer.width  = rect.width;
    renderer.height = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Return the sprite container/pool (null for Canvas2D).
 */
export function getSprites(renderer) {
    return renderer.sprites;
}

/**
 * Tear down the renderer.
 */
export function destroy(renderer) {
    renderer.ctx = null;
    renderer.canvas = null;
}

// ── Frame Rendering ────────────────────────────────────────────────────────

/**
 * Draw a full frame of alive particles to the Canvas2D context.
 *
 * Steps:
 *  1. Clear to dark background
 *  2. Draw subtle reference grid
 *  3. For each alive particle, draw a filled circle
 *
 * @param {object}        renderer       - Renderer state
 * @param {SharedArrayBuffer|Float32Array} particleBuffer - Particle storage
 * @param {number}        particleCount  - Number of active particles
 * @param {number}        stride         - Floats per particle
 * @param {number}        worldSize      - World coordinate extent
 */
export function renderFrame(renderer, particleBuffer, particleCount, stride, worldSize, opts = {}) {
    const { ctx, width, height } = renderer;
    if (!ctx) return;

    // ── 1. Clear frame ──
    // The simulation canvas is transparent and sits above the atmospheric
    // #bg-canvas layer, so a full clear each frame shows the backdrop through
    // cleanly — no motion trails.
    ctx.clearRect(0, 0, width, height);

    // ── 2. Reference grid (skipped in eco mode — multiplex previews) ──
    const eco = opts.eco === true || renderer.eco === true;
    if (!eco) drawGrid(ctx, width, height);

    // ── 3. Particles ──
    drawParticles(renderer, particleBuffer, particleCount, stride, worldSize, { ...opts, eco });
}

/**
 * Draw just the particle layer (no clear, no grid) — used for the main world
 * inside renderFrame.
 *
 * @param {object} renderer  Renderer state (ctx, width, height)
 * @param {Float32Array} particleBuffer stride-N particle view
 * @param {number} particleCount active slots
 * @param {number} stride floats per particle
 * @param {number} worldSize world coordinate extent
 * @param {object} [opts] render options
 */
export function drawParticles(renderer, particleBuffer, particleCount, stride, worldSize, opts = {}) {
    const { ctx, width, height } = renderer;
    if (!ctx) return;

    const view = asParticleView(particleBuffer);
    const uniformScale = Math.min(width, height) / worldSize;
    const eco = opts.eco === true || renderer.eco === true;

    // Phenotype cache: recompute colour/radius/alpha for every particle on a
    // cadence; reuse them on the frames in between. Skipped entirely in eco
    // mode (multiplex previews use stored base colours already).
    const usePhenoCache = !eco;
    const viewChanged = view !== _phenoView || particleCount !== _phenoCount;
    if (usePhenoCache && viewChanged) _phenoFrame = 0; // force an immediate refresh
    const refreshPheno = usePhenoCache && (viewChanged || _phenoFrame % PHENOTYPE_CACHE_FRAMES === 0);
    if (refreshPheno) {
        refreshPhenotypeCache(view, particleCount, stride);
        _phenoView = view;
        _phenoCount = particleCount;
    }
    _phenoFrame++;

    for (let i = 0; i < particleCount; i++) {
        const base = i * stride;

        // Skip dead particles (DEAD >= 1.0)
        if (view[base + STRIDE_INDEXES.DEAD] >= 0.99) continue;

        const x = view[base + STRIDE_INDEXES.POS_X];
        const y = view[base + STRIDE_INDEXES.POS_Y];
        const z = view[base + STRIDE_INDEXES.POS_Z] || 0;
        const speciesId = view[base + STRIDE_INDEXES.SPECIES_ID];

        // NaN guard — never draw broken coordinates
        if (x !== x || y !== y) continue;

        // 3D camera projection (pan, zoom, orbit)
        const { sx, sy, sr } = projectPoint(x, y, z, worldSize, width, height);

        // Off-screen cull (perf overhaul for large populations): skip the
        // phenotype + draw work for particles projected well outside the
        // viewport. The margin covers the glow halo of the largest stars.
        const CULL_MARGIN = 48;
        if (sx < -CULL_MARGIN || sx > width + CULL_MARGIN || sy < -CULL_MARGIN || sy > height + CULL_MARGIN) continue;

        // Phenotype expression (pass the shared view — avoids per-particle allocation).
        // Eco previews skip the HSL modulation entirely — stored base colour is
        // already species-distinct and the per-particle hsl→rgb round trip is a
        // major cost at 16 shards × thousands of particles per frame.
        const color = eco
            ? {
                r: view[base + STRIDE_INDEXES.COLOR_R],
                g: view[base + STRIDE_INDEXES.COLOR_G],
                b: view[base + STRIDE_INDEXES.COLOR_B],
            }
            : usePhenoCache
                ? { r: _phenoColor[i * 3], g: _phenoColor[i * 3 + 1], b: _phenoColor[i * 3 + 2] }
                : computeColor(view, speciesId, i, stride);
        const radius = usePhenoCache ? _phenoRadius[i] : computeRadius(view, speciesId, i, stride);
        const alpha  = usePhenoCache ? _phenoAlpha[i] : computeAlpha(view, speciesId, i, stride);

        // Radius scaled by perspective (closer = bigger, further = smaller).
        // Clamp to a minimum screen size so particles stay visible even when
        // the whole world is in view (otherwise sub-pixel dots disappear).
        const MIN_PARTICLE_RADIUS_PX = 1.5;
        const screenR = Math.max(radius * uniformScale * sr, MIN_PARTICLE_RADIUS_PX);

        // Skip fully transparent particles
        if (alpha < 0.001) continue;

        // Depth-adjusted alpha — closer = brighter
        const depthAlpha = alpha * (0.3 + 0.7 * sr) * runtimeConfig.globalAlpha;
        ctx.globalAlpha = depthAlpha;

        // Gravitational collapse: stars render as glowing cores with a halo
        const starMass = view[base + STRIDE_INDEXES.MASS];
        if (starMass > runtimeConfig.starMass) {
          const glowR = screenR * 2.6 * runtimeConfig.visualScale;
          if (eco) {
            // Flat halo — two cheap arcs, no per-star radial gradient allocation.
            // Radial gradients are the dominant Canvas2D cost once accretion
            // piles up star masses; the preview grid never needs them.
            ctx.globalAlpha = depthAlpha * 0.25;
            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.beginPath();
            ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = depthAlpha;
            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(screenR * 0.9, 0.5), 0, Math.PI * 2);
            ctx.fill();
          } else {
            const grad = ctx.createRadialGradient(sx, sy, screenR * 0.2, sx, sy, glowR);
            grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0.9)`);
            grad.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},0.35)`);
            grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
            ctx.fill();
            // Bright white-hot core
            ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.min(0.5, (starMass - runtimeConfig.starMass) * 0.01)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(screenR * 0.7, 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          if (!eco) {
            // Soft glow halo — bloom under the crisp core (skipped in eco)
            ctx.globalAlpha = depthAlpha * 0.3;
            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.beginPath();
            ctx.arc(sx, sy, screenR * 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
          // Crisp core
          ctx.globalAlpha = depthAlpha;
          ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(screenR, 0.5), 0, Math.PI * 2);
          ctx.fill();
        }

    }

    // Reset alpha for subsequent draws
    ctx.globalAlpha = 1.0;
}

// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Draw a subtle reference grid across the canvas.
 */
function drawGrid(ctx, width, height) {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;

    const stepX = width  / GRID_DIVISIONS;
    const stepY = height / GRID_DIVISIONS;

    ctx.beginPath();
    for (let i = 1; i < GRID_DIVISIONS; i++) {
        // Vertical lines
        const x = Math.round(i * stepX) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);

        // Horizontal lines
        const y = Math.round(i * stepY) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();
}

// ── Background Layer ────────────────────────────────────────────────────────

/**
 * Paint the atmospheric backdrop — deep-space gradient, nebula blobs,
 * deterministic starfield, and a cinematic vignette. Drawn to a canvas that
 * sits behind the transparent simulation canvas.
 *
 * @param {HTMLCanvasElement} canvas - Target background canvas
 */
export function paintBackground(canvas) {
    if (!canvas) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Deep-space radial base
    const base = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.75);
    base.addColorStop(0, '#10101c');
    base.addColorStop(0.55, '#0a0a14');
    base.addColorStop(1, '#05050a');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Nebula blobs in the accent hues
    paintNebula(ctx, w, h, w * 0.22, h * 0.35, Math.max(w, h) * 0.5, '74, 158, 255', 0.055);
    paintNebula(ctx, w, h, w * 0.82, h * 0.62, Math.max(w, h) * 0.55, '180, 74, 255', 0.045);
    paintNebula(ctx, w, h, w * 0.55, h * 0.15, Math.max(w, h) * 0.4, '74, 255, 138', 0.035);

    // Deterministic starfield (same field every load)
    const rng = new SplitMix32(0x5eed);
    const starCount = Math.round((w * h) / 9000);
    for (let st = 0; st < starCount; st++) {
        const x = rng.nextFloat(0, w);
        const y = rng.nextFloat(0, h);
        const r = rng.nextFloat(0.3, 1.3);
        const a = rng.nextFloat(0.15, 0.9);
        const tint = rng.nextFloat(0, 1);
        let col = '255, 255, 255';
        if (tint < 0.12) col = '180, 200, 255';
        else if (tint < 0.2) col = '255, 200, 170';
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = `rgb(${col})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cinematic vignette
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
}

/** Soft radial color blob for the background. */
function paintNebula(ctx, w, h, x, y, radius, rgb, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
}
