/**
 * emotionRules — 1:1 port of backend/utils/interview_detection_ai/face_analyzer.py
 * (blendshape→emotion rules, iris-based head pose, overlay geometry).
 * Payload shape MUST stay identical to the server engine's WebSocket payload.
 */

export const LOOKING_THRESHOLD_DEGREES = 5.5;
export const EMOTION_THRESHOLD = 0.20;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round4 = (v) => Math.round(v * 10000) / 10000;
const makePoint = (x, y) => ({ x: round4(x), y: round4(y) });

const score = (b, name) => b[name] ?? 0;
const avg = (b, ...names) => names.reduce((s, n) => s + score(b, n), 0) / names.length;

export function pickDominantEmotion(blendshapes) {
  const scores = {
    joy:       avg(blendshapes, 'mouthSmileLeft', 'mouthSmileRight'),
    surprise:  avg(blendshapes, 'browInnerUp', 'jawOpen'),
    anger:     avg(blendshapes, 'browDownLeft', 'browDownRight', 'noseSneerLeft', 'noseSneerRight'),
    disgust:   avg(blendshapes, 'noseSneerLeft', 'noseSneerRight', 'mouthFrownLeft', 'mouthFrownRight'),
    fear:      avg(blendshapes, 'eyeWideLeft', 'eyeWideRight', 'browInnerUp'),
    sadness:   avg(blendshapes, 'mouthFrownLeft', 'mouthFrownRight', 'browInnerUp'),
    confusion: avg(blendshapes, 'browInnerUp', 'eyeSquintLeft', 'eyeSquintRight'),
  };
  let label = 'neutral';
  let best = -Infinity;
  for (const [name, value] of Object.entries(scores)) {
    if (value > best) { best = value; label = name; }
  }
  return best >= EMOTION_THRESHOLD ? label : 'neutral';
}

function irisGaze(iris, outer, inner, top, bottom) {
  const eyeW = Math.max(Math.abs(inner.x - outer.x), 1e-6);
  const eyeH = Math.max(Math.abs(bottom.y - top.y), 1e-6);
  const h = (iris.x - Math.min(outer.x, inner.x)) / eyeW - 0.5;
  const v = (iris.y - Math.min(top.y, bottom.y)) / eyeH - 0.5;
  return [h, v];
}

export function calculateHeadPose(landmarks) {
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const [lh, lv] = irisGaze(leftIris, landmarks[33], landmarks[133], landmarks[159], landmarks[145]);
  const [rh, rv] = irisGaze(rightIris, landmarks[362], landmarks[263], landmarks[386], landmarks[374]);
  return { yaw: ((lh + rh) / 2.0) * 90.0, pitch: ((lv + rv) / 2.0) * 90.0 };
}

export function buildOverlay(landmarks, yaw, pitch) {
  const leftIris = landmarks[468];
  const rightIris = landmarks[473];
  const midX = (leftIris.x + rightIris.x) / 2.0;
  const midY = (leftIris.y + rightIris.y) / 2.0;
  const yawOffset = Math.sin((yaw * Math.PI) / 180) * 0.12;
  const pitchOffset = Math.sin((pitch * Math.PI) / 180) * 0.08;
  return {
    landmarks: landmarks.map((p) => makePoint(p.x, p.y)),
    pose_line: {
      from: makePoint(midX, midY),
      to: makePoint(clamp(midX + yawOffset, 0.0, 1.0), clamp(midY - pitchOffset, 0.0, 1.0)),
    },
  };
}

export function noFacePayload(frameId) {
  return {
    frame_id: frameId,
    status: 'no_face',
    is_looking_at_screen: false,
    dominant_emotion: 'neutral',
    yaw: null,
    pitch: null,
    overlay: { landmarks: [], pose_line: null },
  };
}

export function analyzeResult(result, frameId) {
  const faces = result?.faceLandmarks;
  if (!faces || faces.length === 0) return noFacePayload(frameId);

  const landmarks = faces[0];
  const { yaw, pitch } = calculateHeadPose(landmarks);

  const blendshapes = {};
  for (const c of result.faceBlendshapes?.[0]?.categories ?? []) {
    blendshapes[c.categoryName] = c.score;
  }

  return {
    frame_id: frameId,
    status: 'ok',
    is_looking_at_screen:
      Math.abs(yaw) <= LOOKING_THRESHOLD_DEGREES && Math.abs(pitch) <= LOOKING_THRESHOLD_DEGREES,
    dominant_emotion: pickDominantEmotion(blendshapes),
    yaw: Math.round(yaw * 100) / 100,
    pitch: Math.round(pitch * 100) / 100,
    overlay: buildOverlay(landmarks, yaw, pitch),
  };
}
