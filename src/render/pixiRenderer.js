// ============================================================================
// VEPA4 — PixiJS renderer
//
// The Canvas2D renderer remains the compatibility/reference path. This module
// provides the GPU-backed alternative used by the main renderer selector and
// the browser comparison benchmark. It intentionally uses one shared circular
// texture and pooled Pixi particles rather than one Graphics object per body.
// ============================================================================

import { Application, Particle, ParticleContainer, Texture } from 'pixi.js';
import { STRIDE_INDEXES } from '../constants.js';
import { computeColor, computeRadius, computeAlpha } from '../dna/expression.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { projectPoint } from '../ui/camera.js';
import { asParticleView } from './zeroCopy.js';

const PHENOTYPE_CACHE_FRAMES = 6;
const MIN_PARTICLE_RADIUS_PX = 1.5;
const CULL_MARGIN = 48;
const TEXTURE_SIZE = 32;

function clampDpr(value) {
    return Math.max(1, Math.min(2, parseFloat(value) || 2));
}

function asView(buffer) {
    return asParticleView(buffer);
}

function makeParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PixiJS renderer: failed to create particle texture');
    context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, 0, Math.PI * 2);
    context.fill();
    return Texture.from(canvas, true);
}

function tintFromRgb(r, g, b) {
    return ((Math.max(0, Math.min(255, r)) & 0xff) << 16)
        | ((Math.max(0, Math.min(255, g)) & 0xff) << 8)
        | (Math.max(0, Math.min(255, b)) & 0xff);
}

function refreshPhenotypeCache(renderer, view, count, stride) {
    if (!renderer.phenoColor || renderer.phenoColor.length < count * 3) {
        renderer.phenoColor = new Float32Array(count * 3);
    }
    if (!renderer.phenoRadius || renderer.phenoRadius.length < count) {
        renderer.phenoRadius = new Float32Array(count);
    }
    if (!renderer.phenoAlpha || renderer.phenoAlpha.length < count) {
        renderer.phenoAlpha = new Float32Array(count);
    }

    for (let i = 0; i < count; i++) {
        const base = i * stride;
        if (view[base + STRIDE_INDEXES.DEAD] >= 0.99) continue;
        const speciesId = view[base + STRIDE_INDEXES.SPECIES_ID];
        const color = computeColor(view, speciesId, i, stride);
        renderer.phenoColor[i * 3] = color.r;
        renderer.phenoColor[i * 3 + 1] = color.g;
        renderer.phenoColor[i * 3 + 2] = color.b;
        renderer.phenoRadius[i] = computeRadius(view, speciesId, i, stride);
        renderer.phenoAlpha[i] = computeAlpha(view, speciesId, i, stride);
    }
}

function createContainer(texture) {
    return new ParticleContainer({
        texture,
        dynamicProperties: {
            // Scale is encoded in the vertex transform in Pixi's particle pipe.
            vertex: true,
            position: true,
            color: true,
            rotation: false,
            uvs: false,
        },
        roundPixels: false,
    });
}

function ensurePool(renderer, count) {
    const target = Math.min(count, renderer.maxParticles);
    while (renderer.pool.length < target) {
        const particle = new Particle({
            texture: renderer.texture,
            anchorX: 0.5,
            anchorY: 0.5,
            alpha: 0,
            tint: 0xffffff,
            scaleX: 0,
            scaleY: 0,
        });
        renderer.particles.addParticle(particle);
        renderer.pool.push(particle);

        if (renderer.halos) {
            const halo = new Particle({
                texture: renderer.texture,
                anchorX: 0.5,
                anchorY: 0.5,
                alpha: 0,
                tint: 0xffffff,
                scaleX: 0,
                scaleY: 0,
            });
            renderer.halos.addParticle(halo);
            renderer.haloPool.push(halo);
        }
    }
}

/**
 * Initialize a PixiJS application on an existing canvas.
 *
 * PixiJS 8 initialization is asynchronous because renderer selection and GPU
 * resource setup are asynchronous. Callers should await this function and
 * retain the returned object for `syncPixiRenderer`.
 */
