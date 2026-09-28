import { POSE, type FormError, type Landmarks } from "./types";

const BONES: [number, number][] = [
  [POSE.leftShoulder, POSE.rightShoulder],
  [POSE.leftShoulder, POSE.leftElbow],
  [POSE.leftElbow, POSE.leftWrist],
  [POSE.rightShoulder, POSE.rightElbow],
  [POSE.rightElbow, POSE.rightWrist],
  [POSE.leftShoulder, POSE.leftHip],
  [POSE.rightShoulder, POSE.rightHip],
  [POSE.leftHip, POSE.rightHip],
  [POSE.leftHip, POSE.leftKnee],
  [POSE.leftKnee, POSE.leftAnkle],
  [POSE.rightHip, POSE.rightKnee],
  [POSE.rightKnee, POSE.rightAnkle],
];

export function drawPose(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: Landmarks | null,
  error: FormError | null,
): void {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width,
    height = rect.height;
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(width * dpr) ||
    canvas.height !== Math.round(height * dpr)
  ) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!landmarks || !video.videoWidth || !video.videoHeight) return;
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  const contentWidth = video.videoWidth * scale;
  const contentHeight = video.videoHeight * scale;
  const x0 = (width - contentWidth) / 2;
  const y0 = (height - contentHeight) / 2;
  const xy = (index: number): [number, number] => [
    x0 + landmarks[index].x * contentWidth,
    y0 + landmarks[index].y * contentHeight,
  ];
  const visible = (index: number) =>
    !!landmarks[index] && (landmarks[index].visibility ?? 1) > 0.45;
  const highlighted = new Set(error?.joints ?? []);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [a, b] of BONES) {
    if (!visible(a) || !visible(b)) continue;
    const [ax, ay] = xy(a),
      [bx, by] = xy(b);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineWidth = highlighted.has(a) || highlighted.has(b) ? 5 : 3;
    ctx.strokeStyle =
      highlighted.has(a) || highlighted.has(b) ? "#ff8c63" : "#c8fa5f";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const index of new Set(BONES.flat())) {
    if (!visible(index)) continue;
    const [x, y] = xy(index);
    ctx.beginPath();
    ctx.arc(x, y, highlighted.has(index) ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = highlighted.has(index) ? "#ff8c63" : "#e5ffae";
    ctx.fill();
    if (highlighted.has(index)) {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,140,99,.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
