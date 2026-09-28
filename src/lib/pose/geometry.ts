import type { Landmark } from "./types";

export function distance(a: Landmark, b: Landmark, aspect = 1): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

export function normalizedDistance(
  a: Landmark,
  b: Landmark,
  reference: number,
  aspect = 1,
): number {
  return reference > 0 ? distance(a, b, aspect) / reference : 0;
}

export function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}

export function verticalDifference(a: Landmark, b: Landmark): number {
  return a.y - b.y;
}
export function horizontalDifference(
  a: Landmark,
  b: Landmark,
  aspect = 1,
): number {
  return (a.x - b.x) * aspect;
}

export function calculateAngle(
  a: Landmark,
  b: Landmark,
  c: Landmark,
  aspect = 1,
): number | null {
  const ax = (a.x - b.x) * aspect,
    ay = a.y - b.y;
  const cx = (c.x - b.x) * aspect,
    cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (!Number.isFinite(length) || length < 1e-8) return null;
  const cosine = Math.max(-1, Math.min(1, (ax * cx + ay * cy) / length));
  const degrees = (Math.acos(cosine) * 180) / Math.PI;
  return Number.isFinite(degrees) ? degrees : null;
}

export function calculateAngle3D(
  a: Landmark,
  b: Landmark,
  c: Landmark,
): number | null {
  const ax = a.x - b.x,
    ay = a.y - b.y,
    az = (a.z ?? 0) - (b.z ?? 0);
  const cx = c.x - b.x,
    cy = c.y - b.y,
    cz = (c.z ?? 0) - (b.z ?? 0);
  const length = Math.hypot(ax, ay, az) * Math.hypot(cx, cy, cz);
  if (!Number.isFinite(length) || length < 1e-8) return null;
  const cosine = Math.max(
    -1,
    Math.min(1, (ax * cx + ay * cy + az * cz) / length),
  );
  const degrees = (Math.acos(cosine) * 180) / Math.PI;
  return Number.isFinite(degrees) ? degrees : null;
}

export function torsoLean(
  shoulders: Landmark,
  hips: Landmark,
  aspect = 1,
): number {
  return (
    (Math.atan2(
      Math.abs((shoulders.x - hips.x) * aspect),
      Math.abs(shoulders.y - hips.y),
    ) *
      180) /
    Math.PI
  );
}

export function torsoForwardLean(shoulders: Landmark, hips: Landmark): number {
  return (
    (Math.atan2(
      Math.abs((shoulders.z ?? 0) - (hips.z ?? 0)),
      Math.abs(shoulders.y - hips.y),
    ) *
      180) /
    Math.PI
  );
}

export function bodyScale(
  shoulderLeft: Landmark,
  shoulderRight: Landmark,
  hipLeft: Landmark,
  hipRight: Landmark,
  aspect = 1,
): number {
  const shoulderWidth = distance(shoulderLeft, shoulderRight, aspect);
  const torso = distance(
    midpoint(shoulderLeft, shoulderRight),
    midpoint(hipLeft, hipRight),
    aspect,
  );
  return Math.max(shoulderWidth, torso, 1e-6);
}
