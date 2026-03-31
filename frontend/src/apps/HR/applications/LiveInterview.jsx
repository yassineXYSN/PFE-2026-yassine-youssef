import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useBackgroundBlur } from '../../../hooks/useBackgroundBlur';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { apiFetch } from '../../../core/api';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MoreVertical,
  PhoneOff, Users, MessageSquare, Settings, HelpCircle,
  ChevronDown, Sparkles, X, Brain, Send, NotebookPen,
  LayoutGrid, Circle, MessageSquareText, Shield, ShieldOff,
  RotateCcw, LayoutDashboard, SquareTerminal, Volume2,
  CheckCircle2, AlertTriangle
} from 'lucide-react';
import './FaceAffectus.css';

const LiveInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [mics, setMics] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedMic, setSelectedMic] = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [hasJoined, setHasJoined] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [activeSidebar, setActiveSidebar] = useState(null);
  const [messages, setMessages] = useState([{ id: 1, text: 'Bonjour, la session va commencer.', sender: 'Système', time: new Date() }]);
  const [chatInput, setChatInput] = useState('');
  const [notes, setNotes] = useState('');
  const [participants] = useState([
    { id: 1, name: 'Vous (Recruteur)', role: 'Hôte', mic: true, cam: true, avatar: 'R' },
    { id: 2, name: 'Candidat', role: 'Invité', mic: true, cam: true, avatar: 'C' },
  ]);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [results, setResults] = useState([]);
  const [emotionLabel, setEmotionLabel] = useState('');

  // Stable ref for emotion translations (never changes)
  const emotionFR = useRef({ angry: '😡 Colère', disgust: '🤢 Dégoût', fear: '😨 Peur', happy: '😊 Joie', neutral: '😐 Neutre', sad: '😢 Tristesse', surprise: '😲 Surprise' });
  const sendDataRef = useRef(null);

  const webcamRef = useRef(null);
  const masterCanvasRef = useRef(null);
  const analyzeCanvasRef = useRef(null); // hidden canvas for AI frame capture (candidate face)
  const prejoinCanvasRef = useRef(null);
  const pipCanvasRef = useRef(null);

  const { isLoaded: isBlurLoaded, processFrame } = useBackgroundBlur(webcamRef.current?.video, masterCanvasRef.current, isBlurEnabled);
  const screenStreamRef = useRef(null);
  const screenVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const clientIdRef = useRef('recruiter_' + Math.random().toString(36).slice(2, 7));

  const handleRemoteStream = useCallback((stream) => {
    setRemoteStream(stream);
  }, []);

  const handleDataMessage = useCallback((type, data) => {
    if (type === 'chat') {
      setMessages(prev => [...prev, { id: Date.now(), text: data.text, sender: data.sender, time: new Date() }]);
    } else if (type === 'transcript') {
      setTranscriptHistory(prev => [...prev, { sender: data.sender, text: data.text, time: new Date() }]);
    }
  }, []);

  const { initConnection, cleanup: cleanupRTC, sendData } = useWebRTC(
    interviewId,
    clientIdRef.current,
    localStream,
    handleRemoteStream,
    handleDataMessage
  );

  // Keep sendDataRef always up-to-date so capture can use it without being in deps
  useEffect(() => { sendDataRef.current = sendData; }, [sendData]);

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Handle Blur/Raw tracking loop
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
          // Draw raw fallback directly
          const ctx = masterCanvasRef.current.getContext('2d');
          ctx.drawImage(webcamRef.current.video, 0, 0, 1280, 720);
        }

        // Copy to active viewing canvas
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

  const handleDevices = useCallback((mediaDevices) => {
    const cams = mediaDevices.filter(d => d.kind === 'videoinput');
    const micsArr = mediaDevices.filter(d => d.kind === 'audioinput');
    const spkrs = mediaDevices.filter(d => d.kind === 'audiooutput');
    setDevices(cams); setMics(micsArr); setSpeakers(spkrs);
    if (cams.length > 0 && !selectedDevice) setSelectedDevice(cams[0].deviceId);
    if (micsArr.length > 0 && !selectedMic) setSelectedMic(micsArr[0].deviceId);
    if (spkrs.length > 0 && !selectedSpeaker) setSelectedSpeaker(spkrs[0].deviceId);
  }, [selectedDevice, selectedMic, selectedSpeaker]);

  const refreshDevices = useCallback(async () => {
    try { 
      handleDevices(await navigator.mediaDevices.enumerateDevices()); 
      if (webcamRef.current?.stream) setLocalStream(webcamRef.current.stream);
    } catch (e) { console.error(e); }
  }, [handleDevices]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);
  useEffect(() => { if (activeSidebar === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeSidebar]);
  useEffect(() => { if (!isCamEnabled) setIsAnalyzing(false); }, [isCamEnabled]);

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null; setIsScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) { stopScreenShare(); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      setIsScreenSharing(true);
    } catch (e) { console.log('Screen share cancelled'); }
  };

  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  useEffect(() => {
    if (hasJoined) {
      initConnection();
    } else {
      cleanupRTC();
      setRemoteStream(null);
    }
  }, [hasJoined, initConnection, cleanupRTC]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
      setIsRecording(false); return;
    }
    try {
      const stream = webcamRef.current?.stream || webcamRef.current?.video?.srcObject;
      if (!stream) return;
      recordedChunksRef.current = [];
      const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const type = types.find(t => MediaRecorder.isTypeSupported(t));
      const recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (!recordedChunksRef.current.length) return;
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(recordedChunksRef.current, { type: 'video/webm' })), download: `HumatiQ_${Date.now()}.webm` });
        a.click();
      };
      mediaRecorderRef.current = recorder; recorder.start(1000); setIsRecording(true);
    } catch (e) { console.error('Recording error:', e); }
  };

  const toggleTranscription = () => {
    if (isTranscriptionEnabled) {
      recognitionRef.current?.stop(); setIsTranscriptionEnabled(false); setCurrentTranscript(''); return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Transcription non supportée dans ce navigateur."); return; }
    const r = new SpeechRecognition();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          const entry = { sender: 'Recruteur', text, time: new Date() };
          setTranscriptHistory(prev => [...prev, entry]);
          // Share transcript with candidate via WebSocket
          sendData('transcript', { sender: 'Recruteur', text });
          
          // Save to backend MongoDB for post-interview analysis
          apiFetch(`/interviews/${interviewId}/transcript`, {
            method: 'POST',
            body: JSON.stringify({ sender: 'Recruteur', text })
          }).catch(err => console.error('[Transcript] Failed to save to DB:', err));
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setCurrentTranscript(interim);
    };
    r.onerror = () => setIsTranscriptionEnabled(false);
    recognitionRef.current = r; r.start(); setIsTranscriptionEnabled(true);
  };

  const downloadTranscript = () => {
    if (!transcriptHistory.length) { alert('Aucun texte.'); return; }
    const content = transcriptHistory.map(e => `[${e.time.toLocaleTimeString()}] ${e.sender}: ${e.text}`).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: `Transcript_${Date.now()}.txt` });
    a.click();
  };

  const capture = useCallback(async () => {
    const remoteVideo = remoteVideoRef.current;
    const canvas = analyzeCanvasRef.current;

    if (!remoteVideo || !canvas) {
      console.warn('[Analyze] Remote video not available yet');
      return;
    }
    if (remoteVideo.readyState < 2) {
      console.warn('[Analyze] Remote video not ready (readyState:', remoteVideo.readyState, ')');
      return;
    }

    // Draw candidate's face from the remote stream to the hidden canvas
    const ctx = canvas.getContext('2d');
    canvas.width = remoteVideo.videoWidth || 640;
    canvas.height = remoteVideo.videoHeight || 360;
    ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (dataUrl.length < 1000) {
      console.warn('[Analyze] Canvas appears empty/blank');
      return;
    }

    const blob = await (await fetch(dataUrl)).blob();
    const fd = new FormData(); fd.append('file', blob, 'frame.jpg');
    try {
      const data = await apiFetch(`/interviews/${interviewId}/analyze`, { method: 'POST', body: fd });
      const r = data.results || [];
      console.log('[Analyze] Results:', r);
      setResults(r);
      if (r.length > 0) {
        const label = emotionFR.current[r[0].emotion] || r[0].emotion;
        setEmotionLabel(label);
        sendDataRef.current?.('emotion', { emotion: r[0].emotion, label });
      } else {
        console.warn('[Analyze] No face detected in remote frame');
      }
    } catch (e) { console.error('[Analyze] API error:', e); }
  }, [interviewId]);

  useEffect(() => {
    let iv;
    if (isAnalyzing && isCamEnabled) iv = setInterval(capture, 1000);
    return () => clearInterval(iv);
  }, [isAnalyzing, isCamEnabled, capture]);

  const sendMessage = () => {
    const t = chatInput.trim(); if (!t) return;
    setMessages(prev => [...prev, { id: Date.now(), text: t, sender: 'Vous (Recruteur)', time: new Date() }]);
    // Relay to candidate via WebSocket
    sendData('chat', { text: t, sender: 'Recruteur' });
    setChatInput('');
  };

  const resetCall = () => {
    stopScreenShare();
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    if (sendDataRef.current) sendDataRef.current('end-call', {}); // Notify candidate
    setHasJoined(false); setIsAnalyzing(false); setResults([]);
    setActiveSidebar(null);
    setIsRecording(false); setIsTranscriptionEnabled(false);
    setIsEnded(true);
  };

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await apiFetch(`/interviews/${interviewId}/summarize`, { method: 'POST' });
      if (res.status === 'success') setAiSummary(res.data);
    } catch(e) { console.error(e); } finally {
      setIsGeneratingSummary(false);
    }
  };

  const openSidebar = (name) => setActiveSidebar(prev => prev === name ? null : name);

  const micLabel = mics.find(d => d.deviceId === selectedMic)?.label || 'Microphone';
  const camLabel = devices.find(d => d.deviceId === selectedDevice)?.label || 'Camera';
  const spkLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || 'Audio Output';

  if (isEnded) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow effects */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(252,211,77,0.03) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative', zIndex: 1, background: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', padding: '56px', borderRadius: '24px', maxWidth: '900px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: '800', color: '#f9fafb', letterSpacing: '-0.5px', marginBottom: '16px' }}>Entretien Terminé</h2>
            <p style={{ color: '#9ca3af', fontSize: '18px', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>Les données ont été sécurisées. Générez une analyse approfondie pour évaluer le plein potentiel du candidat.</p>
          </div>
          
          {!aiSummary ? (
             <div style={{ display: 'flex', justifyContent: 'center' }}>
               <button onClick={generateAISummary} disabled={isGeneratingSummary} 
                 style={{ 
                   padding: '16px 36px', background: isGeneratingSummary ? '#374151' : '#fcd34d', 
                   color: isGeneratingSummary ? '#9ca3af' : '#111827', border: 'none', borderRadius: '12px', 
                   fontSize: '18px', fontWeight: '700', cursor: isGeneratingSummary ? 'wait' : 'pointer', 
                   display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s ease',
                   boxShadow: isGeneratingSummary ? 'none' : '0 10px 25px -5px rgba(252, 211, 77, 0.3)'
                 }}>
                 <Brain size={24} style={{ animation: isGeneratingSummary ? 'pulse 2s infinite' : 'none' }} />
                 {isGeneratingSummary ? 'Analyse en cours (10-30s)...' : 'Générer le Bilan IA'}
               </button>
             </div>
          ) : (
            <div style={{ animation: 'fadeUp 0.6s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px', background: 'linear-gradient(90deg, rgba(252,211,77,0.08) 0%, transparent 100%)', padding: '32px', borderRadius: '20px', borderLeft: '4px solid #fcd34d' }}>
                <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(17, 24, 39, 0.9)', border: '2px solid rgba(252,211,77,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 30px rgba(252,211,77,0.15)' }}>
                  <span style={{ color: '#fcd34d', fontSize: '32px', fontWeight: '800' }}>{aiSummary.overall_score}</span>
                </div>
                <div>
                  <h3 style={{ color: '#f9fafb', fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>Bilan Synthétique</h3>
                  <p style={{ color: '#d1d5db', fontSize: '16px', lineHeight: '1.7' }}>{aiSummary.summary}</p>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '32px', transition: 'transform 0.2s ease', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(252,211,77,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                  <h4 style={{ color: '#fcd34d', fontSize: '18px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircle2 size={22} /> Points Forts
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {aiSummary.strengths.map((s,i) => (
                      <li key={i} style={{ color: '#e5e7eb', fontSize: '15px', display: 'flex', gap: '16px', alignItems: 'flex-start', lineHeight: '1.6' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fcd34d', marginTop: '9px', flexShrink: 0, boxShadow: '0 0 8px rgba(252,211,77,0.5)' }} />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '32px', transition: 'transform 0.2s ease', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(156,163,175,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                  <h4 style={{ color: '#9ca3af', fontSize: '18px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertTriangle size={22} /> Axes d'Amélioration
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {aiSummary.weaknesses.map((w,i) => (
                      <li key={i} style={{ color: '#d1d5db', fontSize: '15px', display: 'flex', gap: '16px', alignItems: 'flex-start', lineHeight: '1.6' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6b7280', marginTop: '9px', flexShrink: 0 }} />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => window.location.href='/hr/selection'} style={{ padding: '16px 36px', background: 'transparent', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.target.style.background = 'rgba(252,211,77,0.05)'; e.target.style.borderColor = 'rgba(252,211,77,0.5)'; }} onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(252,211,77,0.3)'; }}>
                  Retour à mes candidats
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hidden Master Webcam for Media stream origin */}
      {isCamEnabled && (
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          videoConstraints={{ deviceId: selectedDevice ? { exact: selectedDevice } : undefined, width: 1280, height: 720 }} 
          onUserMedia={(stream) => {
            setLocalStream(stream);
            refreshDevices();
          }} 
          mirrored={true} 
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -100 }} 
        />
      )}
      {/* Hidden Master Canvas for Blur/Raw AI frames */}
      <canvas ref={masterCanvasRef} width={1280} height={720} style={{ display: 'none' }} />
      {/* Hidden canvas for AI emotion analysis — captures candidate's remote frame */}
      <canvas ref={analyzeCanvasRef} style={{ display: 'none' }} />


      {!hasJoined ? (
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
            <div style={{ width: '40px', height: '40px', background: '#111827', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white' }}>HR</div>
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
                { key: 'mic', label: 'Microphone', icon: <Mic size={16} />, list: mics, selected: selectedMic, setSelected: setSelectedMic, display: micLabel },
                { key: 'speaker', label: 'Audio Output', icon: <Volume2 size={16} />, list: speakers, selected: selectedSpeaker, setSelected: setSelectedSpeaker, display: spkLabel },
                { key: 'cam', label: 'Camera', icon: <Video size={16} />, list: devices, selected: selectedDevice, setSelected: setSelectedDevice, display: camLabel },
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
            <p style={{ fontSize: '18px', color: '#4b5563', marginBottom: '40px' }}>Personne d'autre ne participe à cet appel actuellement.</p>
            <button className="join-btn" onClick={() => { setHasJoined(true); setIsAnalyzing(true); }}>
              Rejoindre l'entretien
            </button>
          </div>
        </main>
      </div>
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
                  <div className="waiting-text-title" style={{ color: 'white' }}>En attente du candidat...</div>
                </div>
              )}

              {/* Emotion Badge – shown when analysis is active */}
              {isAnalyzing && emotionLabel && (
                <div className="emotion-badge">{emotionLabel}</div>
              )}

              {/* REC indicator */}
              {isRecording && (
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(234,67,53,0.85)', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 20 }}>
                  <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></div>
                  REC
                </div>
              )}
            </div>

            {/* Subtitles */}
            {isTranscriptionEnabled && currentTranscript && (
              <div className="subtitles-overlay"><div className="subtitle-text">{currentTranscript}</div></div>
            )}

            {/* PIP */}
            <div className="recruiter-pip" style={{ right: activeSidebar ? '364px' : '24px', transition: 'right 0.3s ease' }}>
              {isCamEnabled ? (
                <canvas ref={pipCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
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

        {/* ===== SINGLE SIDEBAR SLOT ===== */}
        {activeSidebar && (
          <aside className="chat-panel open">
            {/* Header */}
            <div className="chat-header">
              {activeSidebar === 'chat' && <MessageSquare size={18} style={{ marginRight: '8px' }} />}
              {activeSidebar === 'participants' && <Users size={18} style={{ marginRight: '8px' }} />}
              {activeSidebar === 'notes' && <NotebookPen size={18} style={{ marginRight: '8px' }} />}
              {activeSidebar === 'tools' && <LayoutGrid size={18} style={{ marginRight: '8px' }} />}
              <span>
                {activeSidebar === 'chat' && 'Messages'}
                {activeSidebar === 'participants' && `Participants (${participants.length})`}
                {activeSidebar === 'notes' && 'Notes de session'}
                {activeSidebar === 'tools' && 'Outils de session'}
              </span>
              <button className="chat-close-btn" onClick={() => setActiveSidebar(null)}><X size={18} /></button>
            </div>

            {/* Chat content */}
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
                  <input className="chat-input" type="text" placeholder="Envoyer un message..." value={chatInput}
                    onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                  <button className="chat-send-btn" onClick={sendMessage}><Send size={18} /></button>
                </div>
              </>
            )}

            {/* Participants content */}
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

            {/* Notes content */}
            {activeSidebar === 'notes' && (
              <div className="notes-container">
                <textarea className="notes-textarea" placeholder="Prenez vos notes ici..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            )}

            {/* Tools content */}
            {activeSidebar === 'tools' && (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div onClick={toggleRecording} style={{ background: isRecording ? 'rgba(234,67,53,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isRecording ? '#ea4335' : 'rgba(255,255,255,0.1)'}`, padding: '16px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
                  <div style={{ padding: '8px', background: isRecording ? '#ea4335' : '#3c4043', borderRadius: '50%', display: 'flex' }}>
                    <Circle size={18} color="white" fill={isRecording ? 'white' : 'transparent'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#e8eaed' }}>{isRecording ? 'Enregistrement...' : 'Enregistrer la session'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#bdc1c6' }}>Audio et vidéo de l'entretien</div>
                  </div>
                </div>

                <div onClick={toggleTranscription} style={{ background: isTranscriptionEnabled ? 'rgba(138,180,248,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isTranscriptionEnabled ? '#8ab4f8' : 'rgba(255,255,255,0.1)'}`, padding: '16px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}>
                  <div style={{ padding: '8px', background: isTranscriptionEnabled ? '#8ab4f8' : '#3c4043', borderRadius: '50%', display: 'flex' }}>
                    <MessageSquareText size={18} color={isTranscriptionEnabled ? '#202124' : 'white'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#e8eaed' }}>Transcription IA</div>
                    <div style={{ fontSize: '0.75rem', color: '#bdc1c6' }}>Sous-titres en temps réel</div>
                  </div>
                  <div style={{ width: '36px', height: '20px', background: isTranscriptionEnabled ? '#8ab4f8' : '#3c4043', borderRadius: '10px', position: 'relative', transition: 'all 0.2s' }}>
                    <div style={{ position: 'absolute', top: '2px', left: isTranscriptionEnabled ? '18px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: 'all 0.2s' }} />
                  </div>
                </div>

                {isTranscriptionEnabled && (
                  <button onClick={downloadTranscript} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #8ab4f8', background: 'transparent', color: '#8ab4f8', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <SquareTerminal size={14} />
                    Télécharger le Transcript
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ===== CONTROL BAR (exact Face-Affectus structure) ===== */}
      <footer className="control-bar">
        <div className="meeting-details">
          <span className="time-str">{formatTime(currentTime)}</span>
          <span style={{ color: '#bdc1c6', fontSize: '0.9rem' }}>Meeting Room | HumatiQ</span>
        </div>

        <div className="action-buttons">
          <button className={`round-btn ${!isMicEnabled ? 'danger' : ''}`} onClick={() => setIsMicEnabled(!isMicEnabled)} title={isMicEnabled ? 'Couper le micro' : 'Activer le micro'}>
            {isMicEnabled ? <Mic size={22} /> : <MicOff size={22} />}
          </button>

          <button className={`round-btn ${!isCamEnabled ? 'danger' : ''}`} onClick={() => setIsCamEnabled(!isCamEnabled)} title={isCamEnabled ? 'Couper la caméra' : 'Activer la caméra'}>
            {isCamEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          </button>

          <button className={`round-btn ${isAnalyzing ? 'brain-active' : ''}`} onClick={() => setIsAnalyzing(!isAnalyzing)} title={isAnalyzing ? "Arrêter l'analyse" : "Démarrer l'analyse IA"}>
            <Brain size={22} />
          </button>

          <button className={`round-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title={isScreenSharing ? 'Arrêter le partage' : "Partager l'écran"}>
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
                <div className="menu-item">
                  <LayoutDashboard size={20} />
                  <span>Statistiques de session</span>
                </div>
              </div>
            )}
          </div>

          <button className="round-btn danger" onClick={resetCall} title="Terminer l'appel">
            <PhoneOff size={22} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button className={`round-btn ${activeSidebar === 'tools' ? 'active' : ''}`}
            onClick={() => openSidebar('tools')} title="Outils de session">
            <LayoutGrid size={22} />
          </button>
          <button className={`round-btn ${activeSidebar === 'participants' ? 'active' : ''}`}
            onClick={() => openSidebar('participants')} title="Participants">
            <Users size={22} />
            <span className="chat-badge" style={{ background: '#34a853' }}>{participants.length}</span>
          </button>
          <button className={`round-btn ${activeSidebar === 'chat' ? 'active' : ''}`}
            onClick={() => openSidebar('chat')} title="Messages">
            <MessageSquare size={22} />
            {messages.length > 0 && activeSidebar !== 'chat' && (
              <span className="chat-badge">{messages.length}</span>
            )}
          </button>
          <button className={`round-btn ${activeSidebar === 'notes' ? 'active' : ''}`}
            onClick={() => openSidebar('notes')} title="Notes de session">
            <NotebookPen size={22} />
          </button>
        </div>
      </footer>
    </div>
    )}
    </>
  );
};

export default LiveInterview;
