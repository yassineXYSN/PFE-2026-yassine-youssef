/**
 * browserEngine — client-side face analysis with @mediapipe/tasks-vision.
 *
 * Same FaceLandmarker model as the backend engine, running in-browser
 * (WASM, self-hosted under /mediapipe/wasm + /models). Emits payloads with
 * the exact same shape as the server WebSocket engine at ~12 FPS.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { analyzeResult } from './emotionRules';

const TARGET_FPS = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export function createBrowserEngine() {
  let landmarker = null;
  let rafId = null;
  let disposed = false;
  let lastRunAt = 0;
  let lastVideoTime = -1;
  let frameId = 0;

  return {
    async start({ webcamRef, onResult, onState }) {
      onState('connecting');
      try {
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/face_landmarker.task' },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch (err) {
        console.error('[faceAnalysis/browser] model load failed:', err);
        onState('unavailable');
        return;
      }
      if (disposed) { landmarker?.close(); landmarker = null; return; }
      onState('connected');

      const loop = (t) => {
        if (disposed) return;
        const video = webcamRef.current?.video;
        if (
          landmarker &&
          video && video.readyState === 4 &&
          t - lastRunAt >= FRAME_INTERVAL_MS &&
          video.currentTime !== lastVideoTime
        ) {
          lastRunAt = t;
          lastVideoTime = video.currentTime;
          frameId += 1;
          try {
            const result = landmarker.detectForVideo(video, performance.now());
            onResult(analyzeResult(result, frameId));
          } catch { /* skip frame */ }
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    },

    stop() {
      disposed = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      landmarker?.close();
      landmarker = null;
    },
  };
}