export async function createPixiRenderer(canvas, maxParticles, opts = {}) {
    if (!canvas) throw new Error('PixiJS renderer: canvas is required');
    if (typeof document === 'undefined') throw new Error('PixiJS renderer requires a browser document');

    const maxDpr = clampDpr(opts.maxDpr);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.clientWidth || 1);
    const height = Math.max(1, rect.height || canvas.clientHeight || 1);
    const dpr = Math.min(
        typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
        maxDpr,
    );

    const app = new Application();
    await app.init({
        canvas,
        width,
        height,
        resolution: dpr,
        autoDensity: true,
        antialias: false,
        backgroundAlpha: 0,
        clearBeforeRender: true,
        autoStart: false,
        preference: opts.preference || 'webgl',
        powerPreference: 'high-performance',
    });

    const texture = makeParticleTexture();
    const particles = createContainer(texture);
    const halos = opts.eco === true ? null : createContainer(texture);
    if (halos) app.stage.addChild(halos);
    app.stage.addChild(particles);

    const renderer = {
        mode: 'pixi',
        backend: 'pixi',
        // PixiJS silently degrades to its own Canvas renderer when WebGL is
        // unavailable (type 1=WEBGL, 2=WEBGPU, 4=CANVAS). Expose the concrete
        // type so benchmarks and tests can distinguish GPU from fallback.
        rendererType: app.renderer.type,
        canvas,
        ctx: null,
        app,
        stage: app.stage,
        particles,
        halos,
        texture,
        sprites: particles,
        pool: [],
        haloPool: [],
        maxParticles: Math.max(0, Math.floor(maxParticles || 0)),
        width,
        height,
        dpr,
        maxDpr,
        eco: opts.eco === true,
        phenoFrame: 0,
        phenoView: null,
        phenoCount: 0,
        phenoColor: null,
        phenoRadius: null,
        phenoAlpha: null,
        resize() {
            resizePixiRenderer(this);
        },
        destroy() {
            destroyPixiRenderer(this);
        },
    };

    // Keep a stable container bounds contract; ParticleContainer deliberately
    // avoids calculating bounds to reduce CPU work.
    if (renderer.particles.boundsArea) {
        renderer.particles.boundsArea = app.screen;
    }
    if (renderer.halos && renderer.halos.boundsArea) {
        renderer.halos.boundsArea = app.screen;
    }

    return renderer;
}

/** Resize an initialized PixiJS renderer without rebuilding its pool. */
export function resizePixiRenderer(renderer) {
    if (!renderer || renderer.mode !== 'pixi' || !renderer.app) return;
    const rect = renderer.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || renderer.canvas.clientWidth || renderer.width || 1);
    const height = Math.max(1, rect.height || renderer.canvas.clientHeight || renderer.height || 1);
    const dpr = Math.min(
        typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
        renderer.maxDpr || 2,
    );
    renderer.width = width;
    renderer.height = height;
    renderer.dpr = dpr;
    renderer.app.renderer.resolution = dpr;
    renderer.app.renderer.resize(width, height);
    if (renderer.particles.boundsArea) renderer.particles.boundsArea = renderer.app.screen;
    if (renderer.halos && renderer.halos.boundsArea) renderer.halos.boundsArea = renderer.app.screen;
}

/** Release Pixi resources while keeping the host canvas element in the DOM. */
export function destroyPixiRenderer(renderer) {
    if (!renderer || renderer.mode !== 'pixi') return;
    if (renderer.app) renderer.app.destroy(false, { children: true, texture: true, textureSource: true });
    renderer.app = null;
    renderer.stage = null;
    renderer.particles = null;
    renderer.halos = null;
    renderer.pool.length = 0;
    renderer.haloPool.length = 0;
    renderer.ctx = null;
}

/**
 * Update pooled Pixi particles and submit one frame to the GPU.
 * The `eco` option intentionally matches Canvas2D's flat comparison mode.
 */
