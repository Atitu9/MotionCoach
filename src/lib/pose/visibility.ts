import { VISION } from "@/config/thresholds";
import { POSE, type Landmarks } from "./types";

export function reliable(
  landmarks: Landmarks | null,
  indices: number[],
): boolean {
  return (
    !!landmarks &&
    indices.every((index) => {
      const point = landmarks[index];
      return (
        !!point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        (point.visibility ?? 1) >= VISION.minVisibility &&
        (point.presence ?? 1) >= VISION.minVisibility &&
        point.x > VISION.edgeMargin &&
        point.x < 1 - VISION.edgeMargin &&
        point.y > VISION.edgeMargin &&
        point.y < 1 - VISION.edgeMargin
      );
    })
  );
}

export function setupStatus(landmarks: Landmarks | null): {
  ready: boolean;
  message: string;
  confidence: number;
} {
  if (!landmarks?.length)
    return {
      ready: false,
      message: "Step into the camera frame.",
      confidence: 0,
    };
  const shoulders = [POSE.leftShoulder, POSE.rightShoulder];
  const hips = [POSE.leftHip, POSE.rightHip];
  const knees = [POSE.leftKnee, POSE.rightKnee];
  const ankles = [POSE.leftAnkle, POSE.rightAnkle];
  if (!reliable(landmarks, [POSE.nose, ...shoulders]))
    return {
      ready: false,
      message: "Move to the center so your head and shoulders are visible.",
      confidence: 0,
    };
  if (!reliable(landmarks, hips))
    return {
      ready: false,
      message: "Step back so your hips are visible.",
      confidence: 0,
    };
  if (!reliable(landmarks, knees))
    return {
      ready: false,
      message: "Step back so both knees are visible.",
      confidence: 0,
    };
  if (!reliable(landmarks, ankles))
    return {
      ready: false,
      message: "Step back — your ankles are outside the frame.",
      confidence: 0,
    };
  const indices: number[] = [
    POSE.nose,
    ...shoulders,
    ...hips,
    ...knees,
    ...ankles,
  ];
  const confidence =
    indices.reduce((sum, i) => sum + (landmarks[i].visibility ?? 1), 0) /
    indices.length;
  return {
    ready: true,
    message: "Camera ready. Hold both hands overhead to begin.",
    confidence,
  };
}

export function requiredFor(
  exercise: "squat" | "lunge" | "jumpingJack",
): number[] {
  const legs = [
    POSE.leftHip,
    POSE.rightHip,
    POSE.leftKnee,
    POSE.rightKnee,
    POSE.leftAnkle,
    POSE.rightAnkle,
  ];
  return exercise === "jumpingJack"
    ? [
        POSE.leftShoulder,
        POSE.rightShoulder,
        POSE.leftWrist,
        POSE.rightWrist,
        POSE.leftAnkle,
        POSE.rightAnkle,
      ]
    : [POSE.leftShoulder, POSE.rightShoulder, ...legs];
}
