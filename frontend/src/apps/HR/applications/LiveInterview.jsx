import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useBackgroundBlur } from '../../../hooks/useBackgroundBlur';
import { useWebRTC } from '../../../hooks/useWebRTC';
import { useVoiceTranscription } from '../../../hooks/useVoiceTranscription';
import { apiFetch } from '../../../core/api';
import { useLanguage } from '../../../core/useLanguage';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MoreVertical,
  PhoneOff, Users, MessageSquare, Settings, HelpCircle,
  ChevronDown, Sparkles, X, Brain, Send, NotebookPen,
  Shield, ShieldOff, RotateCcw, Volume2,
  CheckCircle2, AlertTriangle, Activity, Eye, Target,
  MonitorOff, UserX, Clock,
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

const NO_SHOW_MS = 15 * 60 * 1000; // 15 minutes

const LiveInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // ANALYSIS_STEPS must be inside the component so t() is available
  const ANALYSIS_STEPS = [
    t('hr-live-step-transcript'),
    t('hr-live-step-behavioral'),
    t('hr-live-step-emotional'),
    t('hr-live-step-generate'),
    t('hr-live-step-finalize'),
  ];

  // ── Devices ──────────────────────────────────────────────────────────────
  const [devices, setDevices]               = useState([]);
  const [mics, setMics]                     = useState([]);
  const [speakers, setSpeakers]             = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedMic, setSelectedMic]       = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // ── Call state ────────────────────────────────────────────────────────────
  const [hasJoined, setHasJoined]           = useState(false);
  const [currentTime, setCurrentTime]       = useState(new Date());
  const [isMicEnabled, setIsMicEnabled]     = useState(true);
  const [isCamEnabled, setIsCamEnabled]     = useState(true);
  const [isBlurEnabled, setIsBlurEnabled]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showMoreMenu, setShowMoreMenu]     = useState(false);
  const [isEnded, setIsEnded]               = useState(false);
  const [interviewData, setInterviewData]   = useState(null);

  // ── UI panels ─────────────────────────────────────────────────────────────
  const [activeSidebar, setActiveSidebar]   = useState(null);
  const [messages, setMessages]             = useState([{ id: 1, text: t('hr-live-chat-init-msg'), sender: t('hr-live-chat-init-sender'), time: new Date() }]);
  const [chatInput, setChatInput]           = useState('');
  const [notes, setNotes]                   = useState('');
  const [participants]                      = useState([
    { id: 1, name: t('hr-live-participant-you'), role: t('hr-live-participant-host'),  mic: true, cam: true, avatar: 'R' },
    { id: 2, name: t('hr-live-candidate'),       role: t('hr-live-participant-guest'), mic: true, cam: true, avatar: 'C' },
  ]);

  // ── Device settings modal ─────────────────────────────────────────────────
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const deviceTestVideoRef = useRef(null);
  const deviceTestStreamRef = useRef(null);
  const deviceTestAudioCtxRef = useRef(null);
  const deviceTestMicStreamRef = useRef(null);
  const deviceTestAnimRef = useRef(null);

  // ── End interview confirm modal ───────────────────────────────────────────
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ── Peer status ───────────────────────────────────────────────────────────
  const [remotePeerLeft, setRemotePeerLeft] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  // null | 'candidate_no_show' | 'hr_late'
  const [noShowWarning, setNoShowWarning]   = useState(null);
  const noShowTimerRef                      = useRef(null);

  // ── Recording / transcription ─────────────────────────────────────────────
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);
  const [isListening, setIsListening]                       = useState(false);
  const [currentTranscript, setCurrentTranscript]           = useState('');
  const [transcriptHistory, setTranscriptHistory]           = useState([]);
  const [selectedLanguage, setSelectedLanguage]             = useState('fr'); // Default to French


  // ── AI panel data ─────────────────────────────────────────────────────────
  const [emotionTimeline, setEmotionTimeline]     = useState([]);
  const [emotionStats, setEmotionStats]           = useState({});
  const [audioEmotionStats, setAudioEmotionStats] = useState({});
  const [currentEmotionData, setCurrentEmotionData] = useState(null);

  // ── Post-interview AI summary ─────────────────────────────────────────────
  const [aiSummary, setAiSummary]               = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [analysisStepIdx, setAnalysisStepIdx]   = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const hrSignalingRef = useRef(null);

  const webcamRef          = useRef(null);
  const masterCanvasRef    = useRef(null);
  const prejoinCanvasRef   = useRef(null);
  const pipCanvasRef       = useRef(null);

  const { isLoaded: isBlurLoaded, processFrame } = useBackgroundBlur(webcamRef.current?.video, masterCanvasRef.current, isBlurEnabled);

  const screenStreamRef  = useRef(null);
  const screenVideoRef   = useRef(null);
  const remoteScreenVideoRef = useRef(null);
  const chatEndRef       = useRef(null);
  const transcriptScrollRef = useRef(null);
  const subtitleTimerRef     = useRef(null);
  const remoteVideoRef   = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [localStream, setLocalStream]   = useState(null);
  const [rtcStream, setRtcStream]       = useState(null);
  const clientIdRef = useRef('recruiter_' + Math.random().toString(36).slice(2, 7));

  // ── Compose RTC stream: canvas video (blurred or raw) + webcam audio ──────
  const canvasStreamRef = useRef(null);
  useEffect(() => {
    const canvas = masterCanvasRef.current;
    if (!localStream || !canvas) { setRtcStream(localStream ?? null); return; }
    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;
    const composed = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...localStream.getAudioTracks(),
    ]);
    setRtcStream(composed);
    return () => {
      canvasStream.getTracks().forEach(t => t.stop());
      canvasStreamRef.current = null;
    };
  }, [localStream]);

  const showSubtitle = useCallback((text) => {
    setCurrentTranscript(text);
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    subtitleTimerRef.current = setTimeout(() => setCurrentTranscript(''), 5000);
  }, []);

  const handleRemoteStream = useCallback((stream) => {
    setRemoteStream(stream);
    setRemotePeerLeft(false);

    // Detect when remote tracks end (peer disconnected without sending end-call)
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
    } else if (type === 'transcript') {
      showSubtitle(data.text);
      // Persisted by /transcribe on the sender side; update local UI only.
      setTranscriptHistory(prev => {
        if (data.msg_id && prev.some(t => t.msg_id === data.msg_id)) return prev;
        return [...prev, { sender: data.sender, text: data.text, time: new Date(), msg_id: data.msg_id }];
      });
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
    interviewId, clientIdRef.current, rtcStream, handleRemoteStream, handleDataMessage, handleRemoteScreenStream,
  );
  useEffect(() => { hrSignalingRef.current = sendData; }, [sendData]);


  // ── AI analysis loading step cycling ─────────────────────────────────────
  useEffect(() => {
    if (!isGeneratingSummary) return;
    setAnalysisStepIdx(0);
    const t = setInterval(() => setAnalysisStepIdx(i => (i + 1) % ANALYSIS_STEPS.length), 2500);
    return () => clearInterval(t);
  }, [isGeneratingSummary]);

  // ── Auto-enable transcription when HR joins ───────────────────────────────
  useEffect(() => {
    if (hasJoined) setIsTranscriptionEnabled(true);
    else { setIsTranscriptionEnabled(false); setCurrentTranscript(''); }
  }, [hasJoined]);

  // ── Sync language to backend so candidate can use the same ────────────────
  useEffect(() => {
    if (!hasJoined || !interviewId) return;
    apiFetch(`/interviews/${interviewId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ language: selectedLanguage }),
    }).catch(err => console.error('[LiveInterview] Failed to sync language:', err));
  }, [selectedLanguage, hasJoined, interviewId]);

  // ── HR transcription (VAD + faster-whisper on WebRTC mic stream) ─────────
  useVoiceTranscription({
    stream: rtcStream ?? localStream,
    sender: 'Recruteur',
    interviewId,
    enabled: hasJoined && isTranscriptionEnabled,
    muted: !isMicEnabled,
    language: selectedLanguage,
    onTranscript: useCallback((entry) => {
      showSubtitle(entry.text);
      setTranscriptHistory(prev => {
        if (entry.msg_id && prev.some(t => t.msg_id === entry.msg_id)) return prev;
        return [...prev, { ...entry, time: new Date() }];
      });
      hrSignalingRef.current?.('transcript', entry);
    }, [showSubtitle]),
    onListeningChange: useCallback((listening) => {
      setIsListening(listening);
    }, []),
  });

  // ── Device settings: camera preview ──────────────────────────────────────
  useEffect(() => {
    if (!showDeviceSettings) {
      deviceTestStreamRef.current?.getTracks().forEach(t => t.stop());
      deviceTestStreamRef.current = null;
      return;
    }
    let active = true;
    (async () => {
      deviceTestStreamRef.current?.getTracks().forEach(t => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        deviceTestStreamRef.current = stream;
        if (deviceTestVideoRef.current) deviceTestVideoRef.current.srcObject = stream;
      } catch (e) { console.error('[DeviceSettings] camera preview:', e); }
    })();
    return () => { active = false; };
  }, [showDeviceSettings, selectedDevice]);

  // ── Device settings: mic level meter ─────────────────────────────────────
  useEffect(() => {
    if (!showDeviceSettings) {
      cancelAnimationFrame(deviceTestAnimRef.current);
      deviceTestMicStreamRef.current?.getTracks().forEach(t => t.stop());
      deviceTestMicStreamRef.current = null;
      deviceTestAudioCtxRef.current?.close();
      deviceTestAudioCtxRef.current = null;
      setMicTestLevel(0);
      return;
    }
    let active = true;
    (async () => {
      deviceTestMicStreamRef.current?.getTracks().forEach(t => t.stop());
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: false,
        });
        if (!active) { micStream.getTracks().forEach(t => t.stop()); return; }
        deviceTestMicStreamRef.current = micStream;
        const ctx = new AudioContext();
        deviceTestAudioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(micStream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!active) return;
          analyser.getByteFrequencyData(data);
          setMicTestLevel(Math.round(Math.max(...data) / 255 * 100));
          deviceTestAnimRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { console.error('[DeviceSettings] mic test:', e); }
    })();
    return () => {
      active = false;
      cancelAnimationFrame(deviceTestAnimRef.current);
      deviceTestMicStreamRef.current?.getTracks().forEach(t => t.stop());
      deviceTestAudioCtxRef.current?.close();
    };
  }, [showDeviceSettings, selectedMic]);

  const closeDeviceSettings = useCallback(() => setShowDeviceSettings(false), []);

  const testSpeaker = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
      osc.onended = () => ctx.close();
    } catch (e) { console.error('[DeviceSettings] speaker test:', e); }
  }, []);

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Detect implicit disconnection (browser closed / network lost) ─────────
  useEffect(() => {
    if (!hasJoined || !remoteStream) return;
    if (connectionStatus === 'disconnected' || connectionStatus === 'failed') {
      setRemotePeerLeft(true);
    }
    // Clear if peer reconnects
    if (connectionStatus === 'connected') setRemotePeerLeft(false);
  }, [connectionStatus, hasJoined, remoteStream]);

  // ── 15-min candidate no-show timer ───────────────────────────────────────
  useEffect(() => {
    if (!hasJoined || remoteStream) {
      clearTimeout(noShowTimerRef.current);
      return;
    }
    const start = interviewData?.start_time ? new Date(interviewData.start_time).getTime() : null;
    const dueAt = start ? start + NO_SHOW_MS : Date.now() + NO_SHOW_MS;
    const delay = Math.max(0, dueAt - Date.now());
    noShowTimerRef.current = setTimeout(() => {
      setNoShowWarning(prev => (prev === null ? 'candidate_no_show' : prev));
    }, delay);

    return () => clearTimeout(noShowTimerRef.current);
  }, [hasJoined, interviewData, remoteStream]);

  // Clear candidate no-show when they join
  useEffect(() => {
    if (remoteStream) setNoShowWarning(null);
  }, [remoteStream]);

  // ── HR late warning (pre-join) ────────────────────────────────────────────
  // Check every 30s if HR is past scheduled start + 15 min without joining
  useEffect(() => {
    if (hasJoined || !interviewData) return;
    const checkLate = () => {
      const start = interviewData.start_time ? new Date(interviewData.start_time).getTime()
        : interviewData.scheduled_at ? new Date(interviewData.scheduled_at).getTime() : null;
      if (start && Date.now() > start + NO_SHOW_MS) setNoShowWarning('hr_late');
    };
    checkLate();
    const timer = setInterval(checkLate, 30000);
    return () => clearInterval(timer);
  }, [hasJoined, interviewData]);

  // ── Canvas / blur loop ────────────────────────────────────────────────────
  useEffect(() => {
    let animationId;
    let processing = false;
    const loop = async () => {
      if (isCamEnabled && webcamRef.current?.video && masterCanvasRef.current) {
        if (isBlurEnabled) {
          if (!processing) { processing = true; processFrame().finally(() => { processing = false; }); }
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

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (localStream) localStream.getAudioTracks().forEach(track => { track.enabled = isMicEnabled; }); }, [isMicEnabled, localStream]);
  useEffect(() => {
    if (localStream) localStream.getVideoTracks().forEach(track => { track.enabled = isCamEnabled; });
    canvasStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = isCamEnabled; });
  }, [isCamEnabled, localStream]);
  useEffect(() => {
    apiFetch(`/interviews/${interviewId}`).then(d => {
      setInterviewData(d);
      if (d?.transcript) {
        setTranscriptHistory(d.transcript.map(entry => ({
          ...entry,
          time: entry.timestamp ? new Date(entry.timestamp) : new Date()
        })));
      }
      if (d?.language) {
        setSelectedLanguage(d.language);
      }
    }).catch(console.error);
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

  // Auto-scroll transcript panel to newest entry
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptHistory]);

  // ── Screen sharing ────────────────────────────────────────────────────────
  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(track => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;
    try { await removeScreenTracks(); } catch (e) { console.error('[SS] remove screen track:', e); }
    hrSignalingRef.current?.('screen-share-stop', { role: 'recruiter' });
    setIsScreenSharing(false);
  }, [removeScreenTracks]);

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

      // Show local preview
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;

      // Auto-stop when user clicks browser "Stop sharing"
      screenTrack.onended = () => stopScreenShare();
      hrSignalingRef.current?.('screen-share-start', { role: 'recruiter', streamId: stream.id });
      setIsScreenSharing(true);
    } catch { console.log('Screen share cancelled'); }
  };

  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  useEffect(() => {
    if (hasJoined) { initConnection(); } else { cleanupRTC(); setRemoteStream(null); }
  }, [hasJoined, initConnection, cleanupRTC]);

  useEffect(() => {
    if (!remoteStream || !remoteVideoRef.current) return;
    const video = remoteVideoRef.current;
    video.srcObject = remoteStream;
    video.play().catch(e => console.warn('[HR] remoteVideo play():', e));

    // When a track is added to the already-playing stream (e.g. audio arrives after video),
    // re-trigger play so the browser picks up the new track.
    const onAddTrack = () => {
      console.log('[HR] remoteStream track added:', remoteStream.getTracks().map(track => `${track.kind}:${track.label}`));
      video.play().catch(() => {});
    };
    remoteStream.addEventListener('addtrack', onAddTrack);
    return () => remoteStream.removeEventListener('addtrack', onAddTrack);
  }, [remoteStream]);

  useEffect(() => {
    if (remoteScreenStream && remoteScreenVideoRef.current) {
      remoteScreenVideoRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  // ── Transcription toggle (lifecycle handled by useVoiceTranscription) ─────
  const toggleTranscription = () => {
    setIsTranscriptionEnabled(prev => !prev);
  };

  const downloadTranscript = () => {
    if (!transcriptHistory.length) { alert(t('hr-live-download-empty')); return; }
    const content = transcriptHistory.map(e => `[${e.time.toLocaleTimeString()}] ${e.sender}: ${e.text}`).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: `Transcript_${Date.now()}.txt` });
    a.click();
  };

  const sendMessage = () => {
    const text = chatInput.trim(); if (!text) return;
    setMessages(prev => [...prev, { id: Date.now(), text, sender: t('hr-live-participant-you'), time: new Date() }]);
    sendData('chat', { text, sender: 'Recruteur' });
    setChatInput('');
  };

  // ── End interview (robust) ────────────────────────────────────────────────
  const doEndInterview = useCallback(async ({ markCompleted = true, peerMessage = 'end-call' } = {}) => {
    try { await stopScreenShare(); } catch (e) { console.error(e); }

    // Notify peer
    if (hrSignalingRef.current && peerMessage) {
      try { hrSignalingRef.current(peerMessage, { role: 'recruiter' }); } catch (e) {}
    }
    await new Promise(resolve => setTimeout(resolve, 150));

    // Cleanup WebRTC (state change in effect handles cleanupRTC)
    setHasJoined(false);
    setActiveSidebar(null);
    setIsTranscriptionEnabled(false);
    setIsEnded(true);
    setAiSummary(null);

    if (markCompleted) {
      setIsGeneratingSummary(true);
      try {
        console.debug('[LiveInterview] Ending interview and requesting AI analysis', { interviewId });
        const res = await apiFetch(`/interviews/${interviewId}/end`, { method: 'POST' });
        console.debug('[LiveInterview] AI analysis response', {
          interviewId,
          hasAnalysis: Boolean(res?.ai_analysis),
          debug: res?.ai_analysis_debug,
          score: res?.ai_analysis?.overall_score,
          weaknesses: res?.ai_analysis?.weaknesses,
        });
        if (res?.ai_analysis) setAiSummary(res.ai_analysis);
      } catch (e) {
        console.error('[LiveInterview] Failed to end interview or generate AI analysis', e);
      } finally {
        setIsGeneratingSummary(false);
      }
    }
  }, [interviewId, stopScreenShare]);

  // ── No-show API calls ─────────────────────────────────────────────────────
  const markCandidateNoShow = useCallback(() => {
    apiFetch(`/interviews/${interviewId}/no-show`, {
      method: 'POST',
      body: JSON.stringify({ fault: 'candidate' }),
    }).catch(console.error);
    doEndInterview({ markCompleted: false, peerMessage: 'end-call' });
  }, [interviewId, doEndInterview]);

  const markHRLate = useCallback(() => {
    apiFetch(`/interviews/${interviewId}/no-show`, {
      method: 'POST',
      body: JSON.stringify({ fault: 'hr' }),
    }).catch(console.error);
    setNoShowWarning(null);
  }, [interviewId]);

  const openSidebar = (name) => setActiveSidebar(prev => (prev === name ? null : name));

  const micLabel = mics.find(d => d.deviceId === selectedMic)?.label || t('hr-live-device-mic');
  const camLabel = devices.find(d => d.deviceId === selectedDevice)?.label || t('hr-live-device-cam');
  const spkLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || t('hr-live-device-speaker');

  const totalDetections = emotionTimeline.length;
  const engagement      = computeEngagement(emotionTimeline, emotionStats);
  const screenShareActive = isScreenSharing || remoteScreenSharing || Boolean(remoteScreenStream);

  // ── POST-INTERVIEW ──────────────────────────────────────────────────────────
  if (isEnded) {
    const avgAttention = totalDetections
      ? Math.round(emotionTimeline.reduce((s, x) => s + (x.attention_score || 0), 0) / totalDetections) : null;
    const lookPct = totalDetections
      ? Math.round(emotionTimeline.filter(x => x.is_looking).length / totalDetections * 100) : null;
    return (
      <div className="hr-interview-page">
        <div className="post-interview">
          <div className="post-card">
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'var(--hi-primary-soft)', border: '2px solid var(--hi-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <CheckCircle2 size={34} color="var(--hi-primary)" />
              </div>
              <h2 style={{ fontSize: '30px', fontWeight: '900', color: 'var(--hi-text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>{t('hr-live-post-title')}</h2>
              <p style={{ color: 'var(--hi-muted)', fontSize: '14px' }}>{t('hr-live-post-subtitle')}</p>
            </div>

            {totalDetections > 0 && (
              <div style={{ background: 'var(--hi-primary-soft)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '18px', padding: '24px', marginBottom: '24px' }}>
                <h4 style={{ color: 'var(--hi-primary)', fontSize: '11px', fontWeight: '700', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '7px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <Brain size={14} /> {t('hr-live-behavioral-data')}
                </h4>
                <div className="post-kpi-grid">
                  {[
                    { icon: <Target size={14} />, label: t('hr-live-kpi-attention'), value: avgAttention != null ? `${avgAttention}%` : '—', color: 'var(--hi-blue)' },
                    { icon: <Eye size={14} />,    label: t('hr-live-kpi-gaze'),      value: lookPct != null ? `${lookPct}%` : '—', color: 'var(--hi-green)' },
                    { icon: <Activity size={14} />, label: t('hr-live-kpi-engagement'), value: `${engagement}/100`, color: engagementColor(engagement) },
                  ].map(({ icon, label, value, color }) => (
                    <div key={label} className="post-kpi-card">
                      <div style={{ color, marginBottom: '7px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
                      <div className="post-kpi-value" style={{ color }}>{value}</div>
                      <div className="post-kpi-label">{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--hi-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  {t('hr-live-emotion-face-dist', { count: totalDetections })}
                </div>
                {Object.entries(emotionStats).sort(([, a], [, b]) => b - a).map(([emo, count]) => {
                  const pct = Math.round((count / totalDetections) * 100);
                  return (
                    <div key={emo} className="post-emo-row">
                      <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>{emojiFor(emo)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--hi-muted)', width: '68px' }}>{labelFor(emo)}</span>
                      <div className="post-emo-bar-track"><div className="post-emo-bar-fill" style={{ width: `${pct}%` }} /></div>
                      <span style={{ fontSize: '10px', color: 'var(--hi-muted)', width: '28px', textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                })}
                {Object.keys(audioEmotionStats).length > 0 && (
                  <>
                    <div style={{ fontSize: '10px', color: 'var(--hi-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', marginTop: '14px' }}>
                      {t('hr-live-emotion-voice-dist')}
                    </div>
                    {Object.entries(audioEmotionStats).sort(([, a], [, b]) => b - a).map(([emo, count]) => {
                      const total = Object.values(audioEmotionStats).reduce((s, v) => s + v, 0);
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={emo} className="post-emo-row">
                          <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>{emojiFor(emo)}</span>
                          <span style={{ fontSize: '11px', color: 'var(--hi-muted)', width: '68px' }}>{labelFor(emo)}</span>
                          <div className="post-emo-bar-track"><div style={{ height: '100%', borderRadius: '3px', background: '#60a5fa', transition: 'width 0.6s ease', width: `${pct}%` }} /></div>
                          <span style={{ fontSize: '10px', color: 'var(--hi-muted)', width: '28px', textAlign: 'right' }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {isGeneratingSummary ? (
              <div className="ai-analysis-loading-card">
                <div className="ai-loading-orb-container">
                  <div className="ai-loading-ring ring-1" />
                  <div className="ai-loading-ring ring-2" />
                  <div className="ai-loading-ring ring-3" />
                  <div className="ai-loading-brain-core">
                    <Brain size={28} />
                  </div>
                </div>
                <div className="ai-loading-body">
                  <div className="ai-loading-badge">
                    <span className="ai-loading-badge-dot" />
                    {t('hr-live-analysis-badge')}
                  </div>
                  <h3 className="ai-loading-title">{t('hr-live-analyzing')}</h3>
                  <p className="ai-loading-step">{ANALYSIS_STEPS[analysisStepIdx]}</p>
                  <div className="ai-loading-dots">
                    <span className="ai-loading-dot" style={{ animationDelay: '0s' }} />
                    <span className="ai-loading-dot" style={{ animationDelay: '0.18s' }} />
                    <span className="ai-loading-dot" style={{ animationDelay: '0.36s' }} />
                  </div>
                  <div className="ai-loading-shimmer-track">
                    <div className="ai-loading-shimmer-fill" />
                  </div>
                </div>
              </div>
            ) : !aiSummary ? (
              <div className="post-analysis-loading muted">
                <AlertTriangle size={22} />
                <div>
                  <h3>{t('hr-live-analysis-unavailable')}</h3>
                  <p>{t('hr-live-analysis-no-result')}</p>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px', background: 'var(--hi-primary-soft)', padding: '22px', borderRadius: '14px', borderLeft: '3px solid var(--hi-primary)' }}>
                  <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--hi-surface-alt)', border: '2px solid rgba(234,179,8,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'var(--hi-primary)', fontSize: '24px', fontWeight: '800' }}>{aiSummary.overall_score}</span>
                  </div>
                  <div>
                    <h3 style={{ color: 'var(--hi-text)', fontSize: '17px', fontWeight: '700', marginBottom: '7px' }}>{t('hr-live-summary-title')}</h3>
                    <p style={{ color: 'var(--hi-muted)', fontSize: '13px', lineHeight: '1.65', margin: 0 }}>{aiSummary.summary}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                  {[
                    { title: t('hr-live-strengths'),    icon: <CheckCircle2 size={16} />, items: aiSummary.strengths,  color: 'var(--hi-primary)' },
                    { title: t('hr-live-improvements'), icon: <AlertTriangle size={16} />, items: aiSummary.weaknesses, color: 'var(--hi-muted)' },
                  ].map(({ title, icon, items, color }) => (
                    <div key={title} style={{ background: 'var(--hi-surface-alt)', border: '1px solid var(--hi-border)', borderRadius: '14px', padding: '20px' }}>
                      <h4 style={{ color, fontSize: '13px', fontWeight: '600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>{icon} {title}</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {items.map((s, i) => (
                          <li key={i} style={{ color: 'var(--hi-muted)', fontSize: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: '1.6' }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, marginTop: '7px', flexShrink: 0 }} />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}>
              <button className="back-btn" onClick={() => window.location.href = '/hr/selection'}>{t('hr-live-btn-back')}</button>
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
          audioConstraints={{
            deviceId: selectedMic ? { exact: selectedMic } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          }}
          videoConstraints={{ deviceId: selectedDevice ? { exact: selectedDevice } : undefined, width: 1280, height: 720 }}
          onUserMedia={(stream) => { setLocalStream(stream); refreshDevices(); }}
          mirrored={true} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -100 }} />
      )}
      <canvas ref={masterCanvasRef}    width={1280} height={720} style={{ display: 'none' }} />

      {/* ─── PRE-JOIN ────────────────────────────────────────────────────────── */}
      {!hasJoined ? (
        <div className="selection-view">

          {/* HR late warning */}
          {noShowWarning === 'hr_late' && (
            <div className="noshow-banner hr-late">
              <Clock size={16} />
              <span>{t('hr-live-noshow-late')}</span>
              <button onClick={markHRLate}>{t('hr-live-noshow-acknowledge')}</button>
            </div>
          )}



          <main className="prejoin-main">
            <div className="prejoin-left">
              <div className="preview-wrapper">
                {isCamEnabled && selectedDevice ? (
                  <canvas ref={prejoinCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c' }}>
                    <VideoOff size={56} color="#52525b" />
                    <div style={{ color: 'var(--hi-muted)', marginTop: '14px', fontSize: '14px' }}>{isCamEnabled ? t('hr-live-cam-loading') : t('hr-live-cam-disabled')}</div>
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
                  { key: 'mic',     label: t('hr-live-device-mic'),     icon: <Mic size={15} />,    list: mics,     selected: selectedMic,    setSelected: setSelectedMic,    display: micLabel },
                  { key: 'speaker', label: t('hr-live-device-speaker'), icon: <Volume2 size={15} />, list: speakers, selected: selectedSpeaker, setSelected: setSelectedSpeaker, display: spkLabel },
                  { key: 'cam',     label: t('hr-live-device-cam'),     icon: <Video size={15} />,  list: devices,  selected: selectedDevice,  setSelected: setSelectedDevice,  display: camLabel },
                  { key: 'lang',    label: t('hr-live-device-lang'),    icon: <Brain size={15} />, list: [{ deviceId: 'fr', label: t('hr-live-lang-fr') }, { deviceId: 'en', label: t('hr-live-lang-en') }], selected: selectedLanguage, setSelected: setSelectedLanguage, display: selectedLanguage === 'fr' ? t('hr-live-lang-fr') : t('hr-live-lang-en') },
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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--hi-primary-soft)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '20px', padding: '5px 14px', marginBottom: '20px', fontSize: '11px', fontWeight: '700', color: 'var(--hi-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Brain size={12} /> {t('hr-live-recruiter-session')}
              </div>
              <h1>Prêt à <br />démarrer ?</h1>
              <p>{t('hr-live-ready-sub')}</p>
              <button className="join-btn" onClick={async () => {
                try {
                  await apiFetch(`/interviews/${interviewId}/start`, { method: 'POST' });
                  setHasJoined(true);
                } catch (e) {
                  console.error(e);
                  setNoShowWarning('hr_late');
                }
              }}>
                {t('hr-live-btn-start')}
              </button>
            </div>
          </main>
        </div>

      ) : (
      /* ─── LIVE ROOM ──────────────────────────────────────────────────────── */
      <div className="meeting-container hr-room">

        {/* ── End Interview Confirm Modal ── */}
        {showEndConfirm && (
          <div className="end-confirm-overlay">
            <div className="end-confirm-modal">
              <div className="end-confirm-icon">
                <PhoneOff size={28} />
              </div>
              <h3>{t('hr-live-end-title')}</h3>
              <p>{t('hr-live-end-body')}</p>
              <div className="end-confirm-summary">
                <span><CheckCircle2 size={14} /> {t('hr-live-end-transcript')}</span>
                <span><Brain size={14} /> {t('hr-live-end-analysis')}</span>
              </div>
              <div className="end-confirm-actions">
                <button className="end-confirm-cancel" onClick={() => setShowEndConfirm(false)}>{t('hr-live-btn-cancel')}</button>
                <button className="end-confirm-proceed" onClick={() => { setShowEndConfirm(false); doEndInterview(); }}>
                  {t('hr-live-btn-end-confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Device Settings Modal ── */}
        {showDeviceSettings && (
          <div className="device-settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDeviceSettings(); }}>
            <div className="device-settings-modal">
              <div className="device-settings-header">
                <Settings size={16} />
                <span>{t('hr-live-device-settings-title')}</span>
                <button className="device-settings-close" onClick={closeDeviceSettings}><X size={16} /></button>
              </div>
              <div className="device-settings-body">
                <div className="device-settings-section">
                  <label>{t('hr-live-device-label-cam')}</label>
                  <select className="device-settings-select" value={selectedDevice || ''} onChange={(e) => setSelectedDevice(e.target.value)}>
                    {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t('hr-live-device-label-cam')} ${d.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                  <video ref={deviceTestVideoRef} autoPlay muted playsInline className="device-test-preview" />
                </div>

                <div className="device-settings-section">
                  <label>{t('hr-live-device-label-mic')}</label>
                  <select className="device-settings-select" value={selectedMic || ''} onChange={(e) => setSelectedMic(e.target.value)}>
                    {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${d.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mic size={13} color="#a1a1aa" />
                    <div className="mic-level-track" style={{ flex: 1 }}>
                      <div className="mic-level-fill" style={{ width: `${micTestLevel}%` }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa', minWidth: '30px', textAlign: 'right' }}>{micTestLevel}%</span>
                  </div>
                </div>

                <div className="device-settings-section">
                  <label>{t('hr-live-device-label-speaker')}</label>
                  <select className="device-settings-select" value={selectedSpeaker || ''} onChange={(e) => setSelectedSpeaker(e.target.value)}>
                    {speakers.length > 0
                      ? speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Sortie ${d.deviceId.slice(0, 6)}`}</option>)
                      : <option value="">{t('hr-live-device-label-speaker')}</option>
                    }
                  </select>
                  <button className="device-test-btn" onClick={testSpeaker}>
                    <Volume2 size={14} />
                    {t('hr-live-btn-test-sound')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Candidate No-Show Modal ── */}
        {noShowWarning === 'candidate_no_show' && !remotePeerLeft && (
          <div className="end-confirm-overlay">
            <div className="end-confirm-modal">
              <div className="end-confirm-icon" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
                <UserX size={28} style={{ color: '#ef4444' }} />
              </div>
              <h3>{t('hr-live-noshow-absent-title')}</h3>
              <p>{t('hr-live-noshow-absent-body')}</p>
              <div className="end-confirm-actions">
                <button className="end-confirm-cancel" onClick={() => setNoShowWarning(null)}>{t('hr-live-btn-keep-waiting')}</button>
                <button className="end-confirm-proceed" style={{ background: '#ef4444', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }} onClick={markCandidateNoShow}>
                  {t('hr-live-btn-mark-absent')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="meeting-body">

          {/* Video area */}
          <main className="room-content" style={{ position: 'relative' }}>
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
                        <span>{t('hr-live-screen-share-loading')}</span>
                      </div>
                    )}
                    <div className="screen-share-label">
                      <MonitorUp size={14} />
                      {isScreenSharing ? t('hr-live-screen-share-label-you') : t('hr-live-screen-share-label-cand')}
                    </div>
                    {isScreenSharing && (
                      <button className="screen-share-stop-btn" type="button" onClick={stopScreenShare}>
                        {t('hr-live-btn-stop-share')}
                      </button>
                    )}
                  </div>

                  <div className="participant-strip">
                    <div className="participant-video-tile">
                      {remotePeerLeft ? (
                        <div className="peer-left-tile">
                          <div className="peer-avatar-circle candidat left"><UserX size={22} /></div>
                          <span className="peer-avatar-name">{t('hr-live-peer-left-strip')}</span>
                        </div>
                      ) : remoteStream ? (
                        <video ref={remoteVideoRef} autoPlay playsInline />
                      ) : (
                        <div className="waiting-tile">
                          <div className="waiting-avatar-ring"><span className="peer-avatar-circle candidat">C</span></div>
                          <span className="peer-avatar-name">{t('hr-live-waiting')}</span>
                        </div>
                      )}
                      {currentEmotionData && !remoteScreenSharing && (
                        <div className="tile-emotion-badge">
                          <span>{emojiFor(currentEmotionData.emotion)}</span>
                          <span>{currentEmotionData.attention_score}%</span>
                        </div>
                      )}
                      <div className="tile-name-badge">{t('hr-live-candidate')}</div>
                    </div>

                    <div className="participant-video-tile self">
                      {isCamEnabled ? (
                        <canvas ref={pipCanvasRef} width={1280} height={720} />
                      ) : (
                        <div className="no-cam-tile">
                          <div className="peer-avatar-circle hr">{t('hr-live-rh-label')}</div>
                          <span className="peer-avatar-name">{t('hr-live-yourself')}</span>
                        </div>
                      )}
                      <div className="tile-name-badge">
                        {isMicEnabled ? <Mic size={10} /> : <MicOff size={10} />}
                        {t('hr-live-yourself')}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="candidate-view">
                    {remoteStream && !remotePeerLeft && (
                      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                    )}

                    {remotePeerLeft && (
                      <div className="peer-left-full">
                        <div className="peer-avatar-circle candidat left"><UserX size={32} /></div>
                        <h3 className="peer-state-title">{t('hr-live-peer-left-title')}</h3>
                        <p className="peer-state-sub">{t('hr-live-peer-left-sub')}</p>
                      </div>
                    )}

                    {!remoteStream && !remotePeerLeft && (
                      <div className="waiting-full">
                        <div className="waiting-pulse-ring">
                          <div className="peer-avatar-circle candidat lg">C</div>
                        </div>
                        <h3 className="peer-state-title">{t('hr-live-waiting-candidate')}</h3>
                        <p className="peer-state-sub">{t('hr-live-waiting-sub')}</p>
                        <div className="waiting-dots"><span /><span /><span /></div>
                      </div>
                    )}

                    {currentEmotionData && (
                      <div style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(10,10,12,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(234,179,8,0.3)', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', zIndex: 20, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{emojiFor(currentEmotionData.emotion)}</span>
                        <span style={{ color: '#eab308' }}>{labelFor(currentEmotionData.emotion)}</span>
                        <span style={{ color: '#71717a', fontSize: '10px' }}>· {currentEmotionData.attention_score}%</span>
                      </div>
                    )}
                  </div>

                  <div className="recruiter-pip">
                    {isCamEnabled ? (
                      <canvas ref={pipCanvasRef} width={1280} height={720} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    ) : (
                      <div className="pip-no-cam">
                        <div className="peer-avatar-circle hr sm">{t('hr-live-rh-label')}</div>
                        <span className="peer-avatar-name xs">{t('hr-live-yourself')}</span>
                      </div>
                    )}
                    <div className="pip-label">
                      {isMicEnabled ? <Mic size={9} /> : <MicOff size={9} color="#ef4444" />}
                      <span style={{ marginLeft: '3px' }}>{t('hr-live-yourself')}</span>
                    </div>
                  </div>
                </>
              )}

              {isTranscriptionEnabled && currentTranscript && (
                <div className="subtitles-overlay"><span>{currentTranscript}</span></div>
              )}
            </div>
          </main>

          {/* ─── PERMANENT AI DASHBOARD PANEL ──────────────────────────────── */}
          <aside className="ai-dashboard-panel">
            <div className="ai-panel-header">
              <span className="ai-panel-header-icon"><Brain size={15} /></span>
              <span className="ai-panel-title">{t('hr-live-ai-panel-title')}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isListening && <span className="ai-live-dot" style={{ background: '#22c55e', width: '6px', height: '6px' }} title="Microphone actif (transcription)" />}
                {currentEmotionData && <span className="ai-live-dot" />}
              </div>
            </div>

            <div className="ai-panel-scroll">

              {/* ── Facial emotion — live ── */}
              <div className="ai-section">
                <div className="ai-section-title yellow">
                  👁 {t('hr-live-ai-section-face')}
                </div>
                {remoteScreenSharing ? (
                  <div className="ai-empty">
                    <MonitorOff size={20} />
                    <span>{t('hr-live-ai-pause-screenshare')}<br /><small style={{ opacity: 0.6 }}>{t('hr-live-ai-pause-sub')}</small></span>
                  </div>
                ) : currentEmotionData ? (
                  <>
                    <div className="ai-emotion-main">
                      <span className="ai-emotion-emoji">{emojiFor(currentEmotionData.emotion)}</span>
                      <div className="ai-emotion-info">
                        <div className="ai-emotion-label">{labelFor(currentEmotionData.emotion)}</div>
                        <div className="ai-emotion-time">
                          {currentEmotionData.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                      <span className={`ai-eye-badge ${currentEmotionData.is_looking ? 'looking' : 'distracted'}`}>
                        {currentEmotionData.is_looking ? `👁 ${t('hr-live-ai-attentive')}` : `— ${t('hr-live-ai-distracted')}`}
                      </span>
                    </div>
                    <div className="ai-metric-row">
                      <div className="ai-metric-header">
                        <span className="ai-metric-name">{t('hr-live-ai-attention')}</span>
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
                    <Brain size={20} />
                    <span>{t('hr-live-ai-waiting-data')}<br /><small style={{ opacity: 0.6 }}>{t('hr-live-ai-waiting-sub')}</small></span>
                  </div>
                )}
              </div>

              {/* ── Audio emotion — live ── */}
              {!remoteScreenSharing && currentEmotionData?.audio_emotion && (
                <div className="ai-section">
                  <div className="ai-section-title blue">🎙 {t('hr-live-ai-section-voice')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '32px' }}>{emojiFor(currentEmotionData.audio_emotion)}</span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--meet-text, #fafafa)' }}>{labelFor(currentEmotionData.audio_emotion)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--meet-muted, #a1a1aa)' }}>{t('hr-live-ai-voice-model')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Engagement score ── */}
              {totalDetections >= 3 && (
                <div className="ai-engagement-card">
                  <span className="ai-engagement-label">{t('hr-live-ai-engagement-label')}</span>
                  <span className="ai-engagement-score" style={{ color: engagementColor(engagement) }}>{engagement}</span>
                  <span className="ai-engagement-unit">/100</span>
                </div>
              )}

              {/* ── Facial emotion distribution ── */}
              {Object.keys(emotionStats).length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title yellow">👁 {t('hr-live-ai-face-dist', { count: totalDetections })}</div>
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

              {/* ── Audio emotion distribution (wav2vec2) — kept visually distinct ── */}
              {Object.keys(audioEmotionStats).length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title blue">🎙 {t('hr-live-ai-voice-dist')}</div>
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

              {/* ── Live transcription (full history) ── */}
              <div className="ai-section">
                <div className="ai-section-title blue" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ flex: 1 }}>
                    🎙 {t('hr-live-ai-transcript-title')} {transcriptHistory.length > 0 ? `(${transcriptHistory.length})` : ''}
                  </span>
                  {isListening && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#22c55e', fontWeight: 600 }}>
                      <span className="ai-live-dot" style={{ background: '#22c55e', width: '6px', height: '6px' }} />
                      {t('hr-live-ai-transcript-live')}
                    </span>
                  )}
                </div>
                {transcriptHistory.length === 0 ? (
                  <div className="ai-empty">
                    <Activity size={20} />
                    <span>{t('hr-live-ai-transcript-waiting')}<br /><small style={{ opacity: 0.6 }}>{t('hr-live-ai-transcript-wait-sub')}</small></span>
                  </div>
                ) : (
                  <div className="ai-transcript-list" ref={transcriptScrollRef}>
                    {transcriptHistory.map((entry) => (
                      <div
                        key={entry.msg_id || `${entry.sender}_${entry.time?.getTime?.()}`}
                        className={`ai-transcript-entry ${entry.sender === 'Candidat' ? 'is-candidate' : 'is-recruiter'}`}
                      >
                        <div className="ai-transcript-bubble">
                          <div className="ai-transcript-meta">
                            <span className="ai-transcript-sender">
                              {entry.sender}
                            </span>
                            <span className="ai-transcript-time">
                              {entry.time?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="ai-transcript-text">{entry.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                )}
              </div>

              {/* ── Timeline ── */}
              {emotionTimeline.length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title">{t('hr-live-ai-timeline-title')}</div>
                  <div className="ai-timeline-list">
                    {[...emotionTimeline].reverse().slice(0, 20).map((entry, i) => (
                      <div key={i} className="ai-timeline-row">
                        <span className="ai-timeline-time">{entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span>{emojiFor(entry.emotion)}</span>
                        <span className="ai-timeline-label">{labelFor(entry.emotion)}{entry.audio_emotion ? ` · 🎙${labelFor(entry.audio_emotion)}` : ''}</span>
                        <span className={`ai-timeline-attn ${entry.attention_score >= 70 ? 'high' : entry.attention_score >= 40 ? 'mid' : 'low'}`}>{entry.attention_score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ─── OVERLAY SIDEBARS ───────────────────────────────────────────── */}
          {activeSidebar && (
            <aside className="chat-panel open">
              <div className="chat-header">
                {activeSidebar === 'chat'        && <MessageSquare size={15} style={{ marginRight: '8px' }} />}
                {activeSidebar === 'participants' && <Users size={15} style={{ marginRight: '8px' }} />}
                {activeSidebar === 'notes'        && <NotebookPen size={15} style={{ marginRight: '8px' }} />}
                <span style={{ flex: 1 }}>
                  {activeSidebar === 'chat'        && t('hr-live-sidebar-messages')}
                  {activeSidebar === 'participants' && t('hr-live-sidebar-participants', { count: participants.length })}
                  {activeSidebar === 'notes'        && t('hr-live-sidebar-notes')}
                </span>
                <button className="chat-close-btn" onClick={() => openSidebar(activeSidebar)}><X size={15} /></button>
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
                    <input className="chat-input" type="text" placeholder={t('hr-live-chat-placeholder')} value={chatInput}
                      onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                    <button className="chat-send-btn" onClick={sendMessage}><Send size={15} /></button>
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
                        {p.mic ? <Mic size={12} color="#a1a1aa" /> : <MicOff size={12} color="#ef4444" />}
                        {p.cam ? <Video size={12} color="#a1a1aa" /> : <VideoOff size={12} color="#ef4444" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeSidebar === 'notes' && (
                <div className="notes-container">
                  <textarea className="notes-textarea" placeholder={t('hr-live-notes-placeholder')} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              )}

            </aside>
          )}
        </div>

        {/* ─── CONTROL BAR ──────────────────────────────────────────────────── */}
        <footer className="control-bar">
          <div className="meeting-details">
            <span className="time-str">{formatTime(currentTime)}</span>
            <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{t('hr-live-control-label')}</span>
            {interviewData && currentTime > new Date(interviewData.end_time) && (
              <div className="overtime-badge"><AlertTriangle size={12} /> {t('hr-live-control-overtime')}</div>
            )}
          </div>

          <div className="action-buttons">
            <button className={`round-btn ${!isMicEnabled ? 'danger' : ''}`} onClick={() => setIsMicEnabled(!isMicEnabled)} title={isMicEnabled ? t('hr-live-btn-mic-mute') : t('hr-live-btn-mic-unmute')}>
              {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button className={`round-btn ${!isCamEnabled ? 'danger' : ''}`} onClick={() => setIsCamEnabled(!isCamEnabled)} title={isCamEnabled ? t('hr-live-btn-cam-mute') : t('hr-live-btn-cam-unmute')}>
              {isCamEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button className={`round-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title={isScreenSharing ? t('hr-live-btn-screen-stop') : t('hr-live-btn-screen-share')}>
              <MonitorUp size={20} />
            </button>

            <div style={{ position: 'relative' }}>
              <button className="round-btn" onClick={() => setShowMoreMenu(!showMoreMenu)}>
                <MoreVertical size={20} />
              </button>
              {showMoreMenu && (
                <div className="more-menu">
                  <div className="menu-item" onClick={() => { setIsBlurEnabled(!isBlurEnabled); setShowMoreMenu(false); }}>
                    {isBlurEnabled ? <ShieldOff size={17} /> : <Shield size={17} />}
                    <span>{isBlurEnabled ? t('hr-live-btn-privacy-off') : t('hr-live-btn-privacy-on')}</span>
                  </div>
                  <div className="menu-divider" />
                  <div className="menu-item" onClick={() => { setShowDeviceSettings(true); setShowMoreMenu(false); }}>
                    <Settings size={17} />
                    <span>{t('hr-live-btn-device-settings')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* End interview button — no hanging up, shows confirm modal */}
            <button className="end-interview-btn" onClick={() => setShowEndConfirm(true)} title={t('hr-live-btn-end-confirm')}>
              <PhoneOff size={18} />
              <span>{t('hr-live-btn-end')}</span>
            </button>
          </div>

          <div className="sidebar-actions">
            <button className={`round-btn ${activeSidebar === 'participants' ? 'active' : ''}`} onClick={() => openSidebar('participants')} title="Participants">
              <Users size={20} />
              <span className="chat-badge" style={{ background: '#22c55e' }}>{participants.length}</span>
            </button>
            <button className={`round-btn ${activeSidebar === 'chat' ? 'active' : ''}`} onClick={() => openSidebar('chat')} title={t('hr-live-sidebar-messages')}>
              <MessageSquare size={20} />
              {messages.length > 0 && activeSidebar !== 'chat' && <span className="chat-badge">{messages.length}</span>}
            </button>
            <button className={`round-btn ${activeSidebar === 'notes' ? 'active' : ''}`} onClick={() => openSidebar('notes')} title={t('hr-live-sidebar-notes')}>
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
