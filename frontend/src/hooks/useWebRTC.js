import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebRTC = (roomId, clientId, localStream, onRemoteStream, onDataMessage) => {
    const pcRef = useRef(null);
    const wsRef = useRef(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const onRemoteStreamRef = useRef(onRemoteStream);
    const onDataMessageRef = useRef(onDataMessage);

    useEffect(() => { onRemoteStreamRef.current = onRemoteStream; }, [onRemoteStream]);
    useEffect(() => { onDataMessageRef.current = onDataMessage; }, [onDataMessage]);

    const cleanup = useCallback(() => {
        console.log(`[WebRTC] Cleaning up connection for ${clientId}`);
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
            wsRef.current = null;
        }
        setConnectionStatus('disconnected');
    }, [clientId]);

    // Send any typed data message through the WS signaling channel
    const sendData = useCallback((type, payload) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, ...payload }));
        }
    }, []);

    const initConnection = useCallback(async () => {
        if (!roomId || !localStream) {
            console.log(`[WebRTC] initConnection aborted: roomId=${roomId}, hasStream=${!!localStream}`);
            return;
        }

        cleanup();

        console.log(`[WebRTC] Initializing connection for room ${roomId} (Client: ${clientId})`);

        // 1. Create RTCPeerConnection
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        // 2. Add local tracks
        localStream.getTracks().forEach(track => {
            console.log(`[WebRTC] Adding local track: ${track.kind}`);
            pc.addTrack(track, localStream);
        });

        // 3. Handle remote tracks
        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track: ${event.track.kind}`);
            if (onRemoteStreamRef.current) {
                onRemoteStreamRef.current(event.streams[0]);
            }
        };

        // 4. Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                console.log('[WebRTC] Sending ICE candidate');
                wsRef.current.send(JSON.stringify({
                    type: 'candidate',
                    candidate: event.candidate
                }));
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection State: ${pc.connectionState}`);
            setConnectionStatus(pc.connectionState);
        };

        pcRef.current = pc;

        // 5. Setup WebSocket
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/api/interviews/ws/${roomId}/${clientId}`;
        console.log('[WebRTC] Connecting to signaling server:', wsUrl);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[WebRTC] Signaling WebSocket opened');
            setConnectionStatus('connecting');
        };

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);

            // Route signaling messages to WebRTC engine
            if (['offer', 'answer', 'candidate', 'request-offer'].includes(message.type)) {
                console.log('[WebRTC] Received signaling message:', message.type);
                try {
                    if (message.type === 'offer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        ws.send(JSON.stringify({ type: 'answer', answer }));
                    } else if (message.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
                    } else if (message.type === 'candidate') {
                        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                    } else if (message.type === 'request-offer') {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        ws.send(JSON.stringify({ type: 'offer', offer }));
                    }
                } catch (err) {
                    console.error('[WebRTC] Error in signal handling:', err);
                }
            } else {
                // Route data messages (chat, transcript, emotion) to the caller
                if (onDataMessageRef.current) {
                    onDataMessageRef.current(message.type, message);
                }
            }
        };

        ws.onerror = (e) => console.error('[WebRTC] WebSocket error:', e);
        ws.onclose = () => console.log('[WebRTC] WebSocket closed');

        wsRef.current = ws;

        // Automatically request an offer after a delay if nobody does
        setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN && pcRef.current?.signalingState === 'stable') {
                console.log('[WebRTC] Sending request-offer (auto)');
                wsRef.current.send(JSON.stringify({ type: 'request-offer' }));
            }
        }, 1500);

    }, [roomId, clientId, localStream, cleanup]);

    return { connectionStatus, initConnection, cleanup, sendData };
};
