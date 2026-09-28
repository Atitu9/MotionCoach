import assert from "node:assert/strict";
import test from "node:test";
import { SquatDetector } from "../exercises/squatDetector";
import { LungeDetector } from "../exercises/lungeDetector";
import { JumpingJackDetector } from "../exercises/jumpingJackDetector";
import { calculateAngle, calculateAngle3D } from "../pose/geometry";
import { setupStatus } from "../pose/visibility";
import { POSE, type Landmarks } from "../pose/types";
import { WorkoutMachine } from "./workoutMachine";

function imagePose(): Landmarks {
  const points: Landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
    presence: 1,
  }));
  points[POSE.nose] = { x: 0.5, y: 0.12, visibility: 1 };
  points[POSE.leftShoulder] = { x: 0.4, y: 0.26, visibility: 1 };
  points[POSE.rightShoulder] = { x: 0.6, y: 0.26, visibility: 1 };
  points[POSE.leftHip] = { x: 0.43, y: 0.48, visibility: 1 };
  points[POSE.rightHip] = { x: 0.57, y: 0.48, visibility: 1 };
  points[POSE.leftKnee] = { x: 0.43, y: 0.67, visibility: 1 };
  points[POSE.rightKnee] = { x: 0.57, y: 0.67, visibility: 1 };
  points[POSE.leftAnkle] = { x: 0.43, y: 0.87, visibility: 1 };
  points[POSE.rightAnkle] = { x: 0.57, y: 0.87, visibility: 1 };
  points[POSE.leftWrist] = { x: 0.28, y: 0.49, visibility: 1 };
  points[POSE.rightWrist] = { x: 0.72, y: 0.49, visibility: 1 };
  return points;
}

function worldPose(leftAngle: number, rightAngle = leftAngle): Landmarks {
  const points = imagePose();
  for (const [hip, knee, ankle, x, angle] of [
    [POSE.leftHip, POSE.leftKnee, POSE.leftAnkle, -0.15, leftAngle],
    [POSE.rightHip, POSE.rightKnee, POSE.rightAnkle, 0.15, rightAngle],
  ] as const) {
    const rad = (angle * Math.PI) / 180;
    points[hip] = { x, y: 0, z: 0, visibility: 1 };
    points[knee] = { x, y: 1, z: 0, visibility: 1 };
    points[ankle] = {
      x: x + Math.sin(rad),
      y: 1 - Math.cos(rad),
      z: 0,
      visibility: 1,
    };
  }
  return points;
}

test("geometry clamps and rejects degenerate angles", () => {
  assert.equal(
    calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
    180,
  );
  assert.equal(
    calculateAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }),
    null,
  );
  assert.ok(
    Math.abs(
      (calculateAngle3D(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ) ?? 0) - 90,
    ) < 0.01,
  );
});

test("a squat counts once only after reaching depth and standing", () => {
  const detector = new SquatDetector();
  const p = imagePose();
  const sequence = [
    [0, 175],
    [100, 140],
    [300, 105],
    [500, 100],
    [700, 137],
    [1000, 165],
    [1150, 170],
  ];
  const attempts = sequence.flatMap(([now, angle]) => {
    const result = detector.update(p, now, 1, worldPose(angle));
    return result.attempt ? [result.attempt] : [];
  });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].valid, true);
});

test("a shallow squat produces an invalid attempt", () => {
  const detector = new SquatDetector();
  const p = imagePose();
  const sequence = [
    [0, 175],
    [100, 140],
    [300, 130],
    [470, 146],
    [800, 165],
  ];
  const attempts = sequence.flatMap(([now, angle]) => {
    const result = detector.update(p, now, 1, worldPose(angle));
    return result.attempt ? [result.attempt] : [];
  });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].valid, false);
  assert.equal(attempts[0].errors[0].id, "shallow_squat");
});

test("a lunge needs one bent leg, depth, and a standing return", () => {
  const detector = new LungeDetector();
  const p = imagePose();
  const sequence = [
    [0, 170, 170],
    [100, 140, 170],
    [300, 105, 165],
    [500, 100, 165],
    [700, 140, 165],
    [1000, 165, 168],
  ];
  const attempts = sequence.flatMap(([now, left, right]) => {
    const result = detector.update(p, now, 1, worldPose(left, right));
    return result.attempt ? [result.attempt] : [];
  });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].valid, true);
});

test("jumping jack requires both open and closed positions", () => {
  const detector = new JumpingJackDetector();
  const closed = imagePose();
  const opened = imagePose();
  opened[POSE.leftAnkle] = { x: 0.18, y: 0.87, visibility: 1 };
  opened[POSE.rightAnkle] = { x: 0.82, y: 0.87, visibility: 1 };
  opened[POSE.leftWrist] = { x: 0.23, y: 0.1, visibility: 1 };
  opened[POSE.rightWrist] = { x: 0.77, y: 0.1, visibility: 1 };
  assert.equal(detector.update(closed, 0, 1).attempt, undefined);
  detector.update(opened, 100, 1);
  detector.update(opened, 260, 1);
  detector.update(closed, 430, 1);
  const result = detector.update(closed, 640, 1);
  assert.equal(result.attempt?.valid, true);
  assert.equal(detector.update(closed, 800, 1).attempt, undefined);
});

test("missing ankles block setup and workout counting", () => {
  const p = imagePose();
  p[POSE.leftAnkle].visibility = 0.1;
  assert.equal(setupStatus(p).ready, false);
  const machine = new WorkoutMachine();
  machine.cameraReady(0);
  assert.equal(machine.update(p, 1500, 1).stage, "camera_setup");
});
