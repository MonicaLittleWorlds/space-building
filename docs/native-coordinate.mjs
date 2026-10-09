/** Canonical coordinate-stage helpers.
 * world/normalizedWorld are logical room coordinates; cameraGrid is only the
 * camera projection stage.  Nothing in this module mutates authored state.
 */
export function cameraGridPosition(x, z, step = 0, { maxX = 0, maxZ = 0, pivotX = null, pivotZ = null } = {}) {
  const s = ((Number(step) || 0) % 4 + 4) % 4;
  if (pivotX !== null && pivotZ !== null) {
    switch (s) {
      case 1: return { rx: pivotX + pivotZ - z, rz: pivotZ + x - pivotX };
      case 2: return { rx: 2 * pivotX - x, rz: 2 * pivotZ - z };
      case 3: return { rx: pivotX + z - pivotZ, rz: pivotZ + pivotX - x };
      default: return { rx: x, rz: z };
    }
  }
  switch (s) {
    case 1: return { rx: maxZ - z, rz: x };
    case 2: return { rx: maxX - x, rz: maxZ - z };
    case 3: return { rx: z, rz: maxX - x };
    default: return { rx: x, rz: z };
  }
}

export function inverseCameraGridPosition(rx, rz, step = 0, opts = {}) {
  const s = ((Number(step) || 0) % 4 + 4) % 4;
  const { maxX = 0, maxZ = 0, pivotX = null, pivotZ = null } = opts;
  if (pivotX !== null && pivotZ !== null) {
    switch (s) {
      case 1: return { wx: pivotX + rz - pivotZ, wz: pivotZ + pivotX - rx };
      case 2: return { wx: 2 * pivotX - rx, wz: 2 * pivotZ - rz };
      case 3: return { wx: pivotX + pivotZ - rz, wz: pivotZ + rx - pivotX };
      default: return { wx: rx, wz: rz };
    }
  }
  switch (s) {
    case 1: return { wx: rz, wz: maxZ - rx };
    case 2: return { wx: maxX - rx, wz: maxZ - rz };
    case 3: return { wx: maxX - rz, wz: rx };
    default: return { wx: rx, wz: rz };
  }
}

/** Convert persisted/authored room coordinates into the renderer's zero-based grid. */
export function authoredToRoomPosition(x, z, originX = 0, originZ = 0) {
  return {
    x: Number(x) - Number(originX || 0),
    z: Number(z) - Number(originZ || 0),
  };
}

/** Convert the renderer's zero-based grid back to persisted/authored coordinates. */
export function roomToAuthoredPosition(x, z, originX = 0, originZ = 0) {
  return {
    x: Number(x) + Number(originX || 0),
    z: Number(z) + Number(originZ || 0),
  };
}

/** The single logical-grid -> isometric-screen projection used by rooms,
 * local/remote avatars, placed items, interaction geometry and diagnostics. */
export function gridToScreen(x, z, halfWidth = 64, halfHeight = 32) {
  const worldX = Number(x);
  const worldZ = Number(z);
  return {
    sx: ((Number.isFinite(worldX) ? worldX : 0) - (Number.isFinite(worldZ) ? worldZ : 0)) * halfWidth,
    sy: ((Number.isFinite(worldX) ? worldX : 0) + (Number.isFinite(worldZ) ? worldZ : 0)) * halfHeight,
  };
}
