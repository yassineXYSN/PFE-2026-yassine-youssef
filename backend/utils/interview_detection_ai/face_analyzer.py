import asyncio
import base64
import math
import threading
from pathlib import Path
from typing import Any

import cv2
import mediapipe as mp
import numpy as np

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
FaceLandmarkerResult = mp.tasks.vision.FaceLandmarkerResult
RunningMode = mp.tasks.vision.RunningMode

MODEL_PATH = Path(__file__).resolve().parent / "models" / "face_landmarker.task"
LOOKING_THRESHOLD_DEGREES = 5.5
EMOTION_THRESHOLD = 0.20


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def make_point(x: float, y: float) -> dict[str, float]:
    return {"x": round(float(x), 4), "y": round(float(y), 4)}


def extract_base64_payload(data_url: str) -> str:
    return data_url.split(",", 1)[1] if "," in data_url else data_url


def decode_base64_frame(image_data: str) -> np.ndarray:
    try:
        encoded_bytes = base64.b64decode(extract_base64_payload(image_data))
    except Exception as exc:
        raise ValueError("Invalid base64 image payload.") from exc

    frame_buffer = np.frombuffer(encoded_bytes, dtype=np.uint8)
    bgr_frame = cv2.imdecode(frame_buffer, cv2.IMREAD_COLOR)
    if bgr_frame is None:
        raise ValueError("Could not decode JPEG frame with OpenCV.")
    return cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)


def _score(blendshapes: dict[str, float], name: str) -> float:
    return float(blendshapes.get(name, 0.0))


def _avg(blendshapes: dict[str, float], *names: str) -> float:
    return sum(_score(blendshapes, name) for name in names) / len(names)


def pick_dominant_emotion(blendshapes: dict[str, float]) -> str:
    scores = {
        "joy": _avg(blendshapes, "mouthSmileLeft", "mouthSmileRight"),
        "surprise": _avg(blendshapes, "browInnerUp", "jawOpen"),
        "anger": _avg(blendshapes, "browDownLeft", "browDownRight", "noseSneerLeft", "noseSneerRight"),
        "disgust": _avg(blendshapes, "noseSneerLeft", "noseSneerRight", "mouthFrownLeft", "mouthFrownRight"),
        "fear": _avg(blendshapes, "eyeWideLeft", "eyeWideRight", "browInnerUp"),
        "sadness": _avg(blendshapes, "mouthFrownLeft", "mouthFrownRight", "browInnerUp"),
        "confusion": _avg(blendshapes, "browInnerUp", "eyeSquintLeft", "eyeSquintRight"),
    }
    label, score = max(scores.items(), key=lambda item: item[1])
    return label if score >= EMOTION_THRESHOLD else "neutral"


def _iris_gaze(iris: Any, outer: Any, inner: Any, top: Any, bottom: Any) -> tuple[float, float]:
    eye_w = max(abs(inner.x - outer.x), 1e-6)
    eye_h = max(abs(bottom.y - top.y), 1e-6)
    h = (iris.x - min(outer.x, inner.x)) / eye_w - 0.5
    v = (iris.y - min(top.y, bottom.y)) / eye_h - 0.5
    return h, v


def calculate_head_pose(landmarks: list[Any]) -> tuple[float, float]:
    left_iris = landmarks[468]
    right_iris = landmarks[473]
    left_outer, left_inner = landmarks[33], landmarks[133]
    right_inner, right_outer = landmarks[362], landmarks[263]
    left_top, left_bottom = landmarks[159], landmarks[145]
    right_top, right_bottom = landmarks[386], landmarks[374]
    lh, lv = _iris_gaze(left_iris, left_outer, left_inner, left_top, left_bottom)
    rh, rv = _iris_gaze(right_iris, right_inner, right_outer, right_top, right_bottom)
    return ((lh + rh) / 2.0) * 90.0, ((lv + rv) / 2.0) * 90.0


