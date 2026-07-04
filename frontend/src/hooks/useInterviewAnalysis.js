/**
 * useInterviewAnalysis
 *
 * Connects to the Interview Detection AI backend over WebSocket and streams
 * webcam frames at ~12 FPS for real-time face landmark, head-pose, and
 * emotion analysis.
 *
 * WebSocket URL defaults to the HumatiQ backend /api/interviews/ai/ws/analyze
 * and can be overridden via the VITE_AI_WS_URL env variable.
 *
 * @param {React.RefObject} webcamRef  - ref to the react-webcam instance
 * @param {boolean}         isActive   - start/stop the analysis (e.g. only when in the room)
 * @returns {{ analysis, connectionState }}
 */

import { useEffect, useRef, useState } from 'react';
import { getToken } from '../core/apiClient';

const defaultWsUrl = () => {
  const apiBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
  return apiBase.replace(/^http/, 'ws') + '/api/interviews/ai/ws/analyze';
};

const WS_URL = import.meta.env.VITE_AI_WS_URL ?? defaultWsUrl();

const TARGET_FPS        = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const SEND_TIMEOUT_MS   = 120;           // ms before we consider a frame lost
const RECONNECT_DELAYS  = [1000, 2000, 5000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length;

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
  const [analysis,         setAnalysis]         = useState(EMPTY_ANALYSIS);
  const [connectionState,  setConnectionState]  = useState('disconnected');

  const wsRef               = useRef(null);
  const reconnectTimerRef   = useRef(null);
  const rafRef              = useRef(null);
  const frameIdRef          = useRef(0);
  const lastSentAtRef       = useRef(0);
  const lastTimestampRef    = useRef(0);
  const inFlightRef         = useRef(false);
  const inFlightStartedRef  = useRef(0);

  useEffect(() => {
    // --- Cleanup path when deactivated ---
    if (!isActive) {
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setAnalysis(EMPTY_ANALYSIS);
      setConnectionState('disconnected');
      return;
    }

    let disposed        = false;
    let reconnectCount  = 0;

    const clearTimer = () => {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      clearTimer();
      if (reconnectCount >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionState('unavailable');
        return;
      }
      const delay = RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
      reconnectCount += 1;
      setConnectionState('reconnecting');
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      setConnectionState('connecting');

      const token = getToken();
      const socket = new WebSocket(`${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`);
      wsRef.current = socket;

      socket.onopen = () => {
        if (disposed) { socket.close(); return; }
        reconnectCount    = 0;
        inFlightRef.current = false;
        setConnectionState('connected');
      };

      socket.onmessage = ({ data }) => {
        inFlightRef.current = false;
        try {
          const payload = JSON.parse(data);
          setAnalysis(prev => ({
            ...prev,
            ...payload,
            overlay: payload.overlay ?? prev.overlay,
          }));
        } catch { /* ignore malformed */ }
      };

      socket.onerror = () => { /* onclose handles retry */ };

      socket.onclose = () => {
        wsRef.current = null;
        if (!disposed) {
          setConnectionState('disconnected');
          scheduleReconnect();
        }
      };
    };

    // --- Frame capture loop ---
    const captureFrame = (timestamp) => {
      const socket = wsRef.current;
      const webcam = webcamRef.current;
      const ready  = webcam?.video?.readyState === 4;

      if (
        socket?.readyState === WebSocket.OPEN &&
        ready &&
        timestamp - lastSentAtRef.current >= FRAME_INTERVAL_MS &&
        socket.bufferedAmount < 65536 &&
        (!inFlightRef.current || timestamp - inFlightStartedRef.current > SEND_TIMEOUT_MS)
      ) {
        const image = webcam.getScreenshot();
        if (image) {
          frameIdRef.current += 1;
          const ts = Math.max(lastTimestampRef.current + 1, Math.round(performance.now()));
          socket.send(JSON.stringify({ frame_id: frameIdRef.current, timestamp_ms: ts, image }));
          lastSentAtRef.current      = timestamp;
          lastTimestampRef.current   = ts;
          inFlightRef.current        = true;
          inFlightStartedRef.current = timestamp;
        }
      }

      rafRef.current = requestAnimationFrame(captureFrame);
    };

    connect();
    rafRef.current = requestAnimationFrame(captureFrame);

    return () => {
      disposed = true;
      clearTimer();
      if (wsRef.current)  { wsRef.current.close(); wsRef.current = null; }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [isActive]); // webcamRef is stable – no need to include

  return { analysis, connectionState };
}
