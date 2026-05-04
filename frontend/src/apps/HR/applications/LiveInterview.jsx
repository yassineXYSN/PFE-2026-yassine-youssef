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
  CheckCircle2, AlertTriangle, Activity, Eye, Target,
} from 'lucide-react';
import './FaceAffectus.css';
import './LiveInterview.css';

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

const EMOTION_MAP = {
  angry: '😡', anger: '😡', disgust: '🤢', fear: '😨',
  happy: '😊', joy: '😊', neutral: '😐',
  sad: '😢', sadness: '😢', surprise: '😲',
};

const EMOTION_FR = {
  angry: 'Colère', anger: 'Colère', disgust: 'Dégoût', fear: 'Peur',
  happy: 'Joie', joy: 'Joie', neutral: 'Neutre',
  sad: 'Tristesse', sadness: 'Tristesse', surprise: 'Surprise',
};

const emojiFor = (e) => EMOTION_MAP[(e ?? '').toLowerCase()] ?? '😐';
const labelFor = (e) => EMOTION_FR[(e ?? '').toLowerCase()] ?? (e ?? '—');

const computeEngagement = (timeline, stats) => {
  if (!timeline.length) return 0;
  const avgAttn = timeline.reduce((s, x) => s + (x.attention_score || 0), 0) / timeline.length;
  const lookPct = (timeline.filter(x => x.is_looking).length / timeline.length) * 100;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  let emotionBonus = 0;
  if (total > 0) {
    const pos = ['happy', 'joy', 'surprise'].reduce((s, k) => s + (stats[k] || 0), 0);
    const neg = ['angry', 'disgust', 'fear', 'sad', 'sadness'].reduce((s, k) => s + (stats[k] || 0), 0);
    emotionBonus = ((pos - neg * 0.5) / total) * 20;
  }
  return Math.min(100, Math.max(0, Math.round(avgAttn * 0.5 + lookPct * 0.3 + emotionBonus)));
};

const engagementColor = (score) =>
  score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';

// ---------------------------------------------------------------------------

const LiveInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();

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
  const [isEnded, setIsEnded]               = useState(false);
  const [interviewData, setInterviewData]   = useState(null);

  const [activeSidebar, setActiveSidebar]   = useState(null);
  const [messages, setMessages]             = useState([{ id: 1, text: 'Bonjour, la session va commencer.', sender: 'Système', time: new Date() }]);
  const [chatInput, setChatInput]           = useState('');
  const [notes, setNotes]                   = useState('');
  const [participants]                      = useState([
    { id: 1, name: 'Vous (Recruteur)', role: 'Hôte',   mic: true, cam: true, avatar: 'R' },
    { id: 2, name: 'Candidat',         role: 'Invité', mic: true, cam: true, avatar: 'C' },
  ]);

  const [isRecording, setIsRecording]                       = useState(false);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);
  const [currentTranscript, setCurrentTranscript]           = useState('');
  const [transcriptHistory, setTranscriptHistory]           = useState([]);

  const [emotionTimeline, setEmotionTimeline]     = useState([]);
  const [emotionStats, setEmotionStats]           = useState({});
  const [audioEmotionStats, setAudioEmotionStats] = useState({});
  const [currentEmotionData, setCurrentEmotionData] = useState(null);

  const [aiSummary, setAiSummary]               = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const sendDataRef   = useRef(null);
  const isMicEnabledRef = useRef(isMicEnabled);
  useEffect(() => { isMicEnabledRef.current = isMicEnabled; }, [isMicEnabled]);

  const webcamRef          = useRef(null);
  const masterCanvasRef    = useRef(null);
  const prejoinCanvasRef   = useRef(null);
  const pipCanvasRef       = useRef(null);
  const recordingCanvasRef = useRef(null);
  const audioContextRef    = useRef(null);
  const compositeStreamRef = useRef(null);
  const recordingLoopRef   = useRef(null);

  const { isLoaded: isBlurLoaded, processFrame } = useBackgroundBlur(webcamRef.current?.video, masterCanvasRef.current, isBlurEnabled);

  const screenStreamRef  = useRef(null);
  const screenVideoRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef   = useRef(null);
  const chatEndRef       = useRef(null);
  const remoteVideoRef   = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream]   = useState(null);
  const clientIdRef = useRef('recruiter_' + Math.random().toString(36).slice(2, 7));

  const handleRemoteStream = useCallback((stream) => setRemoteStream(stream), []);

  const handleDataMessage = useCallback((type, data) => {
    if (type === 'chat') {
      setMessages(prev => [...prev, { id: Date.now(), text: data.text, sender: data.sender, time: new Date() }]);
    } else if (type === 'transcript') {
      setTranscriptHistory(prev => [...prev, { sender: data.sender, text: data.text, time: new Date() }]);
    } else if (type === 'emotion') {
      const entry = {
        time:            new Date(),
        emotion:         data.emotion,
        audio_emotion:   data.audio_emotion,
        attention_score: data.attention_score ?? 0,
        is_looking:      data.is_looking ?? false,
      };
      setEmotionTimeline(prev => [...prev.slice(-49), entry]);
      if (data.emotion) setEmotionStats(prev => ({ ...prev, [data.emotion]: (prev[data.emotion] || 0) + 1 }));
      if (data.audio_emotion) setAudioEmotionStats(prev => ({ ...prev, [data.audio_emotion]: (prev[data.audio_emotion] || 0) + 1 }));
      setCurrentEmotionData(entry);
    }
  }, []);

  const { initConnection, cleanup: cleanupRTC, sendData } = useWebRTC(
    interviewId, clientIdRef.current, localStream, handleRemoteStream, handleDataMessage,
  );

  useEffect(() => { sendDataRef.current = sendData; }, [sendData]);

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    let animationId;
    let processing = false;
    const loop = async () => {
      if (isCamEnabled && webcamRef.current?.video && masterCanvasRef.current) {
        if (isBlurEnabled) {
          if (!processing) { processing = true; processFrame().finally(() => { processing = false; }); }
        } else {
          masterCanvasRef.current.getContext('2d').drawImage(webcamRef.current.video, 0, 0, 1280, 720);
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

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = isMicEnabled; }); }, [isMicEnabled, localStream]);
  useEffect(() => { if (localStream) localStream.getVideoTracks().forEach(t => { t.enabled = isCamEnabled; }); }, [isCamEnabled, localStream]);
  useEffect(() => {
    apiFetch(`/interviews/${interviewId}`).then(d => setInterviewData(d)).catch(console.error);
  }, [interviewId]);

  const handleDevices = useCallback((mediaDevices) => {
    const cams  = mediaDevices.filter(d => d.kind === 'videoinput');
    const micsArr = mediaDevices.filter(d => d.kind === 'audioinput');
    const spkrs = mediaDevices.filter(d => d.kind === 'audiooutput');
    setDevices(cams); setMics(micsArr); setSpeakers(spkrs);
    if (cams.length    && !selectedDevice)  setSelectedDevice(cams[0].deviceId);
    if (micsArr.length && !selectedMic)     setSelectedMic(micsArr[0].deviceId);
    if (spkrs.length   && !selectedSpeaker) setSelectedSpeaker(spkrs[0].deviceId);
  }, [selectedDevice, selectedMic, selectedSpeaker]);

  const refreshDevices = useCallback(async () => {
    try {
      handleDevices(await navigator.mediaDevices.enumerateDevices());
      if (webcamRef.current?.stream) setLocalStream(webcamRef.current.stream);
    } catch (e) { console.error(e); }
  }, [handleDevices]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);
  useEffect(() => { if (activeSidebar === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeSidebar]);

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null; setIsScreenSharing(false);
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
    if (hasJoined) { initConnection(); } else { cleanupRTC(); setRemoteStream(null); }
  }, [hasJoined, initConnection, cleanupRTC]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const stopRecording = useCallback(() => new Promise((resolve) => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        if (recordedChunksRef.current.length) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `HumatiQ_Entretien_${Date.now()}.webm`;
          a.click();
        }
        resolve();
      };
      mediaRecorderRef.current.stop();
    } else { resolve(); }
    if (recordingLoopRef.current) { cancelAnimationFrame(recordingLoopRef.current); recordingLoopRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    setIsRecording(false);
  }), []);

  const toggleRecording = async () => {
    if (isRecording) { await stopRecording(); return; }
    if (!remoteStream) { alert('Attendez que le candidat rejoigne pour enregistrer.'); return; }
    try {
      recordedChunksRef.current = [];
      const canvas = recordingCanvasRef.current;
      const ctx    = canvas.getContext('2d', { alpha: false });
      const drawFrame = () => {
        if (remoteVideoRef.current?.readyState >= 2) {
          ctx.drawImage(remoteVideoRef.current, 0, 0, 1280, 720);
        } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720); }
        if (isCamEnabled && masterCanvasRef.current) {
          const [pw, ph, pad] = [320, 180, 24];
          const x = 1280 - pw - pad, y = 720 - ph - pad;
          ctx.save();
          ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 12); ctx.clip();
          ctx.drawImage(masterCanvasRef.current, x, y, pw, ph);
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 12); ctx.stroke();
        }
        recordingLoopRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();
      const videoStream = canvas.captureStream(30);
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      if (remoteStream.getAudioTracks().length) audioCtx.createMediaStreamSource(remoteStream).connect(dest);
      if (localStream?.getAudioTracks().length) audioCtx.createMediaStreamSource(localStream).connect(dest);
      const tracks = [...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      compositeStreamRef.current = new MediaStream(tracks);
      const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
      const recorder = mimeType ? new MediaRecorder(compositeStreamRef.current, { mimeType }) : new MediaRecorder(compositeStreamRef.current);
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (!recordedChunksRef.current.length) return;
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `HumatiQ_Entretien_${Date.now()}.webm` });
        a.click();
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (e) { console.error(e); alert('Erreur lors du démarrage de l\'enregistrement.'); }
  };

  const toggleTranscription = () => {
    if (isTranscriptionEnabled) {
      recognitionRef.current?.stop(); setIsTranscriptionEnabled(false); setCurrentTranscript(''); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Transcription non supportée dans ce navigateur.'); return; }
    const r = new SR();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      if (!isMicEnabledRef.current) { setCurrentTranscript(''); return; }
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          setTranscriptHistory(prev => [...prev, { sender: 'Recruteur', text, time: new Date() }]);
          sendData('transcript', { sender: 'Recruteur', text });
          apiFetch(`/interviews/${interviewId}/transcript`, { method: 'POST', body: JSON.stringify({ sender: 'Recruteur', text }) }).catch(console.error);
        } else { interim += e.results[i][0].transcript; }
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

  const sendMessage = () => {
    const t = chatInput.trim(); if (!t) return;
    setMessages(prev => [...prev, { id: Date.now(), text: t, sender: 'Vous (Recruteur)', time: new Date() }]);
    sendData('chat', { text: t, sender: 'Recruteur' });
    setChatInput('');
  };

  const resetCall = async () => {
    stopScreenShare();
    await stopRecording();
    recognitionRef.current?.stop();
    if (sendDataRef.current) sendDataRef.current('end-call', {});
    apiFetch(`/interviews/${interviewId}/end`, { method: 'POST' }).catch(console.error);
    setHasJoined(false); setActiveSidebar(null); setIsTranscriptionEnabled(false); setIsEnded(true);
  };

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await apiFetch(`/interviews/${interviewId}/summarize`, { method: 'POST' });
      if (res.status === 'success') setAiSummary(res.data);
    } catch (e) { console.error(e); } finally { setIsGeneratingSummary(false); }
  };

  const openSidebar = (name) => setActiveSidebar(prev => (prev === name ? null : name));

  const micLabel = mics.find(d => d.deviceId === selectedMic)?.label || 'Microphone';
  const camLabel = devices.find(d => d.deviceId === selectedDevice)?.label || 'Caméra';
  const spkLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || 'Audio Output';

  const totalDetections = emotionTimeline.length;
  const engagement      = computeEngagement(emotionTimeline, emotionStats);

  // ── POST-INTERVIEW ──────────────────────────────────────────────────────────
  if (isEnded) {
    const avgAttention = totalDetections
      ? Math.round(emotionTimeline.reduce((s, x) => s + (x.attention_score || 0), 0) / totalDetections)
      : null;
    const lookPct = totalDetections
      ? Math.round(emotionTimeline.filter(x => x.is_looking).length / totalDetections * 100)
      : null;

    return (
      <div className="hr-interview-page">
        <div className="post-interview">
          <div className="post-card">

            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--hi-primary-soft)', border: '2px solid var(--hi-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={36} color="var(--hi-primary)" />
              </div>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--hi-text)', letterSpacing: '-0.5px', marginBottom: '10px' }}>Entretien Terminé</h2>
              <p style={{ color: 'var(--hi-muted)', fontSize: '15px' }}>Les données ont été sécurisées. Consultez les analyses ci-dessous.</p>
            </div>

            {totalDetections > 0 && (
              <div style={{ background: 'var(--hi-primary-soft)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '20px', padding: '28px', marginBottom: '28px' }}>
                <h4 style={{ color: 'var(--hi-primary)', fontSize: '12px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <Brain size={16} /> Données comportementales
                </h4>

                <div className="post-kpi-grid">
                  {[
                    { icon: <Target size={16} />, label: 'Attention moy.', value: avgAttention != null ? `${avgAttention}%` : '—', color: 'var(--hi-blue)' },
                    { icon: <Eye size={16} />,    label: 'Regard actif',   value: lookPct != null ? `${lookPct}%` : '—', color: 'var(--hi-green)' },
                    { icon: <Activity size={16} />, label: 'Engagement',   value: `${engagement}/100`, color: engagementColor(engagement) },
                  ].map(({ icon, label, value, color }) => (
                    <div key={label} className="post-kpi-card">
                      <div style={{ color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
                      <div className="post-kpi-value" style={{ color }}>{value}</div>
                      <div className="post-kpi-label">{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '10px', color: 'var(--hi-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Distribution des émotions ({totalDetections} mesures)
                </div>
                {Object.entries(emotionStats).sort(([, a], [, b]) => b - a).map(([emo, count]) => {
                  const pct = Math.round((count / totalDetections) * 100);
                  return (
                    <div key={emo} className="post-emo-row">
                      <span style={{ fontSize: '15px', width: '18px', textAlign: 'center' }}>{emojiFor(emo)}</span>
                      <span style={{ fontSize: '12px', color: 'var(--hi-muted)', width: '72px' }}>{labelFor(emo)}</span>
                      <div className="post-emo-bar-track">
                        <div className="post-emo-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--hi-muted)', width: '30px', textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {!aiSummary ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="generate-btn" onClick={generateAISummary} disabled={isGeneratingSummary}>
                  <Brain size={20} />
                  {isGeneratingSummary ? 'Analyse IA en cours (10–30s)...' : 'Générer le Bilan IA Complet'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', background: 'var(--hi-primary-soft)', padding: '24px', borderRadius: '16px', borderLeft: '3px solid var(--hi-primary)' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--hi-surface-alt)', border: '2px solid rgba(234,179,8,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'var(--hi-primary)', fontSize: '26px', fontWeight: '800' }}>{aiSummary.overall_score}</span>
                  </div>
                  <div>
                    <h3 style={{ color: 'var(--hi-text)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Bilan Synthétique</h3>
                    <p style={{ color: 'var(--hi-muted)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>{aiSummary.summary}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
                  {[
                    { title: 'Points Forts', icon: <CheckCircle2 size={18} />, items: aiSummary.strengths, color: 'var(--hi-primary)' },
                    { title: "Axes d'Amélioration", icon: <AlertTriangle size={18} />, items: aiSummary.weaknesses, color: 'var(--hi-muted)' },
                  ].map(({ title, icon, items, color }) => (
                    <div key={title} style={{ background: 'var(--hi-surface-alt)', border: '1px solid var(--hi-border)', borderRadius: '16px', padding: '24px' }}>
                      <h4 style={{ color, fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>{icon} {title}</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {items.map((s, i) => (
                          <li key={i} style={{ color: 'var(--hi-muted)', fontSize: '13px', display: 'flex', gap: '12px', alignItems: 'flex-start', lineHeight: '1.6' }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, marginTop: '8px', flexShrink: 0 }} />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
              <button className="back-btn" onClick={() => window.location.href = '/hr/selection'}>
                Retour à mes candidats
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="hr-interview-page">
      {isCamEnabled && (
        <Webcam ref={webcamRef} audio={true} muted={true}
          audioConstraints={{ deviceId: selectedMic ? { exact: selectedMic } : undefined }}
          videoConstraints={{ deviceId: selectedDevice ? { exact: selectedDevice } : undefined, width: 1280, height: 720 }}
          onUserMedia={(stream) => { setLocalStream(stream); refreshDevices(); }}
          mirrored={true} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -100 }} />
      )}
      <canvas ref={masterCanvasRef}    width={1280} height={720} style={{ display: 'none' }} />
      <canvas ref={recordingCanvasRef} width={1280} height={720} style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }} />

      {/* ─── PRE-JOIN ──────────────────────────────────────────────────────── */}
      {!hasJoined ? (
        <div className="selection-view">
          <header className="prejoin-header">
            <div style={{ fontSize: '19px', fontWeight: '800', color: 'var(--hi-text)', letterSpacing: '-0.3px' }}>HumatiQ</div>
            <div className="header-tabs">
              <div className="header-tab active">Meeting</div>
              <div className="header-tab">Appareils</div>
              <div className="header-tab">Réseau</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Settings size={20} strokeWidth={1.5} style={{ cursor: 'pointer', color: 'var(--hi-muted)' }} />
              <HelpCircle size={20} strokeWidth={1.5} style={{ cursor: 'pointer', color: 'var(--hi-muted)' }} />
              <div style={{ width: '38px', height: '38px', background: 'var(--hi-primary)', color: 'var(--hi-primary-fg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>HR</div>
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
                    <div style={{ color: 'var(--hi-muted)', marginTop: '14px', fontSize: '14px' }}>{isCamEnabled ? 'Chargement...' : 'Caméra désactivée'}</div>
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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--hi-primary-soft)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '20px', padding: '5px 14px', marginBottom: '20px', fontSize: '12px', fontWeight: '700', color: 'var(--hi-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Brain size={13} /> Session Recruteur
              </div>
              <h1>Prêt à <br />démarrer ?</h1>
              <p>Vous êtes l'hôte. Le candidat vous rejoindra après votre connexion.</p>
              <button className="join-btn" onClick={async () => {
                try { await apiFetch(`/interviews/${interviewId}/start`, { method: 'POST' }); } catch (e) { console.error(e); }
                setHasJoined(true);
              }}>
                Lancer l'entretien
              </button>
            </div>
          </main>
        </div>

      ) : (
      /* ─── LIVE ROOM ──────────────────────────────────────────────────────── */
      <div className="meeting-container hr-room">
        <div className="meeting-body">

          {/* Video area */}
          <main className="room-content" style={{ position: 'relative' }}>
            <div className="interview-layout">
              <div className="candidate-view">
                {remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : isScreenSharing ? (
                  <video ref={screenVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div className="waiting-placeholder-container">
                    <Users size={52} color="#52525b" strokeWidth={1.5} />
                    <div style={{ color: '#a1a1aa', fontSize: '15px', fontWeight: '500' }}>En attente du candidat...</div>
                  </div>
                )}

                {/* Live emotion badge */}
                {currentEmotionData && (
                  <div style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(10,10,12,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(234,179,8,0.3)', color: 'white', padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', zIndex: 20, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{emojiFor(currentEmotionData.emotion)}</span>
                    <span style={{ color: '#eab308' }}>{labelFor(currentEmotionData.emotion)}</span>
                    <span style={{ color: '#71717a', fontSize: '10px' }}>· {currentEmotionData.attention_score}%</span>
                  </div>
                )}

                {/* REC badge */}
                {isRecording && (
                  <div className="rec-badge">
                    <div style={{ width: '7px', height: '7px', background: 'white', borderRadius: '50%' }} />
                    REC
                  </div>
                )}
              </div>

              {isTranscriptionEnabled && currentTranscript && (
                <div className="subtitles-overlay"><span>{currentTranscript}</span></div>
              )}

              {/* PIP */}
              <div className="recruiter-pip">
                {isCamEnabled ? (
                  <canvas ref={pipCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
                    <VideoOff size={36} color="#3f3f46" />
                  </div>
                )}
                <div className="pip-label">
                  {isMicEnabled ? <Mic size={9} /> : <MicOff size={9} color="#ef4444" />}
                  <span style={{ marginLeft: '3px' }}>Vous</span>
                </div>
              </div>
            </div>
          </main>

          {/* ─── PERMANENT AI DASHBOARD PANEL ──────────────────────────────── */}
          <aside className="ai-dashboard-panel">
            <div className="ai-panel-header">
              <span className="ai-panel-header-icon"><Brain size={16} /></span>
              <span className="ai-panel-title">Analyse IA — Candidat</span>
              {currentEmotionData && <span className="ai-live-dot" />}
            </div>

            <div className="ai-panel-scroll">

              {/* ── Live emotion state ── */}
              <div className="ai-section">
                <div className="ai-section-title yellow">État en direct</div>

                {currentEmotionData ? (
                  <>
                    <div className="ai-emotion-main">
                      <span className="ai-emotion-emoji">{emojiFor(currentEmotionData.emotion)}</span>
                      <div className="ai-emotion-info">
                        <div className="ai-emotion-label">{labelFor(currentEmotionData.emotion)}</div>
                        <div className="ai-emotion-time">
                          {currentEmotionData.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        {currentEmotionData.audio_emotion && (
                          <div className="ai-audio-label">Voix: {labelFor(currentEmotionData.audio_emotion)}</div>
                        )}
                      </div>
                      <span className={`ai-eye-badge ${currentEmotionData.is_looking ? 'looking' : 'distracted'}`}>
                        {currentEmotionData.is_looking ? '👁 Attentif' : '— Distrait'}
                      </span>
                    </div>

                    <div className="ai-metric-row">
                      <div className="ai-metric-header">
                        <span className="ai-metric-name">Attention</span>
                        <span className="ai-metric-value">{currentEmotionData.attention_score}%</span>
                      </div>
                      <div className="ai-bar-track">
                        <div className={`ai-bar-fill ${currentEmotionData.attention_score >= 70 ? 'high' : currentEmotionData.attention_score >= 40 ? 'mid' : 'low'}`}
                          style={{ width: `${currentEmotionData.attention_score}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ai-empty">
                    <Brain size={22} />
                    <span>En attente de données candidat...<br /><small style={{ opacity: 0.6 }}>Le candidat doit rejoindre avec caméra activée</small></span>
                  </div>
                )}
              </div>

              {/* ── Engagement score ── */}
              {totalDetections >= 3 && (
                <div className="ai-engagement-card">
                  <span className="ai-engagement-label">Score<br />d'engagement</span>
                  <span className="ai-engagement-score" style={{ color: engagementColor(engagement) }}>{engagement}</span>
                  <span className="ai-engagement-unit">/100</span>
                </div>
              )}

              {/* ── Emotion distribution ── */}
              {Object.keys(emotionStats).length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title">Émotions ({totalDetections} mesures)</div>
                  {Object.entries(emotionStats).sort(([, a], [, b]) => b - a).map(([emo, count]) => {
                    const pct = Math.round((count / totalDetections) * 100);
                    return (
                      <div key={emo} className="ai-dist-row">
                        <span className="ai-dist-emoji">{emojiFor(emo)}</span>
                        <span className="ai-dist-label">{labelFor(emo)}</span>
                        <div className="ai-bar-track"><div className="ai-bar-fill yellow" style={{ width: `${pct}%` }} /></div>
                        <span className="ai-dist-pct">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Audio emotion distribution ── */}
              {Object.keys(audioEmotionStats).length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title blue">Émotions vocales wav2vec2</div>
                  {Object.entries(audioEmotionStats).sort(([, a], [, b]) => b - a).map(([emo, count]) => {
                    const audioTotal = Object.values(audioEmotionStats).reduce((s, v) => s + v, 0);
                    const pct = Math.round((count / audioTotal) * 100);
                    return (
                      <div key={emo} className="ai-dist-row">
                        <span className="ai-dist-emoji">{emojiFor(emo)}</span>
                        <span className="ai-dist-label">{labelFor(emo)}</span>
                        <div className="ai-bar-track"><div className="ai-bar-fill blue" style={{ width: `${pct}%` }} /></div>
                        <span className="ai-dist-pct">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Last transcript exchanges ── */}
              {transcriptHistory.length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title blue">Dernier échange</div>
                  {transcriptHistory.slice(-4).map((t, i) => (
                    <div key={i} className="ai-transcript-entry">
                      <span className={`ai-transcript-sender ${t.sender === 'Candidat' ? 'candidate' : 'recruiter'}`}>{t.sender}:</span>
                      {t.text}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Emotion timeline ── */}
              {emotionTimeline.length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title">Historique récent</div>
                  <div className="ai-timeline-list">
                    {[...emotionTimeline].reverse().slice(0, 20).map((entry, i) => (
                      <div key={i} className="ai-timeline-row">
                        <span className="ai-timeline-time">{entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span>{emojiFor(entry.emotion)}</span>
                        <span className="ai-timeline-label">{labelFor(entry.emotion)}{entry.audio_emotion ? ` · ${labelFor(entry.audio_emotion)}` : ''}</span>
                        <span className={`ai-timeline-attn ${entry.attention_score >= 70 ? 'high' : entry.attention_score >= 40 ? 'mid' : 'low'}`}>{entry.attention_score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ─── OVERLAY SIDEBARS (chat / notes / participants / tools) ─────── */}
          {activeSidebar && (
            <aside className="chat-panel open">
              <div className="chat-header">
                {activeSidebar === 'chat'         && <MessageSquare size={16} style={{ marginRight: '8px' }} />}
                {activeSidebar === 'participants'  && <Users size={16} style={{ marginRight: '8px' }} />}
                {activeSidebar === 'notes'         && <NotebookPen size={16} style={{ marginRight: '8px' }} />}
                {activeSidebar === 'tools'         && <LayoutGrid size={16} style={{ marginRight: '8px' }} />}
                <span style={{ flex: 1 }}>
                  {activeSidebar === 'chat'        && 'Messages'}
                  {activeSidebar === 'participants' && `Participants (${participants.length})`}
                  {activeSidebar === 'notes'        && 'Notes de session'}
                  {activeSidebar === 'tools'        && 'Outils de session'}
                </span>
                <button className="chat-close-btn" onClick={() => openSidebar(activeSidebar)}><X size={16} /></button>
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
                    <input className="chat-input" type="text" placeholder="Envoyer un message..." value={chatInput}
                      onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
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

              {activeSidebar === 'notes' && (
                <div className="notes-container">
                  <textarea className="notes-textarea" placeholder="Prenez vos notes ici..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              )}

              {activeSidebar === 'tools' && (
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Recording */}
                  <div onClick={toggleRecording} style={{ background: isRecording ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isRecording ? '#ef4444' : 'rgba(255,255,255,0.07)'}`, padding: '14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: isRecording ? '#ef4444' : 'rgba(255,255,255,0.08)', borderRadius: '50%', display: 'flex' }}>
                      <Circle size={16} color="white" fill={isRecording ? 'white' : 'transparent'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#fafafa' }}>{isRecording ? 'Enregistrement...' : 'Enregistrer la session'}</div>
                      <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Audio et vidéo composite</div>
                    </div>
                  </div>

                  {/* Transcription */}
                  <div onClick={toggleTranscription} style={{ background: isTranscriptionEnabled ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isTranscriptionEnabled ? '#60a5fa' : 'rgba(255,255,255,0.07)'}`, padding: '14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: isTranscriptionEnabled ? '#60a5fa' : 'rgba(255,255,255,0.08)', borderRadius: '50%', display: 'flex' }}>
                      <MessageSquareText size={16} color={isTranscriptionEnabled ? '#fff' : 'white'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#fafafa' }}>Transcription IA</div>
                      <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Sous-titres en temps réel</div>
                    </div>
                    <div style={{ width: '32px', height: '18px', background: isTranscriptionEnabled ? '#60a5fa' : 'rgba(255,255,255,0.1)', borderRadius: '9px', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '2px', left: isTranscriptionEnabled ? '16px' : '2px', width: '14px', height: '14px', background: 'white', borderRadius: '50%', transition: 'left 0.2s' }} />
                    </div>
                  </div>

                  {isTranscriptionEnabled && (
                    <button onClick={downloadTranscript} style={{ padding: '7px', borderRadius: '8px', border: '1px solid rgba(96,165,250,0.3)', background: 'transparent', color: '#60a5fa', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <SquareTerminal size={13} /> Télécharger le transcript
                    </button>
                  )}

                  {/* Transcript log */}
                  {transcriptHistory.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                      <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Discussion transcrite</div>
                      {transcriptHistory.slice(-12).map((entry, i) => (
                        <div key={i} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ color: entry.sender === 'Candidat' ? '#eab308' : '#60a5fa', fontSize: '10px', fontWeight: 700, marginBottom: '3px' }}>{entry.sender}</div>
                          <div style={{ color: '#d4d4d8', fontSize: '11px', lineHeight: 1.45 }}>{entry.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* ─── CONTROL BAR ──────────────────────────────────────────────────── */}
        <footer className="control-bar">
          <div className="meeting-details">
            <span className="time-str">{formatTime(currentTime)}</span>
            <span style={{ color: '#a1a1aa', fontSize: '12px' }}>HumatiQ · Recruteur</span>
            {interviewData && currentTime > new Date(interviewData.end_time) && (
              <div className="overtime-badge"><AlertTriangle size={13} /> Dépassement</div>
            )}
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
                  <div className="menu-item">
                    <LayoutDashboard size={18} />
                    <span>Statistiques de session</span>
                  </div>
                </div>
              )}
            </div>

            <button className="round-btn danger" onClick={resetCall}>
              <PhoneOff size={20} />
            </button>
          </div>

          <div className="sidebar-actions">
            <button className={`round-btn ${activeSidebar === 'tools' ? 'active' : ''}`} onClick={() => openSidebar('tools')} title="Outils">
              <LayoutGrid size={20} />
            </button>
            <button className={`round-btn ${activeSidebar === 'participants' ? 'active' : ''}`} onClick={() => openSidebar('participants')} title="Participants">
              <Users size={20} />
              <span className="chat-badge" style={{ background: '#22c55e' }}>{participants.length}</span>
            </button>
            <button className={`round-btn ${activeSidebar === 'chat' ? 'active' : ''}`} onClick={() => openSidebar('chat')} title="Messages">
              <MessageSquare size={20} />
              {messages.length > 0 && activeSidebar !== 'chat' && <span className="chat-badge">{messages.length}</span>}
            </button>
            <button className={`round-btn ${activeSidebar === 'notes' ? 'active' : ''}`} onClick={() => openSidebar('notes')} title="Notes">
              <NotebookPen size={20} />
            </button>
          </div>
        </footer>
      </div>
      )}
    </div>
  );
};

export default LiveInterview;
