/**
 * useAudioAnalyzer
 *
 * Captures microphone audio via the Web Audio API (AudioWorklet) and
 * streams 3-second PCM chunks to the Interview Detection AI backend
 * for voice emotion classification.
 *
 * WebSocket URL defaults to the HumatiQ backend /api/interviews/ai/ws/audio
 * and can be overridden via the VITE_AI_WS_AUDIO_URL env variable.
 *
 * The hook can use an existing MediaStream, or create an independent
 * getUserMedia audio stream when no stream is provided.
 *
 * @param {boolean} isActive  - start/stop when the candidate is in the room
 * @returns {{ audioEmotion: string|null, audioStatus: string, audioMessage: string }}
 */

import { useEffect, useRef, useState } from 'react';
import { AUDIO_WORKLET_CODE, AUDIO_WORKLET_NAME } from './audioProcessor';

const defaultWsUrl = () => {
  const apiBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
  return apiBase.replace(/^http/, 'ws') + '/api/interviews/ai/ws/audio';
};

const WS_URL = import.meta.env.VITE_AI_WS_AUDIO_URL ?? defaultWsUrl();
const RECONNECT_DELAYS = [1000, 2000, 5000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS.length;

export function useAudioAnalyzer(isActive, sourceStream = null) {
  const [audioEmotion, setAudioEmotion] = useState(null);
  const [audioStatus, setAudioStatus] = useState('disconnected');
  const [audioMessage, setAudioMessage] = useState('');

  const wsRef            = useRef(null);
  const reconnectTimer   = useRef(null);
  const audioCtxRef      = useRef(null);
  const blobUrlRef       = useRef(null);
  const chunkIdRef       = useRef(0);
  const ownedStreamRef    = useRef(null);

  useEffect(() => {
    if (!isActive) {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current)     { wsRef.current.close(); wsRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
      if (ownedStreamRef.current) {
        ownedStreamRef.current.getTracks().forEach(track => track.stop());
        ownedStreamRef.current = null;
      }
      setAudioEmotion(null);
      setAudioStatus('disconnected');
      setAudioMessage('');
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
      if (reconnectCount >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
      reconnectCount += 1;
      setAudioStatus('reconnecting');
      reconnectTimer.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) return;
      setAudioStatus(reconnectCount === 0 ? 'connecting' : 'reconnecting');
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen  = () => {
        if (disposed) { socket.close(); return; }
        reconnectCount = 0;
        setAudioStatus('connected');
        setAudioMessage('Audio analysis active.');
      };

      socket.onmessage = ({ data }) => {
        try {
          const payload = JSON.parse(data);
          if (payload.status === 'ok') {
            setAudioEmotion(payload.emotion ?? null);
            setAudioMessage('Audio analysis active.');
          } else if (payload.status === 'error') {
            setAudioMessage(payload.error || 'Backend audio analysis error.');
          }
        } catch { /* ignore */ }
      };

      socket.onerror = () => setAudioMessage('Audio WebSocket error.');

      socket.onclose = () => {
        wsRef.current = null;
        if (!disposed) {
          setAudioStatus('disconnected');
          scheduleReconnect();
        }
      };
    };

    const setup = async () => {
      let stream;
      try {
        stream = sourceStream?.getAudioTracks?.().length
          ? sourceStream
          : await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (stream !== sourceStream) ownedStreamRef.current = stream;
      } catch (e) {
        console.warn('[AudioAnalyzer] Microphone access denied or unavailable:', e.message);
        setAudioStatus('mic_error');
        setAudioMessage(e.message || 'Microphone access denied.');
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
        setAudioStatus('worklet_error');
        setAudioMessage(e.message || 'Failed to start audio analysis.');
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
      if (ownedStreamRef.current) {
        ownedStreamRef.current.getTracks().forEach(track => track.stop());
        ownedStreamRef.current = null;
      }
    };
  }, [isActive, sourceStream]);

  return { audioEmotion, audioStatus, audioMessage };
}
