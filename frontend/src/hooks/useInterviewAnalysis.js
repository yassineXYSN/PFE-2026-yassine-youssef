/**
 * useInterviewAnalysis
 *
 * Real-time face landmark, head-pose, and emotion analysis for the interview
 * room. The engine is selected by VITE_FACE_ANALYSIS_ENGINE:
 *   - 'browser' (default): mediapipe tasks-vision in-page, no frame uploads
 *   - 'server':            original backend WebSocket engine
 *
 * @param {React.RefObject} webcamRef  - ref to the react-webcam instance
 * @param {boolean}         isActive   - start/stop the analysis
 * @returns {{ analysis, connectionState }}
 */

import { useEffect, useState } from 'react';
import { createFaceAnalysisEngine } from '../services/faceAnalysis';

export const EMPTY_ANALYSIS = {
  frame_id:            null,
  status:              'no_face',
  is_looking_at_screen: false,
  dominant_emotion:    'neutral',
  yaw:                 null,
  pitch:               null,
  overlay: {
    landmarks: [],
    pose_line: null,
  },
};

export function useInterviewAnalysis(webcamRef, isActive) {
  const [analysis,        setAnalysis]        = useState(EMPTY_ANALYSIS);
  const [connectionState, setConnectionState] = useState('disconnected');

  useEffect(() => {
    if (!isActive) {
      setAnalysis(EMPTY_ANALYSIS);
      setConnectionState('disconnected');
      return;
    }

    const engine = createFaceAnalysisEngine();
    engine.start({
      webcamRef,
      onResult: (payload) =>
        setAnalysis(prev => ({ ...prev, ...payload, overlay: payload.overlay ?? prev.overlay })),
      onState: setConnectionState,
    });

    return () => engine.stop();
  }, [isActive]); // webcamRef is stable – no need to include

  return { analysis, connectionState };
}