export function syncPixiRenderer(renderer, particleBuffer, particleCount, stride, worldSize, opts = {}) {
    if (!renderer || renderer.mode !== 'pixi' || !renderer.app) return;

    const view = asView(particleBuffer);
    const count = Math.max(0, Math.min(particleCount || 0, renderer.maxParticles));
    const eco = opts.eco === true || renderer.eco === true;
    const uniformScale = Math.min(renderer.width, renderer.height) / worldSize;
    const viewChanged = view !== renderer.phenoView || count !== renderer.phenoCount;
    const usePhenoCache = !eco;

    ensurePool(renderer, count);
    if (usePhenoCache && viewChanged) renderer.phenoFrame = 0;
    const refreshPheno = usePhenoCache
        && (viewChanged || renderer.phenoFrame % PHENOTYPE_CACHE_FRAMES === 0);
    if (refreshPheno) {
        refreshPhenotypeCache(renderer, view, count, stride);
        renderer.phenoView = view;
        renderer.phenoCount = count;
    }
    renderer.phenoFrame++;

    for (let i = 0; i < renderer.pool.length; i++) {
        const particle = renderer.pool[i];
        const halo = renderer.haloPool[i];
        if (i >= count) {
            particle.alpha = 0;
            if (halo) halo.alpha = 0;
            continue;
        }

        const base = i * stride;
        if (view[base + STRIDE_INDEXES.DEAD] >= 0.99) {
            particle.alpha = 0;
            if (halo) halo.alpha = 0;
            continue;
        }

        const x = view[base + STRIDE_INDEXES.POS_X];
        const y = view[base + STRIDE_INDEXES.POS_Y];
        const z = view[base + STRIDE_INDEXES.POS_Z] || 0;
        if (x !== x || y !== y) {
            particle.alpha = 0;
            if (halo) halo.alpha = 0;
            continue;
        }

        const projected = projectPoint(x, y, z, worldSize, renderer.width, renderer.height);
        const { sx, sy, sr } = projected;
        if (sx < -CULL_MARGIN || sx > renderer.width + CULL_MARGIN
            || sy < -CULL_MARGIN || sy > renderer.height + CULL_MARGIN) {
            particle.alpha = 0;
            if (halo) halo.alpha = 0;
            continue;
        }

        const speciesId = view[base + STRIDE_INDEXES.SPECIES_ID];
        const color = eco
            ? {
                r: view[base + STRIDE_INDEXES.COLOR_R],
                g: view[base + STRIDE_INDEXES.COLOR_G],
                b: view[base + STRIDE_INDEXES.COLOR_B],
            }
            : usePhenoCache
                ? {
                    r: renderer.phenoColor[i * 3],
                    g: renderer.phenoColor[i * 3 + 1],
                    b: renderer.phenoColor[i * 3 + 2],
                }
                : computeColor(view, speciesId, i, stride);
        const radius = usePhenoCache
            ? renderer.phenoRadius[i]
            : computeRadius(view, speciesId, i, stride);
        const alpha = usePhenoCache
            ? renderer.phenoAlpha[i]
            : computeAlpha(view, speciesId, i, stride);
        if (alpha < 0.001) {
            particle.alpha = 0;
            if (halo) halo.alpha = 0;
            continue;
        }

        const screenRadius = Math.max(radius * uniformScale * sr, MIN_PARTICLE_RADIUS_PX);
        const scale = (screenRadius * 2) / TEXTURE_SIZE;
        const depthAlpha = alpha * (0.3 + 0.7 * sr) * runtimeConfig.globalAlpha;
        const tint = tintFromRgb(color.r, color.g, color.b);

        particle.x = sx;
        particle.y = sy;
        particle.scaleX = scale;
        particle.scaleY = scale;
        particle.tint = tint;
        particle.alpha = depthAlpha;

        if (halo) {
            halo.x = sx;
            halo.y = sy;
            halo.scaleX = scale * 2.4;
            halo.scaleY = scale * 2.4;
            halo.tint = tint;
            halo.alpha = depthAlpha * 0.3;
        }
    }

    renderer.app.render();
}

/** Run an optional WebGL flush for benchmark runs that request GPU completion. */
export function finishPixiFrame(renderer) {
    const gl = renderer?.app?.renderer?.gl;
    if (gl && typeof gl.finish === 'function') gl.finish();
}
