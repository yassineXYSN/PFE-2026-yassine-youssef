import { useState, useEffect, useRef, useCallback } from 'react';
import { getToken, SERVER_URL } from '../core/apiClient';

const buildIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
  ];

  const turnUrl      = import.meta.env.VITE_TURN_URL;
  const turnUser     = import.meta.env.VITE_TURN_USERNAME ?? '';
  const turnCred     = import.meta.env.VITE_TURN_CREDENTIAL ?? '';

  if (turnUrl) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  } else {
    // Free public TURN relay — fallback for environments without a configured TURN server
    servers.push(
      { urls: 'turn:a.relay.metered.ca:80',               username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:a.relay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:a.relay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:a.relay.metered.ca:443?transport=tcp',username: 'openrelayproject', credential: 'openrelayproject' },
    );
  }

  return servers;
};

const RECONNECT_DELAYS = [2000, 4000, 8000];

/**
 * WebRTC hook with role-based offer negotiation:
 *  - clientId starting with "recruiter_" → always the OFFERER (creates offers)
 *  - clientId starting with "candidate_" → always the ANSWERER (sends request-offer, then answers)
 *
 * This eliminates the SDP glare / offer-collision race condition that occurs
 * when both peers connect at the same time and both try to create offers.
 */
export const useWebRTC = (roomId, clientId, localStream, onRemoteStream, onDataMessage, onRemoteScreenStream) => {
  const pcRef             = useRef(null);
  const wsRef             = useRef(null);
  const disposedRef       = useRef(false);
  const reconnectTimerRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const messageQueueRef   = useRef([]);
  const localStreamRef    = useRef(localStream);   // always current stream for closures
  const pendingCandidatesRef = useRef([]);
  const lastRemoteOfferSdpRef = useRef(null);
  const initConnectionRef = useRef(null);
  const sendSignalRef = useRef(null);
  const screenSendersRef = useRef([]);
  const remoteStreamsRef = useRef(new Map());
  const remoteCameraStreamIdRef = useRef(null);
  const remoteScreenStreamIdRef = useRef(null);

  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const onRemoteStreamRef = useRef(onRemoteStream);
  const onDataMessageRef  = useRef(onDataMessage);
  const onRemoteScreenStreamRef = useRef(onRemoteScreenStream);

  useEffect(() => { onRemoteStreamRef.current = onRemoteStream; },  [onRemoteStream]);
  useEffect(() => { onDataMessageRef.current  = onDataMessage;  },  [onDataMessage]);
  useEffect(() => { onRemoteScreenStreamRef.current = onRemoteScreenStream; }, [onRemoteScreenStream]);
  useEffect(() => { localStreamRef.current    = localStream;    },  [localStream]);

  const isOfferer = clientId.startsWith('recruiter_');

  const cleanup = useCallback(() => {
    disposedRef.current = true;
    clearTimeout(reconnectTimerRef.current);
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws.readyState !== WebSocket.CLOSED) ws.close();
    }
    messageQueueRef.current = [];
    pendingCandidatesRef.current = [];
    lastRemoteOfferSdpRef.current = null;
    sendSignalRef.current = null;
    screenSendersRef.current = [];
    remoteStreamsRef.current = new Map();
    remoteCameraStreamIdRef.current = null;
    remoteScreenStreamIdRef.current = null;
    onRemoteScreenStreamRef.current?.(null);
    setConnectionStatus('disconnected');
  }, []);

  // Send via WS; queue messages if socket is not yet open
  const sendData = useCallback((type, payload) => {
    const msg = JSON.stringify({ type, from: clientId, ...payload });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(msg);
    } else {
      messageQueueRef.current.push(msg);
    }
  }, [clientId]);

  const flushQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    while (messageQueueRef.current.length) {
      try { wsRef.current.send(messageQueueRef.current.shift()); } catch { break; }
    }
  }, []);

  const initConnection = useCallback(async () => {
    if (!roomId || !localStream) return;

    disposedRef.current    = false;
    reconnectCountRef.current = 0;
    clearTimeout(reconnectTimerRef.current);

    // Tear down any previous connection
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (wsRef.current) {
      const prev = wsRef.current;
      wsRef.current = null;
      if (prev.readyState !== WebSocket.CLOSED) prev.close();
    }

    // ── RTCPeerConnection ────────────────────────────────────────────────
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;
    pendingCandidatesRef.current = [];
    lastRemoteOfferSdpRef.current = null;
    screenSendersRef.current = [];
    remoteStreamsRef.current = new Map();
    remoteCameraStreamIdRef.current = null;
    remoteScreenStreamIdRef.current = null;

    console.log('[WebRTC] Adding tracks to PC:', localStream.getTracks().map(t => `${t.kind}:${t.label} enabled=${t.enabled}`));
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const sendSignal = (payload) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({ ...payload, from: clientId }));
    };
    sendSignalRef.current = sendSignal;

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] ?? new MediaStream([event.track]);
      remoteStreamsRef.current.set(stream.id, stream);

      const knownScreenId = remoteScreenStreamIdRef.current;
      const knownCameraId = remoteCameraStreamIdRef.current;
      const isScreenStream =
        (knownScreenId && stream.id === knownScreenId) ||
        (event.track.kind === 'video' && knownCameraId && stream.id !== knownCameraId);

      if (isScreenStream) {
        remoteScreenStreamIdRef.current = stream.id;
        onRemoteScreenStreamRef.current?.(stream);
      } else {
        remoteCameraStreamIdRef.current = stream.id;
        onRemoteStreamRef.current?.(stream);
      }

      event.track.onended = () => {
        if (stream.id === remoteScreenStreamIdRef.current) {
          remoteScreenStreamIdRef.current = null;
          onRemoteScreenStreamRef.current?.(null);
        }
      };
    };

    const flushPendingCandidates = async () => {
      while (pendingCandidatesRef.current.length && pcRef.current?.remoteDescription) {
        const candidate = pendingCandidatesRef.current.shift();
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding queued ICE candidate:', err);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        sendSignal({ type: 'candidate', candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce?.();
    };

    pc.onconnectionstatechange = () => setConnectionStatus(pc.connectionState);

    // ── Signaling WebSocket ──────────────────────────────────────────────
    const token = getToken();
    const wsUrl = SERVER_URL.replace(/^http/, 'ws') + `/api/interviews/ws/${roomId}/${clientId}?token=${encodeURIComponent(token || '')}`;
    const ws    = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (disposedRef.current) { ws.close(); return; }
      reconnectCountRef.current = 0;
      setConnectionStatus('connecting');
      flushQueue();

      if (isOfferer) {
        // HR (offerer): proactively create an offer after a short delay.
        // This handles the case where the candidate is already in the room.
        setTimeout(async () => {
          if (disposedRef.current || wsRef.current !== ws) return;
          if (pcRef.current?.signalingState !== 'stable') return;
          try {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            sendSignal({ type: 'offer', offer });
          } catch (err) {
            console.error('[WebRTC] Offerer: failed to create initial offer', err);
          }
        }, 1000);
      } else {
        // Candidate (answerer): request an offer from the HR.
        // If HR hasn't sent one yet (joined after us), HR will create one on receiving this.
        // If HR hasn't joined yet, this message goes to an empty room (harmless).
        // A second attempt fires at 5s as a fallback.
        const request = () => {
          if (disposedRef.current || wsRef.current !== ws) return;
          if (pcRef.current?.signalingState !== 'stable') return;
          sendSignal({ type: 'request-offer' });
        };
        setTimeout(request, 1500);
        setTimeout(request, 5000);
      }
    };

    ws.onmessage = async (event) => {
      if (disposedRef.current) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.from === clientId) return;

      const currentPc = pcRef.current;

      if (message.type === 'offer') {
        if (!currentPc || isOfferer) return;
        try {
          const incomingSdp = message.offer?.sdp;
          if (
            currentPc.signalingState === 'stable' &&
            incomingSdp &&
            incomingSdp === lastRemoteOfferSdpRef.current &&
            currentPc.localDescription?.type === 'answer'
          ) {
            sendSignal({ type: 'answer', answer: currentPc.localDescription });
            return;
          }
          if (currentPc.signalingState !== 'stable' && currentPc.signalingState !== 'have-remote-offer') {
            return;
          }
          await currentPc.setRemoteDescription(new RTCSessionDescription(message.offer));
          lastRemoteOfferSdpRef.current = incomingSdp ?? null;
          await flushPendingCandidates();
          const answer = await currentPc.createAnswer();
          await currentPc.setLocalDescription(answer);
          sendSignal({ type: 'answer', answer });
        } catch (err) { console.error('[WebRTC] Error handling offer:', err); }

      } else if (message.type === 'answer') {
        if (!currentPc || !isOfferer) return;
        if (currentPc.signalingState !== 'have-local-offer') return;
        try {
          await currentPc.setRemoteDescription(new RTCSessionDescription(message.answer));
          await flushPendingCandidates();
        } catch (err) { console.error('[WebRTC] Error handling answer:', err); }

      } else if (message.type === 'candidate') {
        if (!currentPc) return;
        try {
          if (currentPc.remoteDescription) {
            await currentPc.addIceCandidate(new RTCIceCandidate(message.candidate));
          } else {
            pendingCandidatesRef.current.push(message.candidate);
          }
        } catch (err) { console.error('[WebRTC] Error adding ICE candidate:', err); }

      } else if (message.type === 'renegotiate-offer') {
        if (!currentPc || currentPc.signalingState !== 'stable') return;
        try {
          await currentPc.setRemoteDescription(new RTCSessionDescription(message.offer));
          await flushPendingCandidates();
          const answer = await currentPc.createAnswer();
          await currentPc.setLocalDescription(answer);
          sendSignal({ type: 'renegotiate-answer', answer });
        } catch (err) { console.error('[WebRTC] Error handling renegotiation offer:', err); }

      } else if (message.type === 'renegotiate-answer') {
        if (!currentPc || currentPc.signalingState !== 'have-local-offer') return;
        try {
          await currentPc.setRemoteDescription(new RTCSessionDescription(message.answer));
          await flushPendingCandidates();
        } catch (err) { console.error('[WebRTC] Error handling renegotiation answer:', err); }

      } else if (message.type === 'request-offer') {
        // Only the offerer (HR) responds to this
        if (!isOfferer || !currentPc) return;
        try {
          if (currentPc.signalingState === 'stable') {
            // Normal path: create a fresh offer
            const offer = await currentPc.createOffer();
            await currentPc.setLocalDescription(offer);
            sendSignal({ type: 'offer', offer });
          } else if (currentPc.signalingState === 'have-local-offer' && currentPc.localDescription) {
            // We already created an offer but nobody answered yet — re-send it
            // (happens when HR joined before candidate and the initial offer went to an empty room)
            sendSignal({ type: 'offer', offer: currentPc.localDescription });
          }
        } catch (err) { console.error('[WebRTC] Error creating offer for request:', err); }

      } else {
        // Data messages (chat, transcript, emotion, end-call) → forward to caller
        if (onDataMessageRef.current) onDataMessageRef.current(message.type, message);
      }
    };

    ws.onerror = () => { /* handled by onclose */ };

    ws.onclose = () => {
      if (disposedRef.current || wsRef.current !== ws) return;
      setConnectionStatus('disconnected');
      const delay = RECONNECT_DELAYS[Math.min(reconnectCountRef.current, RECONNECT_DELAYS.length - 1)];
      reconnectCountRef.current += 1;
      console.log(`[WebRTC] WS closed — reconnecting in ${delay}ms (attempt ${reconnectCountRef.current})`);
      reconnectTimerRef.current = setTimeout(() => {
        if (!disposedRef.current && localStreamRef.current) initConnectionRef.current?.();
      }, delay);
    };

  }, [roomId, clientId, localStream, isOfferer, flushQueue]);

  useEffect(() => {
    initConnectionRef.current = initConnection;
  }, [initConnection]);

  const replaceVideoTrack = useCallback(async (newTrack) => {
    if (!pcRef.current) return;
    const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      try { await sender.replaceTrack(newTrack); } catch (err) { console.error('[WebRTC] replaceTrack failed:', err); }
    }
  }, []);

  const renegotiate = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !sendSignalRef.current || pc.signalingState !== 'stable') return false;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignalRef.current({ type: 'renegotiate-offer', offer });
      return true;
    } catch (err) {
      console.error('[WebRTC] Renegotiation failed:', err);
      return false;
    }
  }, []);

  const addScreenTrack = useCallback(async (screenTrack, screenStream) => {
    const pc = pcRef.current;
    if (!pc || !screenTrack || !screenStream) return false;

    screenSendersRef.current.forEach(sender => {
      try { pc.removeTrack(sender); } catch {}
    });
    screenSendersRef.current = [];

    try {
      const sender = pc.addTrack(screenTrack, screenStream);
      screenSendersRef.current = [sender];
      return await renegotiate();
    } catch (err) {
      console.error('[WebRTC] addScreenTrack failed:', err);
      return false;
    }
  }, [renegotiate]);

  const removeScreenTracks = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !screenSendersRef.current.length) return false;

    screenSendersRef.current.forEach(sender => {
      try { pc.removeTrack(sender); } catch {}
    });
    screenSendersRef.current = [];
    return await renegotiate();
  }, [renegotiate]);

  return {
    connectionStatus,
    initConnection,
    cleanup,
    sendData,
    replaceVideoTrack,
    addScreenTrack,
    removeScreenTracks,
  };
};
