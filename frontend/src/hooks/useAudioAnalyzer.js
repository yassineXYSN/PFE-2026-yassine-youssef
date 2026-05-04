/**
 * useAudioAnalyzer
 *
 * Captures microphone audio via the Web Audio API (AudioWorklet) and
 * streams 3-second PCM chunks to the Interview Detection AI backend
 * for voice emotion classification.
 *
 * WebSocket URL defaults to ws://localhost:8002/ws/audio
 * and can be overridden via the VITE_AI_WS_AUDIO_URL env variable.
 *
 * The hook creates its own independent getUserMedia audio stream so it
 * does not interfere with the WebRTC peer connection.
 *
 * @param {boolean} isActive  - start/stop when the candidate is in the room
 * @returns {{ audioEmotion: string|null }}
 */

import { useEffect, useRef, useState } from 'react';
import { AUDIO_WORKLET_CODE, AUDIO_WORKLET_NAME } from './audioProcessor';

const WS_URL           = import.meta.env.VITE_AI_WS_AUDIO_URL ?? 'ws://localhost:8002/ws/audio';
const RECONNECT_DELAYS = [1000, 2000, 5000];

export function useAudioAnalyzer(isActive) {
  const [audioEmotion, setAudioEmotion] = useState(null);

  const wsRef            = useRef(null);
  const reconnectTimer   = useRef(null);
  const audioCtxRef      = useRef(null);
  const blobUrlRef       = useRef(null);
  const chunkIdRef       = useRef(0);

  useEffect(() => {
    if (!isActive) {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current)     { wsRef.current.close(); wsRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      setAudioEmotion(null);
      return;
    }

    let disposed       = false;
    let reconnectCount = 0;

    const clearTimer = () => {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      clearTimer();
      const delay = RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
      reconnectCount += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen  = () => { if (disposed) socket.close(); };

      socket.onmessage = ({ data }) => {
        try {
          const payload = JSON.parse(data);
          if (payload.status === 'ok') setAudioEmotion(payload.emotion ?? null);
        } catch { /* ignore */ }
      };

      socket.onerror = () => { /* onclose handles retry */ };

      socket.onclose = () => {
        wsRef.current = null;
        if (!disposed) scheduleReconnect();
      };
    };

    const setup = async () => {
      // Independent audio stream — does not interfere with WebRTC audio
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (e) {
        console.warn('[AudioAnalyzer] Microphone access denied or unavailable:', e.message);
        return;
      }
      if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }

      const ctx     = new AudioContext();
      audioCtxRef.current = ctx;

      const blob    = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      try {
        await ctx.audioWorklet.addModule(blobUrl);
      } catch (e) {
        console.warn('[AudioAnalyzer] Failed to load AudioWorklet:', e.message);
        return;
      }
      if (disposed) return;

      const source      = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, AUDIO_WORKLET_NAME);

      workletNode.port.onmessage = ({ data: { samples, sampleRate } }) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !samples?.byteLength) return;

        chunkIdRef.current += 1;

        // Binary frame: [chunk_id: u32 LE][sample_rate: u32 LE][pcm: f32 LE...]
        const header = new ArrayBuffer(8);
        const view   = new DataView(header);
        view.setUint32(0, chunkIdRef.current, true);
        view.setUint32(4, sampleRate,         true);

        const frame = new Uint8Array(8 + samples.buffer.byteLength);
        frame.set(new Uint8Array(header),         0);
        frame.set(new Uint8Array(samples.buffer), 8);
        ws.send(frame);
      };

      // Connect source → worklet (intentionally no destination — no mic playback)
      source.connect(workletNode);

      connect();
    };

    setup();

    return () => {
      disposed = true;
      clearTimer();
      if (wsRef.current)       { wsRef.current.close(); wsRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      if (blobUrlRef.current)  { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, [isActive]);

  return { audioEmotion };
}
