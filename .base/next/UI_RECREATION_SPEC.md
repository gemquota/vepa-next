# VEPA browser UI recreation specification

## Visual direction
Recreate the recognizable VEPA4 laboratory aesthetic, not the unrelated full-screen particle-life prototype. The world remains the visual centre, but its instrumentation is part of the product.

Preserve the dark, high-contrast scientific interface; restrained accent colors; compact data-rich controls; categorized law controls and help; HUD/debug visibility; bottom drawer and minimize/restore affordance; world setup, species/DNA, ecology/intelligence, presets and save surfaces; particle palette, depth cues, field overlays and camera feel.

Improve hierarchy, spacing, typography, focus states, responsive behavior, searchable law catalog, active counts, pending/committed/unsupported/failed states, contextual help and touch targets without replacing the visual identity.

## Primary layout
1. World viewport: canvas, camera, selection, field/law overlays.
2. Top HUD/status: running/paused, tick/time, population, active laws, performance and worker state.
3. Collapsible debug overlay: bounded logs, copy/export and persisted visibility.
4. Bottom drawer: existing tab strip and minimize control; setup, data, intelligence, save and other source-confirmed panels.
5. Setup: world/environment, laws, species/DNA, performance, time and matter.
6. Data: population/ecology, species, DNA, groups/civilizations, intelligence, narrative and timeline.
7. Dialogs/popovers: presets, save/load/import/export, confirmations and help.

Exact labels, order, icons, default drawer height, breakpoints and CSS values must be extracted from the pinned source and baseline screenshots before implementation.

## Interaction contracts
- Every visible control maps to a named semantic command.
- UI sends commands to an application coordinator; it never mutates particle arrays directly.
- Display committed values, not merely requested values.
- Failed changes leave the last-known-good world intact and show a recoverable error.
- Worker configuration is synchronized before the next tick.
- Pause/resume, reseed, reset, presets, save/load, law toggles, sliders and bulk operations work in worker and fallback modes.
- Tooltips/help derive from canonical law and trait metadata.
- Keyboard navigation, visible focus, labels, reduced motion and touch operation are required.

## Responsive behavior
- Desktop: full world viewport with compact instrumentation and bottom drawer.
- Tablet: panels adapt without obscuring the world.
- Mobile: controls become a navigable drawer/sheet; no horizontal overflow; touch camera gestures do not conflict with panel scrolling.

## Verification
Compare screenshots at pinned viewport sizes. Browser-test primary controls and panels. Smoke-test focus order, labels and keyboard behavior. Regress drawer minimize, camera gestures, zoom/pan, resizing and overlays. Exercise a complete workflow: boot, toggle law, adjust world, inspect species, save, reload and continue.
