import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MoreVertical,
  PhoneOff, Users, MessageSquare, Settings, HelpCircle,
  ChevronDown, Sparkles, X, Send,
  Shield, ShieldOff, RotateCcw, Volume2, CheckCircle2, Clock, UserX,
} from 'lucide-react';
import { useBackgroundBlur } from '../../../hooks/useBackgroundBlur';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { useInterviewAnalysis } from '../../../hooks/useInterviewAnalysis';
import { useAudioAnalyzer } from '../../../hooks/useAudioAnalyzer';
import { apiFetch } from '../../../core/api';
import '../../HR/applications/FaceAffectus.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getAttentionScore = (yaw, pitch) => {
  if (typeof yaw !== 'number' || typeof pitch !== 'number') return 0;
  const magnitude = Math.max(Math.abs(yaw), Math.abs(pitch));
  return Math.round(100 - Math.min(100, (magnitude / 30) * 100));
};

// ---------------------------------------------------------------------------

const NO_SHOW_MS = 15 * 60 * 1000;

const InterviewRoom = () => {
  const { interviewId } = useParams();

  const [devices, setDevices]               = useState([]);
  const [mics, setMics]                     = useState([]);
  const [speakers, setSpeakers]             = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedMic, setSelectedMic]       = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [hasJoined, setHasJoined]           = useState(false);
  const [currentTime, setCurrentTime]       = useState(new Date());
  const [isMicEnabled, setIsMicEnabled]     = useState(true);
  const [isCamEnabled, setIsCamEnabled]     = useState(true);
  const [isBlurEnabled, setIsBlurEnabled]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showMoreMenu, setShowMoreMenu]     = useState(false);

  const [activeSidebar, setActiveSidebar]   = useState(null);
  const [messages, setMessages]             = useState([]);
  const [chatInput, setChatInput]           = useState('');
  const [participants] = useState([
    { id: 1, name: 'Recruteur',       role: 'Hôte',   mic: true, cam: true, avatar: 'R' },
    { id: 2, name: 'Vous (Candidat)', role: 'Invité', mic: true, cam: true, avatar: 'C' },
  ]);

  const [isEnded, setIsEnded]               = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(10);
  const [interviewData, setInterviewData]   = useState(null);
  const [remotePeerLeft, setRemotePeerLeft] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [noShowWarning, setNoShowWarning]   = useState(null);

  const isMicEnabledRef = useRef(isMicEnabled);
  useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream]   = useState(null);
  const noShowTimerRef = useRef(null);

  // ── Canvas / webcam refs ──────────────────────────────────────────────────
  const webcamRef       = useRef(null);
  const masterCanvasRef = useRef(null);
  const prejoinCanvasRef = useRef(null);
  const pipCanvasRef    = useRef(null);

  // ── Analysis log (in-memory, saved to backend at end of call) ────────────
  const analysisLogRef       = useRef([]);
  const lastSnapshotTimeRef  = useRef(0);
  const lastEmotionSentRef   = useRef(null);
  const lastAudioEmotionSentRef = useRef(null);
  const lastEmotionTimeRef   = useRef(0);

  // ── Background blur ───────────────────────────────────────────────────────
  const { processFrame } = useBackgroundBlur(
    webcamRef.current?.video, masterCanvasRef.current, isBlurEnabled,
  );

  // ── AI models (active only while in the room with camera on, silent to candidate) ──
  const aiActive = hasJoined && isCamEnabled && !isScreenSharing;
  const { analysis } = useInterviewAnalysis(webcamRef, aiActive);
  const { audioEmotion } = useAudioAnalyzer(hasJoined && isMicEnabled && !isScreenSharing && Boolean(localStream), localStream);

  const attentionScore = useMemo(
    () => getAttentionScore(analysis.yaw, analysis.pitch),
    [analysis.yaw, analysis.pitch],
  );

  // ── WebRTC ────────────────────────────────────────────────────────────────
  const screenStreamRef   = useRef(null);
  const screenVideoRef    = useRef(null);
  const remoteScreenVideoRef = useRef(null);
  const recognitionRef    = useRef(null);
  const shouldTranscribeRef = useRef(false);
  const chatEndRef        = useRef(null);
  const remoteVideoRef    = useRef(null);
  const clientIdRef = useRef('candidate_' + Math.random().toString(36).slice(2, 7));
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);

  const handleRemoteStream = useCallback((stream) => {
    setRemoteStream(stream);
    setRemotePeerLeft(false);

    stream.getTracks().forEach(track => {
      track.onended = () => setRemotePeerLeft(true);
    });
  }, []);

  const handleRemoteScreenStream = useCallback((stream) => {
    setRemoteScreenStream(stream);
    setRemoteScreenSharing(Boolean(stream));
    if (stream) {
      setRemotePeerLeft(false);
      stream.getTracks().forEach(track => {
        track.onended = () => {
          setRemoteScreenStream(null);
          setRemoteScreenSharing(false);
        };
      });
    }
  }, []);

  const handleDataMessage = useCallback((type, data) => {
    if (type === 'chat') {
      setMessages(prev => [...prev, { id: Date.now(), text: data.text, sender: data.sender, time: new Date() }]);
    } else if (type === 'end-call') {
      cleanupRTC();
      setIsEnded(true);
    } else if (type === 'peer-left') {
      setRemotePeerLeft(true);
      setRemoteScreenSharing(false);
      setRemoteScreenStream(null);
    } else if (type === 'screen-share-start') {
      setRemoteScreenSharing(true);
      setRemotePeerLeft(false);
    } else if (type === 'screen-share-stop') {
      setRemoteScreenSharing(false);
      setRemoteScreenStream(null);
    }
  }, []);

  const { connectionStatus, initConnection, cleanup: cleanupRTC, sendData, addScreenTrack, removeScreenTracks } = useWebRTC(
    interviewId, clientIdRef.current, localStream, handleRemoteStream, handleDataMessage, handleRemoteScreenStream,
  );

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    let cancelled = false;

    const fetchInterview = async () => {
      try {
        const data = await apiFetch(`/interviews/${interviewId}`);
        if (cancelled) return;
        setInterviewData(data);
        if (data?.status === 'no_show' && data?.no_show_fault === 'hr') {
          setNoShowWarning('hr_no_show');
        }
      } catch (err) {
        console.error('[InterviewRoom] Failed to fetch interview:', err);
      }
    };

    fetchInterview();
    const interval = setInterval(fetchInterview, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [interviewId]);

  useEffect(() => {
    if (!hasJoined || remoteStream || isEnded) {
      clearTimeout(noShowTimerRef.current);
      return;
    }

    const start = interviewData?.start_time ? new Date(interviewData.start_time).getTime() : null;
    const dueAt = start ? start + NO_SHOW_MS : Date.now() + NO_SHOW_MS;
    const delay = Math.max(0, dueAt - Date.now());

    noShowTimerRef.current = setTimeout(() => {
      setNoShowWarning('hr_no_show');
      apiFetch(`/interviews/${interviewId}/no-show`, {
        method: 'POST',
        body: JSON.stringify({ fault: 'hr' }),
      }).catch(err => console.error('[InterviewRoom] Failed to mark HR no-show:', err));
    }, delay);

    return () => clearTimeout(noShowTimerRef.current);
  }, [hasJoined, interviewData, interviewId, isEnded, remoteStream]);

  useEffect(() => {
    if (remoteStream) setNoShowWarning(null);
  }, [remoteStream]);

  useEffect(() => {
    if (!hasJoined || !remoteStream) return;
    if (connectionStatus === 'disconnected' || connectionStatus === 'failed') {
      setRemotePeerLeft(true);
    }
    if (connectionStatus === 'connected') setRemotePeerLeft(false);
  }, [connectionStatus, hasJoined, remoteStream]);

  // ── Silently forward emotion + attention data to HR ─────────────────────
  useEffect(() => {
    if (!hasJoined || isScreenSharing || (analysis.status === 'no_face' && !audioEmotion)) return;

    const now = Date.now();
    const emotionChanged = analysis.dominant_emotion !== lastEmotionSentRef.current;
    const audioChanged = audioEmotion !== lastAudioEmotionSentRef.current;
    const timeSinceLastSend = now - lastEmotionTimeRef.current;

    // Send on change or every 5s to keep HR panel fresh
    if ((analysis.dominant_emotion || audioEmotion) && (emotionChanged || audioChanged || timeSinceLastSend >= 5000)) {
      sendData('emotion', {
        emotion: analysis.status === 'ok' ? analysis.dominant_emotion : 'neutral',
        audio_emotion: audioEmotion,
        attention_score: attentionScore,
        is_looking: analysis.is_looking_at_screen ?? false,
      });
      lastEmotionSentRef.current = analysis.dominant_emotion;
      lastAudioEmotionSentRef.current = audioEmotion;
      lastEmotionTimeRef.current = now;
    }

    // Snapshot every 5s for the end-of-call log
    if (now - lastSnapshotTimeRef.current >= 5000) {
      analysisLogRef.current.push({
        timestamp:       now,
        emotion:         analysis.dominant_emotion,
        audio_emotion:   audioEmotion,
        attention_score: attentionScore,
        is_looking:      analysis.is_looking_at_screen,
        yaw:             analysis.yaw,
        pitch:           analysis.pitch,
      });
      lastSnapshotTimeRef.current = now;
    }
  }, [analysis, audioEmotion, attentionScore, hasJoined, isScreenSharing, sendData]);

  // ── Candidate-side transcript capture is silent; HR is the only UI consumer ──
  useEffect(() => {
    if (!hasJoined || isScreenSharing) {
      shouldTranscribeRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    shouldTranscribeRef.current = true;
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (!isMicEnabledRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;
        sendData('transcript', { sender: 'Candidat', text });
        apiFetch(`/interviews/${interviewId}/transcript`, {
          method: 'POST',
          body: JSON.stringify({ sender: 'Candidat', text }),
        }).catch(err => console.error('[Transcript] Failed to save:', err));
      }
    };

    recognition.onend = () => {
      if (shouldTranscribeRef.current) {
        try { recognition.start(); } catch { /* already starting */ }
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* browser can reject duplicate starts */ }

    return () => {
      shouldTranscribeRef.current = false;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [hasJoined, interviewId, isScreenSharing, sendData]);

  // ── Save analysis log to backend when call ends ───────────────────────────
  useEffect(() => {
    if (!isEnded) return;
    const log = analysisLogRef.current;
    if (!log.length) return;

    apiFetch(`/interviews/${interviewId}/analysis-log`, {
      method: 'POST',
      body: JSON.stringify({ log }),
    }).catch(err => console.warn('[InterviewRoom] Failed to save analysis log:', err));
  }, [isEnded, interviewId]);

  // ── Blur / raw canvas loop ────────────────────────────────────────────────
  useEffect(() => {
    let animationId;
    let processing = false;
    const loop = async () => {
      if (isCamEnabled && webcamRef.current?.video && masterCanvasRef.current) {
        if (isBlurEnabled) {
          if (!processing) {
            processing = true;
            processFrame().finally(() => { processing = false; });
          }
        } else {
          const vid = webcamRef.current?.video;
          if (vid && vid.readyState >= 2) masterCanvasRef.current.getContext('2d').drawImage(vid, 0, 0, 1280, 720);
        }

        if (!hasJoined && prejoinCanvasRef.current) {
          prejoinCanvasRef.current.getContext('2d').drawImage(masterCanvasRef.current, 0, 0, 1280, 720);
        } else if (hasJoined && pipCanvasRef.current) {
          pipCanvasRef.current.getContext('2d').drawImage(masterCanvasRef.current, 0, 0, 1280, 720);
        }
      }
      animationId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationId);
  }, [isCamEnabled, hasJoined, isBlurEnabled, processFrame]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = isMicEnabled; });
  }, [isMicEnabled, localStream]);

  useEffect(() => {
    if (localStream) localStream.getVideoTracks().forEach(t => { t.enabled = isCamEnabled; });
  }, [isCamEnabled, localStream]);

  const handleDevices = useCallback((mediaDevices) => {
    const cams  = mediaDevices.filter(d => d.kind === 'videoinput');
    const micsArr = mediaDevices.filter(d => d.kind === 'audioinput');
    const spkrs = mediaDevices.filter(d => d.kind === 'audiooutput');
    setDevices(cams); setMics(micsArr); setSpeakers(spkrs);
    if (cams.length  && !selectedDevice)  setSelectedDevice(cams[0].deviceId);
    if (micsArr.length && !selectedMic)   setSelectedMic(micsArr[0].deviceId);
    if (spkrs.length && !selectedSpeaker) setSelectedSpeaker(spkrs[0].deviceId);
  }, [selectedDevice, selectedMic, selectedSpeaker]);

  const refreshDevices = useCallback(async () => {
    try {
      handleDevices(await navigator.mediaDevices.enumerateDevices());
      if (webcamRef.current?.stream) setLocalStream(webcamRef.current.stream);
    } catch (e) { console.error(e); }
  }, [handleDevices]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);
  useEffect(() => {
    if (activeSidebar === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeSidebar]);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => {
      t.onended = null;
      t.stop();
    });
    screenStreamRef.current = null;
    try { await removeScreenTracks(); } catch (e) { console.error('[SS] remove screen track:', e); }
    sendData('screen-share-stop', { role: 'candidate' });
    setIsScreenSharing(false);
  }, [removeScreenTracks, sendData]);

  const toggleScreenShare = async () => {
    if (isScreenSharing) { await stopScreenShare(); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      screenStreamRef.current = stream;
      const screenTrack = stream.getVideoTracks()[0];
      const shared = await addScreenTrack(screenTrack, stream);
      if (!shared) {
        stream.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        return;
      }
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
      screenTrack.onended = () => stopScreenShare();
      sendData('screen-share-start', { role: 'candidate', streamId: stream.id });
      setIsScreenSharing(true);
    } catch { console.log('Screen share cancelled'); }
  };

  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current)
      screenVideoRef.current.srcObject = screenStreamRef.current;
  }, [isScreenSharing]);

  useEffect(() => {
    if (hasJoined) { initConnection(); }
    else           { cleanupRTC(); setRemoteStream(null); setRemoteScreenStream(null); setRemotePeerLeft(false); setRemoteScreenSharing(false); }
  }, [hasJoined, initConnection, cleanupRTC]);

  useEffect(() => {
    let timer;
    if (isEnded) {
      if (redirectCountdown > 0) {
        timer = setTimeout(() => setRedirectCountdown(prev => prev - 1), 1000);
      } else {
        window.location.href = '/candidat/dashboard';
      }
    }
    return () => clearTimeout(timer);
  }, [isEnded, redirectCountdown]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current)
      remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (remoteScreenStream && remoteScreenVideoRef.current)
      remoteScreenVideoRef.current.srcObject = remoteScreenStream;
  }, [remoteScreenStream]);

  const sendMessage = () => {
    const t = chatInput.trim(); if (!t) return;
    setMessages(prev => [...prev, { id: Date.now(), text: t, sender: 'Vous (Candidat)', time: new Date() }]);
    sendData('chat', { text: t, sender: 'Candidat' });
    setChatInput('');
  };

  const resetCall = async () => {
    sendData('peer-left', { role: 'candidate' });
    await new Promise(resolve => setTimeout(resolve, 100));
    await stopScreenShare();
    shouldTranscribeRef.current = false;
    recognitionRef.current?.stop();
    setHasJoined(false); setActiveSidebar(null);
  };

  const openSidebar = (name) => setActiveSidebar(prev => prev === name ? null : name);

  const micLabel = mics.find(d => d.deviceId === selectedMic)?.label || 'Microphone';
  const camLabel = devices.find(d => d.deviceId === selectedDevice)?.label || 'Camera';
  const spkLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || 'Audio Output';
  const screenShareActive = isScreenSharing || remoteScreenSharing || Boolean(remoteScreenStream);

  return (
    <>
      {isCamEnabled && (
        <Webcam
          ref={webcamRef}
          audio={true}
          muted={true}
          audioConstraints={{ deviceId: selectedMic ? { exact: selectedMic } : undefined }}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.7}
          forceScreenshotSourceSize
          videoConstraints={{ deviceId: selectedDevice ? { exact: selectedDevice } : undefined, width: 1280, height: 720 }}
          onUserMedia={(stream) => { setLocalStream(stream); refreshDevices(); }}
          mirrored={true}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -100 }}
        />
      )}
      <canvas ref={masterCanvasRef} width={1280} height={720} style={{ display: 'none' }} />

      {/* ── Call ended ── */}
      {isEnded ? (
        <div style={{ minHeight: '100vh', background: 'var(--color-bg, #fafafa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Manrope", sans-serif', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(137,90,246,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, background: 'var(--dashboard-surface, #fff)', backdropFilter: 'blur(20px)', border: '1px solid var(--dashboard-border, #e4e4e7)', padding: '52px', borderRadius: '24px', maxWidth: '580px', width: '90%', textAlign: 'center', boxShadow: 'var(--dashboard-shadow)', animation: 'fadeUp 0.5s ease' }}>
            <div style={{ margin: '0 auto 28px', width: '76px', height: '76px', borderRadius: '50%', background: 'rgba(137,90,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(137,90,246,0.3)' }}>
              <CheckCircle2 size={38} color="#895af6" />
            </div>
            <h2 style={{ fontSize: '30px', marginBottom: '14px', color: 'var(--dashboard-text, #18181b)', fontWeight: '800', letterSpacing: '-0.5px' }}>Entretien Terminé</h2>
            <p style={{ color: 'var(--dashboard-muted, #71717a)', fontSize: '16px', lineHeight: '1.65', maxWidth: '440px', margin: '0 auto 36px' }}>
              Le recruteur a mis fin à l'appel. Merci d'avoir participé à cet entretien sur HumatiQ.
              L'équipe de recrutement analysera vos résultats et reviendra vers vous prochainement.
            </p>
            <div style={{ padding: '20px', background: 'var(--dashboard-accent-light, rgba(137,90,246,0.06))', borderRadius: '14px', border: '1px solid rgba(137,90,246,0.15)', marginBottom: '28px' }}>
              <p style={{ color: 'var(--dashboard-muted, #71717a)', fontSize: '14px', margin: 0 }}>
                Redirection automatique dans{' '}
                <span style={{ color: '#895af6', fontWeight: '800', fontSize: '18px' }}>{redirectCountdown}</span> secondes...
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/candidat/dashboard'}
              style={{ padding: '14px 32px', background: '#895af6', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 6px 20px rgba(137,90,246,0.35)', transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(137,90,246,0.45)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(137,90,246,0.35)'; }}
            >
              Retour au Dashboard
            </button>
          </div>
        </div>

      /* ── Pre-join ── */
      ) : !hasJoined ? (
        <div className="selection-view candidat-prejoin">
          <header className="prejoin-header">
            <div style={{ fontSize: '19px', fontWeight: '800', letterSpacing: '-0.3px' }}>HumatiQ</div>
            <div className="header-tabs">
              <div className="header-tab active">Meeting</div>
              <div className="header-tab">Appareils</div>
              <div className="header-tab">Réseau</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Settings size={20} strokeWidth={1.5} style={{ cursor: 'pointer' }} />
              <HelpCircle size={20} strokeWidth={1.5} style={{ cursor: 'pointer' }} />
            </div>
          </header>

          <main className="prejoin-main">
            <div className="prejoin-left">
              <div className="preview-wrapper">
                {isCamEnabled && selectedDevice ? (
                  <canvas ref={prejoinCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
                    <VideoOff size={56} color="#52525b" />
                    <div style={{ marginTop: '14px', fontSize: '14px' }}>{isCamEnabled ? 'Chargement...' : 'Caméra désactivée'}</div>
                  </div>
                )}
                <div className="preview-controls-overlay">
                  <button className={`preview-tool-btn ${!isMicEnabled ? 'off' : ''}`} onClick={() => setIsMicEnabled(!isMicEnabled)}>
                    {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button className={`preview-tool-btn ${!isCamEnabled ? 'off' : ''}`} onClick={() => setIsCamEnabled(!isCamEnabled)}>
                    {isCamEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                  <button className={`preview-tool-btn ${isBlurEnabled ? 'active' : ''}`} onClick={() => setIsBlurEnabled(!isBlurEnabled)}>
                    <Sparkles size={20} />
                  </button>
                  <div className="preview-divider" />
                  <button className="preview-tool-btn"><MoreVertical size={20} /></button>
                </div>
              </div>

              <div className="prejoin-footer-devices">
                {[
                  { key: 'mic',     label: 'Microphone',   icon: <Mic size={15} />,    list: mics,     selected: selectedMic,    setSelected: setSelectedMic,    display: micLabel },
                  { key: 'speaker', label: 'Audio Output', icon: <Volume2 size={15} />, list: speakers, selected: selectedSpeaker, setSelected: setSelectedSpeaker, display: spkLabel },
                  { key: 'cam',     label: 'Caméra',       icon: <Video size={15} />,  list: devices,  selected: selectedDevice,  setSelected: setSelectedDevice,  display: camLabel },
                ].map(({ key, label, icon, list, selected, setSelected, display }) => (
                  <div className="device-box" key={key}>
                    <span className="device-label">{label}</span>
                    <div style={{ position: 'relative' }}>
                      <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === key ? null : key)}>
                        <div className="pill-content">{icon}<span>{display}</span></div>
                        <ChevronDown size={13} />
                      </button>
                      {activeDropdown === key && (
                        <div className="device-dropdown">
                          {list.map(d => (
                            <div key={d.deviceId} className={`dropdown-item ${selected === d.deviceId ? 'active' : ''}`}
                              onClick={() => { setSelected(d.deviceId); setActiveDropdown(null); }}>
                              {d.label || `${label} ${d.deviceId.slice(0, 5)}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="prejoin-right">
              <h1 style={{ fontSize: '60px', fontWeight: '900', lineHeight: '1.05', marginBottom: '18px', letterSpacing: '-2.5px' }}>Prêt à <br />participer ?</h1>
              <p style={{ fontSize: '17px', marginBottom: '36px', lineHeight: '1.6' }}>Connectez-vous pour commencer votre entretien.</p>
              {interviewData?.status === 'no_show' ? (
                <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)', color: '#b45309', borderRadius: '14px', padding: '16px', lineHeight: 1.5, fontWeight: 700 }}>
                  {interviewData.no_show_fault === 'hr'
                    ? "Le recruteur n'a pas rejoint cet entretien. Un nouveau créneau devra être proposé."
                    : "Cet entretien est marqué comme absent et n'est plus joignable."}
                </div>
              ) : (
                <button className="join-btn" onClick={() => setHasJoined(true)}>Entrer dans la salle</button>
              )}
            </div>
          </main>
        </div>

      /* ── Live interview room ── */
      ) : (
        <div className="meeting-container candidat-room">
          {noShowWarning === 'hr_no_show' && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ width: 'min(460px, 100%)', background: 'var(--dashboard-surface, #fff)', border: '1px solid var(--dashboard-border, #e4e4e7)', borderRadius: '22px', padding: '28px', textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 18px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={32} />
                </div>
                <h3 style={{ margin: '0 0 10px', color: 'var(--dashboard-text, #18181b)', fontSize: '22px', fontWeight: 800 }}>Recruteur absent</h3>
                <p style={{ margin: '0 0 22px', color: 'var(--dashboard-muted, #71717a)', lineHeight: 1.6 }}>
                  Le recruteur n'a pas rejoint l'entretien dans les 15 minutes. L'absence sera signalée et un nouveau créneau devra être proposé.
                </p>
                <button
                  type="button"
                  onClick={() => setNoShowWarning(null)}
                  style={{ border: 0, borderRadius: '12px', padding: '12px 18px', background: '#895af6', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  J'ai compris
                </button>
              </div>
            </div>
          )}
          <div className="meeting-body">
            <main className="room-content" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              <div className={`interview-layout ${screenShareActive ? 'screen-share-mode' : ''}`}>
                {screenShareActive ? (
                  <>
                    <div className="screen-share-tile">
                      {isScreenSharing ? (
                        <video ref={screenVideoRef} autoPlay playsInline muted />
                      ) : remoteScreenStream ? (
                        <video ref={remoteScreenVideoRef} autoPlay playsInline />
                      ) : (
                        <div className="screen-share-placeholder">
                          <MonitorUp size={42} />
                          <span>Partage d'écran en cours...</span>
                        </div>
                      )}
                      <div className="screen-share-label">
                        <MonitorUp size={14} />
                        {isScreenSharing ? "Vous partagez votre écran" : "Le recruteur partage son écran"}
                      </div>
                      {isScreenSharing && (
                        <button className="screen-share-stop-btn" type="button" onClick={stopScreenShare}>
                          Arrêter le partage
                        </button>
                      )}
                    </div>

                    <div className="participant-strip">
                      <div className="participant-video-tile">
                        {remotePeerLeft ? (
                          <div className="peer-left-tile">
                            <div className="peer-avatar-circle hr left"><UserX size={22} /></div>
                            <span className="peer-avatar-name">Recruteur a quitté</span>
                          </div>
                        ) : remoteStream ? (
                          <video ref={remoteVideoRef} autoPlay playsInline />
                        ) : (
                          <div className="waiting-tile">
                            <div className="waiting-avatar-ring"><span className="peer-avatar-circle hr">R</span></div>
                            <span className="peer-avatar-name">En attente...</span>
                          </div>
                        )}
                        <div className="tile-name-badge">Recruteur</div>
                      </div>

                      <div className="participant-video-tile self">
                        {isCamEnabled ? (
                          <canvas ref={pipCanvasRef} width={1280} height={720} />
                        ) : (
                          <div className="no-cam-tile">
                            <div className="peer-avatar-circle candidat">C</div>
                            <span className="peer-avatar-name">Vous</span>
                          </div>
                        )}
                        <div className="tile-name-badge">
                          {isMicEnabled ? <Mic size={10} /> : <MicOff size={10} />}
                          Vous
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="candidate-view">
                      {remotePeerLeft ? (
                        <div className="peer-left-full">
                          <div className="peer-avatar-circle hr left"><UserX size={32} /></div>
                          <h3 className="peer-state-title">Le recruteur a quitté</h3>
                          <p className="peer-state-sub">La connexion a été interrompue</p>
                        </div>
                      ) : remoteStream ? (
                        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                      ) : (
                        <div className="waiting-full">
                          <div className="waiting-pulse-ring">
                            <div className="peer-avatar-circle hr lg">R</div>
                          </div>
                          <h3 className="peer-state-title">En attente du recruteur</h3>
                          <p className="peer-state-sub">Le recruteur n'a pas encore rejoint</p>
                          <div className="waiting-dots"><span /><span /><span /></div>
                        </div>
                      )}
                    </div>

                    <div className="recruiter-pip" style={{ right: activeSidebar ? '364px' : '24px', transition: 'right 0.3s ease' }}>
                      {isCamEnabled ? (
                        <canvas ref={pipCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                      ) : (
                        <div className="pip-no-cam">
                          <div className="peer-avatar-circle candidat sm">C</div>
                          <span className="peer-avatar-name xs">Vous</span>
                        </div>
                      )}
                      <div className="pip-label">
                        {isMicEnabled ? <Mic size={9} /> : <MicOff size={9} color="#ef4444" />}
                        <span style={{ marginLeft: '3px' }}>Vous</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </main>

            {activeSidebar && (
              <aside className="chat-panel open">
                <div className="chat-header">
                  {activeSidebar === 'chat'        && <MessageSquare size={16} style={{ marginRight: '8px' }} />}
                  {activeSidebar === 'participants' && <Users size={16} style={{ marginRight: '8px' }} />}
                  <span style={{ flex: 1 }}>
                    {activeSidebar === 'chat'        && 'Messages'}
                    {activeSidebar === 'participants' && `Participants (${participants.length})`}
                  </span>
                  <button className="chat-close-btn" onClick={() => setActiveSidebar(null)}><X size={16} /></button>
                </div>

                {activeSidebar === 'chat' && (
                  <>
                    <div className="chat-messages">
                      {messages.map(msg => (
                        <div key={msg.id} className={`chat-message ${msg.sender.startsWith('Vous') ? 'mine' : 'theirs'}`}>
                          <span className="msg-sender">{msg.sender}</span>
                          <div className="msg-bubble">{msg.text}</div>
                          <span className="msg-time">{msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="chat-input-area">
                      <input className="chat-input" type="text" placeholder="Envoyer un message..."
                        value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                      <button className="chat-send-btn" onClick={sendMessage}><Send size={16} /></button>
                    </div>
                  </>
                )}

                {activeSidebar === 'participants' && (
                  <div className="participants-list">
                    {participants.map(p => (
                      <div key={p.id} className="participant-row">
                        <div className="participant-avatar">{p.avatar}</div>
                        <div className="participant-info">
                          <span className="participant-name">{p.name}</span>
                          <span className="participant-role">{p.role}</span>
                        </div>
                        <div className="participant-status">
                          {p.mic ? <Mic size={13} color="#a1a1aa" /> : <MicOff size={13} color="#ef4444" />}
                          {p.cam ? <Video size={13} color="#a1a1aa" /> : <VideoOff size={13} color="#ef4444" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </aside>
            )}
          </div>

          <footer className="control-bar">
            <div className="meeting-details">
              <span className="time-str">{formatTime(currentTime)}</span>
              <span style={{ color: '#a1a1aa', fontSize: '12px' }}>HumatiQ · Candidat</span>
            </div>

            <div className="action-buttons">
              <button className={`round-btn ${!isMicEnabled ? 'danger' : ''}`} onClick={() => setIsMicEnabled(!isMicEnabled)}>
                {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button className={`round-btn ${!isCamEnabled ? 'danger' : ''}`} onClick={() => setIsCamEnabled(!isCamEnabled)}>
                {isCamEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button className={`round-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare}>
                <MonitorUp size={20} />
              </button>

              <div style={{ position: 'relative' }}>
                <button className="round-btn" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                  <MoreVertical size={20} />
                </button>
                {showMoreMenu && (
                  <div className="more-menu">
                    <div className="menu-item" onClick={() => { setIsBlurEnabled(!isBlurEnabled); setShowMoreMenu(false); }}>
                      {isBlurEnabled ? <ShieldOff size={18} /> : <Shield size={18} />}
                      <span>{isBlurEnabled ? 'Désactiver le mode privé' : 'Activer le mode privé'}</span>
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-item" onClick={() => { setSelectedDevice(null); setShowMoreMenu(false); }}>
                      <RotateCcw size={18} />
                      <span>Changer de caméra</span>
                    </div>
                  </div>
                )}
              </div>

              <button className="round-btn danger" onClick={resetCall}>
                <PhoneOff size={20} />
              </button>
            </div>

            <div className="sidebar-actions">
              <button className={`round-btn ${activeSidebar === 'participants' ? 'active' : ''}`} onClick={() => openSidebar('participants')} title="Participants">
                <Users size={20} />
                <span className="chat-badge" style={{ background: '#22c55e' }}>{participants.length}</span>
              </button>
              <button className={`round-btn ${activeSidebar === 'chat' ? 'active' : ''}`} onClick={() => openSidebar('chat')} title="Messages">
                <MessageSquare size={20} />
                {messages.length > 0 && activeSidebar !== 'chat' && <span className="chat-badge">{messages.length}</span>}
              </button>
            </div>
          </footer>
        </div>
      )}
    </>
  );
};

export default InterviewRoom;
