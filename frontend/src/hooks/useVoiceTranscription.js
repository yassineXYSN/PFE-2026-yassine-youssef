/**
 * useVoiceTranscription
 *
 * Streams microphone audio from the WebRTC local stream → client-side VAD →
 * WAV blob → POST /interviews/{id}/transcribe (faster-whisper) → onTranscript.
 *
 * Uses the same mic stream as the video call (no separate SpeechRecognition
 * capture), avoiding "aborted" / mic-lock conflicts during interviews.
 */

import { useEffect, useRef } from 'react';
import { VAD_WORKLET_CODE, VAD_WORKLET_NAME } from './vadProcessor';
import { apiFetch } from '../core/api';

const _activeBySender = new Map();
let _tokenSeq = 0;

function pcmToWav(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const senderPrefix = (sender) => (sender === 'Recruteur' ? 'R' : 'C');
const newMsgId = (sender) =>
  `${senderPrefix(sender)}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function useVoiceTranscription({
  stream,
  sender,
  interviewId,
  enabled,
  muted,
  language,
  onTranscript,
  onListeningChange,
}) {
  const onTranscriptRef = useRef(onTranscript);
  const onListeningRef = useRef(onListeningChange);
  const mutedRef = useRef(muted);
  const languageRef = useRef(language);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onListeningRef.current = onListeningChange; }, [onListeningChange]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { languageRef.current = language; }, [language]);

  const workletNodeRef = useRef(null);
  useEffect(() => {
    workletNodeRef.current?.port.postMessage({ type: 'set-enabled', value: !muted });
  }, [muted]);

  useEffect(() => {
    if (!enabled || !stream || !interviewId) return;

    const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    if (!audioTracks.length) return;

    const myToken = ++_tokenSeq;
    _activeBySender.set(sender, { token: myToken, releasing: false });

    let cancelled = false;
    let audioCtx = null;
    let workletNode = null;
    let source = null;
    let workletBlobUrl = null;

    const start = async () => {
      if (_activeBySender.get(sender)?.token !== myToken) return;

      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          try { await audioCtx.resume(); } catch {}
        }

        workletBlobUrl = URL.createObjectURL(
          new Blob([VAD_WORKLET_CODE], { type: 'application/javascript' }),
        );
        await audioCtx.audioWorklet.addModule(workletBlobUrl);
        if (cancelled || _activeBySender.get(sender)?.token !== myToken) {
          try { audioCtx.close(); } catch {}
          if (workletBlobUrl) URL.revokeObjectURL(workletBlobUrl);
          return;
        }

        workletNode = new AudioWorkletNode(audioCtx, VAD_WORKLET_NAME);
        workletNodeRef.current = workletNode;
        workletNode.port.postMessage({ type: 'set-enabled', value: !mutedRef.current });

        workletNode.port.onmessage = async (event) => {
          const msg = event.data;
          if (!msg) return;
          if (cancelled || _activeBySender.get(sender)?.token !== myToken) return;

          if (msg.type === 'state') {
            onListeningRef.current?.(msg.state === 'speech');
            return;
          }

          if (msg.type !== 'utterance') return;
          if (mutedRef.current) return;

          const { samples, sampleRate, durationMs } = msg;
          if (!samples || samples.length === 0) return;

          const wav = pcmToWav(samples, sampleRate);
          const msg_id = newMsgId(sender);

          const form = new FormData();
          form.append('audio', wav, 'utterance.wav');
          form.append('sender', sender);
          form.append('msg_id', msg_id);
          const lang = languageRef.current;
          if (lang) form.append('language', lang);

          try {
            const result = await apiFetch(`/interviews/${interviewId}/transcribe`, {
              method: 'POST',
              body: form,
            });
            if (cancelled || _activeBySender.get(sender)?.token !== myToken) return;
            const text = result?.text?.trim();
            if (text) {
              onTranscriptRef.current?.({ sender, text, msg_id });
            }
          } catch (err) {
            console.error(`[Transcription] ${sender} upload failed (${Math.round(durationMs)}ms):`, err);
          }
        };

        source = audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
        source.connect(workletNode);
        console.info(`[Transcription] VAD ready (${sender}, sampleRate=${audioCtx.sampleRate})`);
      } catch (err) {
        console.error(`[Transcription] Failed to init VAD for ${sender}:`, err);
      }
    };

    start();

    return () => {
      cancelled = true;
      onListeningRef.current?.(false);
      try { source?.disconnect(); } catch {}
      try { workletNode?.disconnect(); } catch {}
      try { audioCtx?.close(); } catch {}
      if (workletBlobUrl) URL.revokeObjectURL(workletBlobUrl);
      workletNodeRef.current = null;
      if (_activeBySender.get(sender)?.token === myToken) {
        _activeBySender.delete(sender);
      }
    };
  }, [enabled, stream, interviewId, sender]);
}
