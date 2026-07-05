/**
 * Face analysis engine selector — mirrors the backend aiproxy pattern:
 * swapping engines is a config change (VITE_FACE_ANALYSIS_ENGINE), never a
 * code change. 'browser' (default) runs mediapipe in-page; 'server' streams
 * frames to the original backend WebSocket.
 */

import { createBrowserEngine } from './browserEngine';
import { createServerEngine } from './serverEngine';

export const FACE_ANALYSIS_ENGINE =
  (import.meta.env.VITE_FACE_ANALYSIS_ENGINE || 'browser').toLowerCase();

export function createFaceAnalysisEngine(kind = FACE_ANALYSIS_ENGINE) {
  return kind === 'server' ? createServerEngine() : createBrowserEngine();
}
