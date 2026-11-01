// ============================================================================
// VEPA v3 — Sprite Sync
// Bridges particle buffer state → visual representation each frame.
//
// Canvas2D mode:  delegates straight to renderFrame (full redraw).
// PixiJS mode:    would iterate alive particles and update sprite position,
//                 tint, alpha, and scale in-place (no full redraw needed).
//
// The public API is renderer-agnostic — the dispatcher checks renderer.mode
// and routes accordingly.
// ============================================================================

import { STRIDE_INDEXES, LAW_INDEXES, LAW_CATEGORIES } from '../constants.js';
import { renderFrame } from './renderer.js';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Synchronize all particle visuals to the current buffer state.
 *
 * Called once per frame by the orchestrator after the physics worker has
 * written new positions and before the browser composites.
 *
 * @param {object}   renderer       - Renderer state (from createRenderer)
 * @param {SharedArrayBuffer|Float32Array} particleBuffer - Particle storage
 * @param {number}   particleCount  - Active particle count (indices 0..count-1)
 * @param {number}   stride         - Floats per particle
 * @param {number}   worldSize      - World coordinate extent for scaling
 * @param {object}   lawState       - { lowFlags, highFlags } bitmask state
 *   Used by PixiJS mode for law-dependent visual effects (e.g. GLOW law
 *   enables additive blending, CHAOS law jitters positions).
 *   Canvas2D mode currently ignores lawState but it is accepted for API
 *   uniformity.
 */
export function syncSprites(renderer, particleBuffer, particleCount, stride, worldSize, lawState) {
    if (!renderer || !renderer.ctx && !renderer.sprites) return;

    if (renderer.mode === 'canvas2d') {
        syncCanvas2D(renderer, particleBuffer, particleCount, stride, worldSize, lawState);
    } else {
        // Future: PixiJS sprite pool sync
        syncPixiJS(renderer, particleBuffer, particleCount, stride, worldSize, lawState);
    }
}

// ── Canvas2D Path ──────────────────────────────────────────────────────────

/**
 * Full-frame Canvas2D redraw.
 *
 * This is a straightforward pass-through to renderFrame.  The lawState is
 * inspected for global visual modifiers that affect the draw context before
 * the particle loop:
 *
 *  - GLOW law  → brightens the background slightly for a softer look
 *  - CHAOS law → adds a subtle hue-shift to the background
 */
function syncCanvas2D(renderer, particleBuffer, particleCount, stride, worldSize, lawState) {
    const { ctx, width, height } = renderer;

    // ── Core render ──
    renderFrame(renderer, particleBuffer, particleCount, stride, worldSize);

    // ── Post-draw law effects ──
    if (lawState && isLawActive(lawState, LAW_INDEXES.GLOW)) {
        // GLOW law: warm additive lift over the finished frame (subtle, so
        // it doesn't wash out the motion trails).
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(15, 10, 25, 0.08)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
    if (lawState) {
        drawLawOverlays(ctx, width, height, lawState);
    }
}

// ── PixiJS Path (future) ───────────────────────────────────────────────────

/**
 * PixiJS sprite pool sync — placeholder for Phase 4.
 *
 * In the PixiJS mode, this would:
 *  1. Maintain a sprite pool of maxParticles sprites
 *  2. For each alive particle, update:
 *     - sprite.position (POS_X, POS_Y scaled to screen)
 *     - sprite.tint (from computeColor → hex)
 *     - sprite.alpha (from computeAlpha)
 *     - sprite.scale.set(radius × scaleFactor)
 *  3. Hide dead particles (sprite.visible = false or alpha = 0)
 *  4. Apply law-dependent effects:
 *     - CHAOS: add per-frame position jitter
 *     - GLOW: set blendMode to additive
 *     - TIME_DILATION: scale animation speed
 */
function syncPixiJS(_renderer, _particleBuffer, _particleCount, _stride, _worldSize, _lawState) {
    // Not yet implemented — requires PixiJS 8.x Application and sprite pool.
    // When implemented, this function will be the hot loop for visual sync.
}

// ── Law Utilities ──────────────────────────────────────────────────────────

/**
 * Check if a specific law is active in the bitmask state.
 */
function isLawActive(lawState, lawIndex) {
    if (lawIndex < 32) {
        return (lawState.lowFlags[0] & (1 << lawIndex)) !== 0;
    }
    return (lawState.highFlags[0] & (1 << (lawIndex - 32))) !== 0;
}

/**
 * Draw subtle full-screen overlays driven by active laws.
 *
 * These are lightweight 2D effects layered on top of the particle render.
 * Each law that is active adds its visual contribution.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {object} lawState - { lowFlags, highFlags }
 */
function drawLawOverlays(ctx, width, height, lawState) {
    ctx.save();

    // CHAOS law: subtle scanline interference pattern
    if (isLawActive(lawState, LAW_INDEXES.CHAOS)) {
        ctx.globalAlpha = 0.04;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 4) {
            if (Math.random() > 0.7) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }
    }

    // TIME_DILATION law: faint blue vignette suggesting temporal distortion
    if (isLawActive(lawState, LAW_INDEXES.TIME_DILATION)) {
        const grad = ctx.createRadialGradient(
            width * 0.5, height * 0.5, Math.min(width, height) * 0.3,
            width * 0.5, height * 0.5, Math.max(width, height) * 0.7
        );
        grad.addColorStop(0, 'rgba(30, 60, 120, 0)');
        grad.addColorStop(1, 'rgba(30, 60, 120, 0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    // SOUL_LAW law: ethereal purple mist at screen edges
    if (isLawActive(lawState, LAW_INDEXES.SOUL_LAW)) {
        const grad = ctx.createRadialGradient(
            width * 0.5, height * 0.5, Math.min(width, height) * 0.4,
            width * 0.5, height * 0.5, Math.max(width, height) * 0.75
        );
        grad.addColorStop(0, 'rgba(80, 30, 120, 0)');
        grad.addColorStop(1, 'rgba(80, 30, 120, 0.06)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
}
