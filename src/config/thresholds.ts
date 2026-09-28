export const CHALLENGE = {
  production: { squat: 10, lunge: 10, jumpingJack: 15 },
  development: { squat: 3, lunge: 3, jumpingJack: 5 },
} as const;

// Set NEXT_PUBLIC_SHORT_CHALLENGE=true for a short calibration run.
export const TARGETS =
  process.env.NEXT_PUBLIC_SHORT_CHALLENGE === "true"
    ? CHALLENGE.development
    : CHALLENGE.production;

export const DEBUG = process.env.NEXT_PUBLIC_DEBUG_POSE === "true";

export const VISION = {
  minVisibility: 0.55,
  edgeMargin: 0.025,
  smoothingAlpha: 0.48,
  setupStableMs: 1100,
  gestureHoldMs: 1250,
  lostTrackingResetMs: 850,
  inferenceIntervalMs: 55,
  feedbackPersistenceMs: 300,
  feedbackCooldownMs: 1600,
};

export const SQUAT = {
  standingAngle: 158,
  startAngle: 145,
  bottomAngle: 112,
  ascentAngle: 132,
  minPhaseMs: 130,
  minRepMs: 600,
  shallowTurnDegrees: 12,
  torsoLeanDegrees: 38,
  kneeAsymmetryDegrees: 30,
};

export const LUNGE = {
  standingAngle: 155,
  startAngle: 145,
  bottomAngle: 115,
  minAsymmetryDegrees: 14,
  minPhaseMs: 130,
  minRepMs: 600,
  shallowTurnDegrees: 12,
  torsoOffsetRatio: 0.62,
};

export const JACK = {
  closedFeetRatio: 1.45,
  openFeetRatio: 2.05,
  armsLowOffset: 0.04,
  armsHighOffset: 0.08,
  minPhaseMs: 120,
  minRepMs: 500,
};