def build_overlay(landmarks: list[Any], yaw: float, pitch: float) -> dict[str, Any]:
    left_iris = landmarks[468]
    right_iris = landmarks[473]
    mid_x = (left_iris.x + right_iris.x) / 2.0
    mid_y = (left_iris.y + right_iris.y) / 2.0
    yaw_offset = math.sin(math.radians(yaw)) * 0.12
    pitch_offset = math.sin(math.radians(pitch)) * 0.08
    return {
        "landmarks": [make_point(point.x, point.y) for point in landmarks],
        "pose_line": {
            "from": make_point(mid_x, mid_y),
            "to": make_point(clamp(mid_x + yaw_offset, 0.0, 1.0), clamp(mid_y - pitch_offset, 0.0, 1.0)),
        },
    }


def build_no_face_payload(frame_id: int | None) -> dict[str, Any]:
    return {
        "frame_id": frame_id,
        "status": "no_face",
        "is_looking_at_screen": False,
        "dominant_emotion": "neutral",
        "yaw": None,
        "pitch": None,
        "overlay": {"landmarks": [], "pose_line": None},
    }


def build_error_payload(frame_id: int | None, message: str) -> dict[str, Any]:
    payload = build_no_face_payload(frame_id)
    payload.update({"status": "error", "error": message})
    return payload


def analyze_result(result: FaceLandmarkerResult, frame_id: int | None) -> dict[str, Any]:
    if not result.face_landmarks:
        return build_no_face_payload(frame_id)

    landmarks = result.face_landmarks[0]
    yaw, pitch = calculate_head_pose(landmarks)
    blendshape_scores = {}
    if result.face_blendshapes:
        blendshape_scores = {
            category.category_name: float(category.score)
            for category in result.face_blendshapes[0]
        }

    return {
        "frame_id": frame_id,
        "status": "ok",
        "is_looking_at_screen": abs(yaw) <= LOOKING_THRESHOLD_DEGREES and abs(pitch) <= LOOKING_THRESHOLD_DEGREES,
        "dominant_emotion": pick_dominant_emotion(blendshape_scores),
        "yaw": round(float(yaw), 2),
        "pitch": round(float(pitch), 2),
        "overlay": build_overlay(landmarks, yaw, pitch),
    }


class ConnectionAnalyzer:
    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Missing MediaPipe model at {MODEL_PATH}")

        self.loop = loop
        self.queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=16)
        self._last_timestamp = -1
        self._detect_lock = threading.Lock()
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=RunningMode.VIDEO,
            num_faces=1,
            output_face_blendshapes=True,
        )
        self.landmarker = FaceLandmarker.create_from_options(options)

    def _push_payload(self, payload: dict[str, Any]) -> None:
        if self.queue.full():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        self.queue.put_nowait(payload)

    def _normalize_timestamp(self, timestamp_ms: int) -> int:
        normalized = int(timestamp_ms)
        if normalized <= self._last_timestamp:
            normalized = self._last_timestamp + 1
        self._last_timestamp = normalized
        return normalized

    def _detect_sync(self, frame_id: int, timestamp_ms: int, rgb_frame: np.ndarray) -> None:
        try:
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            with self._detect_lock:
                result = self.landmarker.detect_for_video(image, self._normalize_timestamp(timestamp_ms))
            payload = analyze_result(result, frame_id)
        except Exception as exc:
            payload = build_error_payload(frame_id, f"Analysis error: {exc}")
        self.loop.call_soon_threadsafe(self._push_payload, payload)

    def submit_frame(self, frame_id: int, timestamp_ms: int, rgb_frame: np.ndarray) -> None:
        self.loop.run_in_executor(None, self._detect_sync, frame_id, timestamp_ms, rgb_frame)

    async def get_payload(self) -> dict[str, Any]:
        return await self.queue.get()

    def close(self) -> None:
        self.landmarker.close()
