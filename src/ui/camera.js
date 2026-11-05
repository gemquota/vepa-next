/**
 * VEPA v3 — 3D Camera + Touch/Mouse Controls
 * - 1 finger / mouse drag → pan
 * - 2 fingers → orbit rotation + pinch zoom
 * - Scroll wheel → zoom
 *
 * The camera orbits around its own pan target (the world point at screen
 * center), so rotating never swings around a distant origin.
 */
const camera = {
  x: 0,        // world point at screen center (pan target)
  y: 0,
  z: 0,
  zoom: 1.0,
  rotY: 0,       // horizontal orbit (radians) — straight on
  rotX: 0,       // vertical orbit (radians) — no tilt
  focalLength: 1200,   // perspective distance (focal point distance)
  ortho: 0,            // 0 = full perspective, 1 = fully orthographic
  rotateSensitivity: 1.0,  // multiplier for orbit gestures
  panSensitivity: 1.0,     // multiplier for pan gestures
};

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 100;
// Perspective strength is normalized to pixel-space depth so the projection
// looks the same regardless of world size and doesn't stretch when zooming.
// 0.5 keeps a gentle 3D depth cue without the inverted/stretched look that
// occurred when world-unit depth exceeded the focal length.
const PERSPECTIVE_STRENGTH = 0.5;
// Rotation speed per pixel of drag — higher = snappier orbiting.
const ROTATE_SCALE_MOUSE = 0.006;
const ROTATE_SCALE_TOUCH = 0.008;
// Two-finger centroid drift (px) ignored during a pinch so zooming doesn't pan.
const PAN_DEADZONE_PX = 10;

/**
 * Default zoom fits the whole world to the viewport — projectPoint normalizes
 * positions by world size, so zoom 1 shows the full dish at any world size.
 * Particles keep a minimum screen radius in the renderer so they stay visible
 * at this zoomed-out view; the wheel/pinch zoom in for close inspection.
 */
function fitZoomForWorld() {
  camera.zoom = 1.0;
}

// ── Internal state ──
let _canvas = null;
let _worldSize = 120;
const ptr = {
  mouseDown: false, mouseX: 0, mouseY: 0,
  touches: {},
  touchCount: 0,
  orbitLastX: 0, orbitLastY: 0,
  pinchDist: 0,
  panCenterX: 0, panCenterY: 0,
  panStartX: 0, panStartY: 0,
};

/**
 * Initialize camera controls on a canvas element.
 */
export function initCamera(canvas, worldSize) {
  if (!canvas) return;
  _canvas = canvas;
  if (typeof worldSize === 'number') _worldSize = worldSize;
  fitZoomForWorld();
  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

/**
 * Apply camera config overrides (from settings panel).
 * Accepts any subset of: focalLength, ortho, rotateSensitivity, panSensitivity.
 */
export function setCameraConfig(config) {
  if (!config) return;
  for (const key of ['focalLength', 'ortho', 'rotateSensitivity', 'panSensitivity']) {
    if (typeof config[key] === 'number' && Number.isFinite(config[key])) {
      camera[key] = config[key];
    }
  }
}

/** Update the world size used to convert screen pan deltas to world units. */
export function setWorldSize(worldSize) {
  if (typeof worldSize === 'number' && worldSize > 0) {
    _worldSize = worldSize;
    fitZoomForWorld();
  }
}

/** Screen px → world units at the current zoom level. */
function screenToWorld(dx, dy) {
  const w = _canvas ? _canvas.clientWidth : 360;
  const h = _canvas ? _canvas.clientHeight : 640;
  const scale = (Math.min(w, h) / _worldSize) * camera.zoom;
  return { wx: dx / scale, wy: dy / scale };
}

// ── Mouse orbit (pointer events, touch-typed ignored) ──

function panBy(dx, dy) {
  const { wx, wy } = screenToWorld(dx, dy);
  camera.x -= wx * camera.panSensitivity;
  camera.y -= wy * camera.panSensitivity;
}

function onPointerDown(e) {
  if (e.pointerType === 'touch') return;
  ptr.mouseDown = true;
  ptr.mouseX = e.clientX;
  ptr.mouseY = e.clientY;
}

function onPointerMove(e) {
  if (!ptr.mouseDown) return;
  const dx = e.clientX - ptr.mouseX;
  const dy = e.clientY - ptr.mouseY;
  panBy(dx, dy);
  ptr.mouseX = e.clientX;
  ptr.mouseY = e.clientY;
}

function onPointerUp() {
  ptr.mouseDown = false;
}

function onWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * delta));
}

// ── Touch gestures ──

function onTouchStart(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    ptr.touches[t.identifier] = { x: t.clientX, y: t.clientY };
  }
  ptr.touchCount = Object.keys(ptr.touches).length;

  if (ptr.touchCount === 1) {
    const t = e.touches[0];
    ptr.orbitLastX = t.clientX;
    ptr.orbitLastY = t.clientY;
  } else if (ptr.touchCount === 2) {
    beginPinchPan();
  }
}

function onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (ptr.touches[t.identifier]) {
      ptr.touches[t.identifier] = { x: t.clientX, y: t.clientY };
    }
  }
  ptr.touchCount = Object.keys(ptr.touches).length;

  if (ptr.touchCount === 1) {
    // 1 finger → pan
    const t = e.touches[0];
    const dx = t.clientX - ptr.orbitLastX;
    const dy = t.clientY - ptr.orbitLastY;
    panBy(dx, dy);
    ptr.orbitLastX = t.clientX;
    ptr.orbitLastY = t.clientY;
  } else if (ptr.touchCount >= 2) {
    doPinchRotate();
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    delete ptr.touches[t.identifier];
  }
  ptr.touchCount = Object.keys(ptr.touches).length;
  if (ptr.touchCount < 2) ptr.pinchDist = 0;
  if (ptr.touchCount === 1) {
    const t = e.touches[0];
    ptr.orbitLastX = t.clientX;
    ptr.orbitLastY = t.clientY;
  }
}

// ── 2-finger helpers ──

function beginPinchPan() {
  const ids = Object.keys(ptr.touches);
  const t0 = ptr.touches[ids[0]];
  const t1 = ptr.touches[ids[1]];
  const dx = t1.x - t0.x;
  const dy = t1.y - t0.y;
  ptr.pinchDist = Math.sqrt(dx * dx + dy * dy);
  ptr.pinchAngle = Math.atan2(dy, dx);
  ptr.panCenterX = (t0.x + t1.x) / 2;
  ptr.panCenterY = (t0.y + t1.y) / 2;
}

function doPinchRotate() {
  const ids = Object.keys(ptr.touches);
  const t0 = ptr.touches[ids[0]];
  const t1 = ptr.touches[ids[1]];
  const dx = t1.x - t0.x;
  const dy = t1.y - t0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Pinch zoom
  if (ptr.pinchDist > 0) {
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * (dist / ptr.pinchDist)));
  }

  // Two-finger rotation → orbit (horizontal), centroid drift → vertical orbit
  let dAngle = angle - ptr.pinchAngle;
  if (dAngle > Math.PI) dAngle -= Math.PI * 2;
  else if (dAngle < -Math.PI) dAngle += Math.PI * 2;
  camera.rotY -= dAngle * 2.2;
  const centerY = (t0.y + t1.y) / 2;
  const driftY = centerY - ptr.panCenterY;
  camera.rotX = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, camera.rotX + driftY * ROTATE_SCALE_TOUCH * 0.5));

  ptr.pinchDist = dist;
  ptr.pinchAngle = angle;
  ptr.panCenterY = centerY;
}

/**
 * Apply camera transform to a world-space point.
 * Returns { sx, sy, sr } screen-space position and radius scale.
 */
export function projectPoint(x, y, z, worldSize, width, height) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const scale = Math.min(width, height) / worldSize;
  const halfWorld = worldSize * 0.5;

  // Center the world at origin, then move the camera target to origin
  let px = x - halfWorld - camera.x;
  let py = y - halfWorld - camera.y;
  let pz = z - halfWorld - camera.z;

  // Rotate around Y axis (horizontal orbit) — orbits the camera target
  const cosY = Math.cos(camera.rotY);
  const sinY = Math.sin(camera.rotY);
  const rx1 = px * cosY - pz * sinY;
  const rz1 = px * sinY + pz * cosY;
  const ry1 = py;

  // Rotate around X axis (vertical orbit)
  const cosX = Math.cos(camera.rotX);
  const sinX = Math.sin(camera.rotX);
  const rx2 = rx1;
  const ry2 = ry1 * cosX - rz1 * sinX;
  const rz2 = ry1 * sinX + rz1 * cosX;

  // Perspective projection (blended toward orthographic by camera.ortho).
  // Depth is normalized to pixel space (world units × px/unit) so perspective
  // strength is stable across world sizes and zoom levels — no stretching.
  const focal = camera.focalLength;
  const depthPx = rz2 * scale * PERSPECTIVE_STRENGTH;
  const persp = focal / (focal + depthPx);
  const effPersp = persp + (1.0 - persp) * camera.ortho;
  const screenX = cx + (rx2 * scale * camera.zoom) * effPersp;
  const screenY = cy + (ry2 * scale * camera.zoom) * effPersp;
  const radiusScale = effPersp * camera.zoom;

  return { sx: screenX, sy: screenY, sr: radiusScale };
}

/**
 * Reset camera to the default 3D-friendly view.
 */
export function resetCamera() {
  camera.x = 0;
  camera.y = 0;
  camera.z = 0;
  fitZoomForWorld();
  camera.rotY = 0;
  camera.rotX = 0;
  camera.focalLength = 1200;
  camera.ortho = 0;
  camera.rotateSensitivity = 1.0;
  camera.panSensitivity = 1.0;
}

export default camera;
