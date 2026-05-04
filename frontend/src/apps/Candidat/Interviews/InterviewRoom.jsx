import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MoreVertical,
  PhoneOff, Users, MessageSquare, Settings, HelpCircle,
  ChevronDown, Sparkles, X, Send,
  LayoutGrid, Shield, ShieldOff,
  RotateCcw, Volume2, CheckCircle2,
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

  const isMicEnabledRef = useRef(isMicEnabled);
  useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream]   = useState(null);

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
  const aiActive = hasJoined && isCamEnabled;
  const { analysis } = useInterviewAnalysis(webcamRef, aiActive);
  const { audioEmotion } = useAudioAnalyzer(hasJoined && isMicEnabled && Boolean(localStream), localStream);

  const attentionScore = useMemo(
    () => getAttentionScore(analysis.yaw, analysis.pitch),
    [analysis.yaw, analysis.pitch],
  );

  // ── WebRTC ────────────────────────────────────────────────────────────────
  const screenStreamRef   = useRef(null);
  const screenVideoRef    = useRef(null);
  const recognitionRef    = useRef(null);
  const shouldTranscribeRef = useRef(false);
  const chatEndRef        = useRef(null);
  const remoteVideoRef    = useRef(null);
  const clientIdRef = useRef('candidate_' + Math.random().toString(36).slice(2, 7));

  const handleRemoteStream = useCallback((stream) => setRemoteStream(stream), []);

  const handleDataMessage = useCallback((type, data) => {
    if (type === 'chat') {
      setMessages(prev => [...prev, { id: Date.now(), text: data.text, sender: data.sender, time: new Date() }]);
    } else if (type === 'end-call') {
      cleanupRTC();
      setIsEnded(true);
    }
  }, []);

  const { initConnection, cleanup: cleanupRTC, sendData } = useWebRTC(
    interviewId, clientIdRef.current, localStream, handleRemoteStream, handleDataMessage,
  );

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Silently forward emotion + attention data to HR ─────────────────────
  useEffect(() => {
    if (!hasJoined || (analysis.status === 'no_face' && !audioEmotion)) return;

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
  }, [analysis, audioEmotion, attentionScore, hasJoined, sendData]);

  // ── Candidate-side transcript capture is silent; HR is the only UI consumer ──
  useEffect(() => {
    if (!hasJoined) {
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
  }, [hasJoined, interviewId, sendData]);

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
          const ctx = masterCanvasRef.current.getContext('2d');
          ctx.drawImage(webcamRef.current.video, 0, 0, 1280, 720);
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

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) { stopScreenShare(); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = stopScreenShare;
      setIsScreenSharing(true);
    } catch { console.log('Screen share cancelled'); }
  };

  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current)
      screenVideoRef.current.srcObject = screenStreamRef.current;
  }, [isScreenSharing]);

  useEffect(() => {
    if (hasJoined) { initConnection(); }
    else           { cleanupRTC(); setRemoteStream(null); }
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

  const sendMessage = () => {
    const t = chatInput.trim(); if (!t) return;
    setMessages(prev => [...prev, { id: Date.now(), text: t, sender: 'Vous (Candidat)', time: new Date() }]);
    sendData('chat', { text: t, sender: 'Candidat' });
    setChatInput('');
  };

  const resetCall = () => {
    stopScreenShare();
    shouldTranscribeRef.current = false;
    recognitionRef.current?.stop();
    setHasJoined(false); setActiveSidebar(null);
  };

  const openSidebar = (name) => setActiveSidebar(prev => prev === name ? null : name);

  const micLabel = mics.find(d => d.deviceId === selectedMic)?.label || 'Microphone';
  const camLabel = devices.find(d => d.deviceId === selectedDevice)?.label || 'Camera';
  const spkLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || 'Audio Output';

  return (
    <>
      {/* Hidden master webcam – source for WebRTC, blur, and AI analysis */}
      {isCamEnabled && (
        <Webcam
          ref={webcamRef}
          audio={true}
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
      {/* Hidden master canvas for blur/raw frames */}
      <canvas ref={masterCanvasRef} width={1280} height={720} style={{ display: 'none' }} />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Call ended view                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isEnded ? (
        <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(252,211,77,0.04) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, background: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', padding: '56px', borderRadius: '24px', maxWidth: '650px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'fadeUp 0.6s ease' }}>
            <div style={{ margin: '0 auto 32px auto', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(74,222,128,0.3)' }}>
              <CheckCircle2 size={40} color="#4ade80" />
            </div>
            <h2 style={{ fontSize: '32px', marginBottom: '16px', color: '#f8fafc', fontWeight: '800', letterSpacing: '-0.5px' }}>Entretien Terminé</h2>
            <p style={{ color: '#94a3b8', fontSize: '18px', marginBottom: '40px', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 40px auto' }}>
              Le recruteur a mis fin à l'appel. Merci d'avoir participé à cet entretien d'embauche sur la plateforme HumatiQ.
              <br /><br />
              L'équipe de recrutement analysera vos résultats et reviendra vers vous très prochainement.
            </p>
            <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
              <p style={{ color: '#d1d5db', fontSize: '15px', margin: 0 }}>
                Redirection automatique dans{' '}
                <span style={{ color: '#fcd34d', fontWeight: '700', fontSize: '18px' }}>{redirectCountdown}</span> secondes...
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/candidat/dashboard'}
              style={{ padding: '16px 36px', background: '#fcd34d', color: '#111827', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 14px 0 rgba(252,211,77,0.39)' }}
              onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.target.style.transform = 'translateY(0)'}
            >
              Retour immédiat au Dashboard
            </button>
          </div>
        </div>

      /* ═══════════════════════════════════════════════════════════════════ */
      /* Pre-join view                                                      */
      /* ═══════════════════════════════════════════════════════════════════ */
      ) : !hasJoined ? (
        <div className="selection-view">
          <header className="prejoin-header">
            <div style={{ fontSize: '20px', fontWeight: '700' }}>HumatiQ</div>
            <div className="header-tabs">
              <div className="header-tab active">Meeting</div>
              <div className="header-tab">Devices</div>
              <div className="header-tab">Network</div>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Settings size={22} color="#9ca3af" strokeWidth={1.5} style={{ cursor: 'pointer' }} />
              <HelpCircle size={22} color="#9ca3af" strokeWidth={1.5} style={{ cursor: 'pointer' }} />
            </div>
          </header>

          <main className="prejoin-main">
            <div className="prejoin-left">
              <div className="preview-wrapper">
                {isCamEnabled && selectedDevice ? (
                  <canvas ref={prejoinCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111827' }}>
                    <VideoOff size={64} color="#5f6368" />
                    <div style={{ color: '#9ca3af', marginTop: '16px', fontSize: '14px' }}>{isCamEnabled ? 'Chargement...' : 'Caméra désactivée'}</div>
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
                  { key: 'mic',     label: 'Microphone',   icon: <Mic size={16} />,    list: mics,     selected: selectedMic,      setSelected: setSelectedMic,      display: micLabel },
                  { key: 'speaker', label: 'Audio Output', icon: <Volume2 size={16} />, list: speakers, selected: selectedSpeaker,   setSelected: setSelectedSpeaker,  display: spkLabel },
                  { key: 'cam',     label: 'Camera',       icon: <Video size={16} />,  list: devices,  selected: selectedDevice,    setSelected: setSelectedDevice,   display: camLabel },
                ].map(({ key, label, icon, list, selected, setSelected, display }) => (
                  <div className="device-box" key={key}>
                    <span className="device-label">{label}</span>
                    <div style={{ position: 'relative' }}>
                      <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === key ? null : key)}>
                        <div className="pill-content">{icon}<span>{display}</span></div>
                        <ChevronDown size={14} />
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
              <h1 style={{ fontSize: '64px', fontWeight: '800', lineHeight: '1.1', marginBottom: '20px', letterSpacing: '-2px' }}>Prêt à <br /> participer ?</h1>
              <p style={{ fontSize: '18px', color: '#4b5563', marginBottom: '40px' }}>Connectez-vous pour commencer votre entretien.</p>
              <button className="join-btn" onClick={() => setHasJoined(true)}>Entrer dans la salle</button>
            </div>
          </main>
        </div>

      /* ═══════════════════════════════════════════════════════════════════ */
      /* Live interview room                                               */
      /* ═══════════════════════════════════════════════════════════════════ */
      ) : (
        <div className="meeting-container">
          <div className="meeting-body">
            <main className="room-content" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              <div className="interview-layout">
                <div className="candidate-view">
                  {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : isScreenSharing ? (
                    <video ref={screenVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div className="waiting-placeholder-container" style={{ background: '#000' }}>
                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                        <Users size={56} color="white" strokeWidth={1.5} />
                      </div>
                      <div className="waiting-text-title" style={{ color: 'white' }}>En attente du recruteur...</div>
                    </div>
                  )}

                </div>

                {/* ── Candidate PIP (clean – no AI indicators shown to candidate) ── */}
                <div
                  className="recruiter-pip"
                  style={{ right: activeSidebar ? '364px' : '24px', transition: 'right 0.3s ease', position: 'relative' }}
                >
                  {isCamEnabled ? (
                    <canvas
                      ref={pipCanvasRef}
                      width={1280}
                      height={720}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e' }}>
                      <VideoOff size={40} color="#3c4043" />
                    </div>
                  )}

                  <div className="pip-label">
                    {isMicEnabled ? <Mic size={10} /> : <MicOff size={10} color="#ea4335" />}
                    <span style={{ marginLeft: '4px' }}>Vous</span>
                  </div>
                </div>
              </div>
            </main>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            {activeSidebar && (
              <aside className="chat-panel open">
                <div className="chat-header">
                  {activeSidebar === 'chat'         && <MessageSquare size={18} style={{ marginRight: '8px' }} />}
                  {activeSidebar === 'participants'  && <Users size={18} style={{ marginRight: '8px' }} />}
                  {activeSidebar === 'tools'         && <LayoutGrid size={18} style={{ marginRight: '8px' }} />}
                  <span>
                    {activeSidebar === 'chat'        && 'Messages'}
                    {activeSidebar === 'participants' && `Participants (${participants.length})`}
                    {activeSidebar === 'tools'        && 'Outils de session'}
                  </span>
                  <button className="chat-close-btn" onClick={() => setActiveSidebar(null)}><X size={18} /></button>
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
                      <input
                        className="chat-input"
                        type="text"
                        placeholder="Envoyer un message..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      />
                      <button className="chat-send-btn" onClick={sendMessage}><Send size={18} /></button>
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
                          {p.mic ? <Mic size={14} color="#bdc1c6" /> : <MicOff size={14} color="#ea4335" />}
                          {p.cam ? <Video size={14} color="#bdc1c6" /> : <VideoOff size={14} color="#ea4335" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeSidebar === 'tools' && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#bdc1c6', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      Les outils d'analyse de l'entretien sont contrôlés par le recruteur.
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>

          {/* ── Control bar ─────────────────────────────────────────────────── */}
          <footer className="control-bar">
            <div className="meeting-details">
              <span className="time-str">{formatTime(currentTime)}</span>
              <span style={{ color: '#bdc1c6', fontSize: '0.9rem' }}>Meeting Room | HumatiQ</span>
            </div>

            <div className="action-buttons">
              <button className={`round-btn ${!isMicEnabled ? 'danger' : ''}`} onClick={() => setIsMicEnabled(!isMicEnabled)}>
                {isMicEnabled ? <Mic size={22} /> : <MicOff size={22} />}
              </button>

              <button className={`round-btn ${!isCamEnabled ? 'danger' : ''}`} onClick={() => setIsCamEnabled(!isCamEnabled)}>
                {isCamEnabled ? <Video size={22} /> : <VideoOff size={22} />}
              </button>

              <button className={`round-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare}>
                <MonitorUp size={22} />
              </button>

              <div style={{ position: 'relative' }}>
                <button className="round-btn" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                  <MoreVertical size={22} />
                </button>
                {showMoreMenu && (
                  <div className="more-menu">
                    <div className="menu-item" onClick={() => { setIsBlurEnabled(!isBlurEnabled); setShowMoreMenu(false); }}>
                      {isBlurEnabled ? <ShieldOff size={20} /> : <Shield size={20} />}
                      <span>{isBlurEnabled ? 'Désactiver le mode privé' : 'Activer le mode privé'}</span>
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-item" onClick={() => { setSelectedDevice(null); setShowMoreMenu(false); }}>
                      <RotateCcw size={20} />
                      <span>Changer de caméra</span>
                    </div>
                  </div>
                )}
              </div>

              <button className="round-btn danger" onClick={resetCall}>
                <PhoneOff size={22} />
              </button>
            </div>

            <div className="sidebar-actions">
              <button
                className={`round-btn ${activeSidebar === 'participants' ? 'active' : ''}`}
                onClick={() => openSidebar('participants')}
                title="Participants"
              >
                <Users size={22} />
                <span className="chat-badge" style={{ background: '#34a853' }}>{participants.length}</span>
              </button>
              <button
                className={`round-btn ${activeSidebar === 'chat' ? 'active' : ''}`}
                onClick={() => openSidebar('chat')}
                title="Messages"
              >
                <MessageSquare size={22} />
                {messages.length > 0 && activeSidebar !== 'chat' && (
                  <span className="chat-badge">{messages.length}</span>
                )}
              </button>
              <button
                className={`round-btn ${activeSidebar === 'tools' ? 'active' : ''}`}
                onClick={() => openSidebar('tools')}
                title="Outils"
              >
                <LayoutGrid size={22} />
              </button>
            </div>
          </footer>
        </div>
      )}
    </>
  );
};

export default InterviewRoom;
