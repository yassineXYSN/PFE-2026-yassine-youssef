/**
 * serverEngine — the original backend face analysis over WebSocket.
 *
 * Streams webcam JPEG frames to /api/interviews/ai/ws/analyze and relays
 * payloads back. Kept as a selectable engine (VITE_FACE_ANALYSIS_ENGINE=server);
 * the default engine runs in the browser (see browserEngine.js).
 */

import { getToken, SERVER_URL } from '../../core/apiClient';

const defaultWsUrl = () => SERVER_URL.replace(/^http/, 'ws') + '/api/interviews/ai/ws/analyze';

const WS_URL = import.meta.env.VITE_AI_WS_URL ?? defaultWsUrl();

const TARGET_FPS        = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const SEND_TIMEOUT_MS   = 120;
const RECONNECT_DELAYS  = [1000, 2000, 5000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length;

export function createServerEngine() {
  let ws = null;
  let reconnectTimer = null;
  let rafId = null;
  let disposed = false;
  let reconnectCount = 0;
  let frameId = 0;
  let lastSentAt = 0;
  let lastTimestamp = 0;
  let inFlight = false;
  let inFlightStartedAt = 0;

  return {
    async start({ webcamRef, onResult, onState }) {
      const clearTimer = () => { clearTimeout(reconnectTimer); reconnectTimer = null; };

      const scheduleReconnect = () => {
        if (disposed) return;
        clearTimer();
        if (reconnectCount >= MAX_RECONNECT_ATTEMPTS) { onState('unavailable'); return; }
        const delay = RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
        reconnectCount += 1;
        onState('reconnecting');
        reconnectTimer = setTimeout(connect, delay);
      };

      const connect = () => {
        if (disposed) return;
        onState('connecting');
        const token = getToken();
        const socket = new WebSocket(`${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`);
        ws = socket;

        socket.onopen = () => {
          if (disposed) { socket.close(); return; }
          reconnectCount = 0;
          inFlight = false;
          onState('connected');
        };

        socket.onmessage = ({ data }) => {
          inFlight = false;
          try { onResult(JSON.parse(data)); } catch { /* ignore malformed */ }
        };

        socket.onerror = () => { /* onclose handles retry */ };

        socket.onclose = () => {
          ws = null;
          if (!disposed) { onState('disconnected'); scheduleReconnect(); }
        };
      };

      const captureFrame = (timestamp) => {
        if (disposed) return;
        const webcam = webcamRef.current;
        const ready = webcam?.video?.readyState === 4;

        if (
          ws?.readyState === WebSocket.OPEN &&
          ready &&
          timestamp - lastSentAt >= FRAME_INTERVAL_MS &&
          ws.bufferedAmount < 65536 &&
          (!inFlight || timestamp - inFlightStartedAt > SEND_TIMEOUT_MS)
        ) {
          const image = webcam.getScreenshot();
          if (image) {
            frameId += 1;
            const ts = Math.max(lastTimestamp + 1, Math.round(performance.now()));
            ws.send(JSON.stringify({ frame_id: frameId, timestamp_ms: ts, image }));
            lastSentAt = timestamp;
            lastTimestamp = ts;
            inFlight = true;
            inFlightStartedAt = timestamp;
          }
        }
        rafId = requestAnimationFrame(captureFrame);
      };

      connect();
      rafId = requestAnimationFrame(captureFrame);
    },

    stop() {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) { ws.close(); ws = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },
  };
}
