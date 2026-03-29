import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, 
  Users, Settings, MoreVertical, Shield, Info,
  Layout, BarChart2, FileText, Share, Smile, RefreshCw, Sparkles, Volume2, HelpCircle, X, ChevronDown
} from 'lucide-react';
import { useBackgroundBlur } from '../../../hooks/useBackgroundBlur';
import './FaceAffectus.css';

const LiveInterview = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  
  // -- UI & Navigation States --
  const [hasJoined, setHasJoined] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  
  // -- Device States --
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [mics, setMics] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null); // 'mic' | 'cam' | 'speaker' | null
  
  // -- Live Meeting States --
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isBlurOn, setIsBlurOn] = useState(false);
  const [activePanel, setActivePanel] = useState('none'); 
  const [emotion, setEmotion] = useState('Neutral');
  const [transcript, setTranscript] = useState([]);
  const [notes, setNotes] = useState('');

  // -- Refs --
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const recognitionRef = useRef(null);
  const analysisIntervalRef = useRef(null);

  const { isLoaded: isBlurLoaded, processFrame: blurProcessFrame } = useBackgroundBlur(
    webcamRef.current?.video,
    canvasRef.current,
    isBlurOn
  );

  // 1. Device Enumeration
  const refreshDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = mediaDevices.filter(({ kind }) => kind === 'videoinput');
      const audioIn = mediaDevices.filter(({ kind }) => kind === 'audioinput');
      const audioOut = mediaDevices.filter(({ kind }) => kind === 'audiooutput');
      
      setDevices(videoIn);
      setMics(audioIn);
      setSpeakers(audioOut);

      if (videoIn.length > 0 && !selectedDevice) setSelectedDevice(videoIn[0].deviceId);
      if (audioIn.length > 0 && !selectedMic) setSelectedMic(audioIn[0].deviceId);
      if (audioOut.length > 0 && !selectedSpeaker) setSelectedSpeaker(audioOut[0].deviceId);
    } catch (err) {
      console.error("Device enumeration error:", err);
    }
  }, [selectedDevice, selectedMic, selectedSpeaker]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Request permissions initially to see device labels
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        refreshDevices();
      })
      .catch(err => console.error("Initial permission error:", err));
  }, [refreshDevices]);

  // Handle outside click to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. WebRTC Signaling & Connection (Only after HasJoined)
  useEffect(() => {
    if (!hasJoined) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/interviews/ws/${interviewId}/hr`;
    wsRef.current = new WebSocket(wsUrl);

    pcRef.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'offer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        wsRef.current.send(JSON.stringify({ type: 'answer', answer }));
      } else if (data.type === 'answer') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === 'candidate') {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    pcRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Add local stream manually once joined
    if (webcamRef.current?.video?.srcObject) {
        webcamRef.current.video.srcObject.getTracks().forEach(track => {
            pcRef.current.addTrack(track, webcamRef.current.video.srcObject);
        });
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [hasJoined, interviewId]);

  // 3. Speech Recognition
  useEffect(() => {
    if (!hasJoined) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && isMicOn) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.lang = 'fr-FR';
      recognitionRef.current.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          const text = last[0].transcript;
          const msg = { sender: 'HR', text, timestamp: new Date() };
          setTranscript(prev => [...prev, msg]);
          fetch(`/api/interviews/${interviewId}/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg)
          });
        }
      };
      recognitionRef.current.start();
    }
    return () => recognitionRef.current?.stop();
  }, [hasJoined, isMicOn, interviewId]);

  // 4. Emotion Analysis
  useEffect(() => {
    if (!hasJoined) return;
    analysisIntervalRef.current = setInterval(async () => {
      if (remoteVideoRef.current && remoteVideoRef.current.readyState >= 2) {
        const c = document.createElement('canvas');
        c.width = remoteVideoRef.current.videoWidth;
        c.height = remoteVideoRef.current.videoHeight;
        c.getContext('2d').drawImage(remoteVideoRef.current, 0, 0);
        c.toBlob(async (blob) => {
          if (!blob) return;
          const fd = new FormData();
          fd.append('file', blob, 'frame.jpg');
          try {
            const resp = await fetch(`/api/interviews/${interviewId}/analyze`, { method: 'POST', body: fd });
            const data = await resp.json();
            if (data.results?.length > 0) setEmotion(data.results[0].emotion);
          } catch (e) { console.error(e); }
        }, 'image/jpeg', 0.8);
      }
    }, 2000);
    return () => clearInterval(analysisIntervalRef.current);
  }, [hasJoined, interviewId]);

  // 5. Blur Loop
  useEffect(() => {
    let af;
    const loop = async () => {
      if (isBlurOn && isBlurLoaded) await blurProcessFrame();
      af = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(af);
  }, [isBlurOn, isBlurLoaded, blurProcessFrame]);

  // Handlers
  const handleJoin = () => setHasJoined(true);
  const leaveMeeting = () => {
    if (window.confirm("Quitter l'entretien ?")) navigate('/hr/applications');
  };

  const selectedMicLabel = mics.find(d => d.deviceId === selectedMic)?.label || "Microphone";
  const selectedCamLabel = devices.find(d => d.deviceId === selectedDevice)?.label || "Caméra";
  const selectedSpeakerLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || "Haut-parleurs";

  // --- SELECTION VIEW (Pre-join) ---
  if (!hasJoined) {
    return (
      <div className="selection-view">
        <header className="prejoin-header">
          <div className="brand-title">HumatiQ Live</div>
          <div className="flex gap-4 items-center">
            <div className="text-sm font-medium opacity-60">Session: {interviewId}</div>
            <Settings size={20} className="cursor-pointer opacity-60" />
            <HelpCircle size={20} className="cursor-pointer opacity-60" />
          </div>
        </header>

        <main className="prejoin-main">
          <div className="prejoin-left">
            <div className="preview-wrapper">
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                videoConstraints={{ deviceId: selectedDevice }}
                className="w-full h-full object-cover"
              />
              <div className="preview-controls-overlay">
                <button className={`preview-tool-btn ${!isMicOn ? 'off' : 'active'}`} onClick={() => setIsMicOn(!isMicOn)}>
                  {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button className={`preview-tool-btn ${!isCamOn ? 'off' : 'active'}`} onClick={() => setIsCamOn(!isCamOn)}>
                  {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                <div className="preview-divider"></div>
                <button className={`preview-tool-btn ${isBlurOn ? 'active' : ''}`} onClick={() => setIsBlurOn(!isBlurOn)}>
                  <Sparkles size={20} />
                </button>
                <button className="preview-tool-btn">
                   <MoreVertical size={20} />
                </button>
              </div>
            </div>

            <div className="prejoin-footer-devices">
              <div className="device-box">
                <span className="device-label">Microphone</span>
                <div className="dropdown-container">
                    <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === 'mic' ? null : 'mic')}>
                        <div className="pill-content">
                            <Mic size={18} />
                            <span>{selectedMicLabel}</span>
                        </div>
                        <ChevronDown size={14} />
                    </button>
                    {activeDropdown === 'mic' && (
                        <div className="device-dropdown">
                            {mics.map(m => (
                                <div key={m.deviceId} className={`dropdown-item ${selectedMic === m.deviceId ? 'active' : ''}`} onClick={() => { setSelectedMic(m.deviceId); setActiveDropdown(null); }}>
                                    {m.label || `Microphone ${m.deviceId.slice(0, 5)}`}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>

              <div className="device-box">
                <span className="device-label">Haut-parleurs</span>
                <div className="dropdown-container">
                    <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === 'speaker' ? null : 'speaker')}>
                        <div className="pill-content">
                            <Volume2 size={18} />
                            <span>{selectedSpeakerLabel}</span>
                        </div>
                        <ChevronDown size={14} />
                    </button>
                    {activeDropdown === 'speaker' && (
                        <div className="device-dropdown">
                            {speakers.map(s => (
                                <div key={s.deviceId} className={`dropdown-item ${selectedSpeaker === s.deviceId ? 'active' : ''}`} onClick={() => { setSelectedSpeaker(s.deviceId); setActiveDropdown(null); }}>
                                    {s.label || `Sortie ${s.deviceId.slice(0, 5)}`}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>

              <div className="device-box">
                <span className="device-label">Caméra</span>
                <div className="dropdown-container">
                    <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === 'cam' ? null : 'cam')}>
                        <div className="pill-content">
                            <Video size={18} />
                            <span>{selectedCamLabel}</span>
                        </div>
                        <ChevronDown size={14} />
                    </button>
                    {activeDropdown === 'cam' && (
                        <div className="device-dropdown">
                            {devices.map(c => (
                                <div key={c.deviceId} className={`dropdown-item ${selectedDevice === c.deviceId ? 'active' : ''}`} onClick={() => { setSelectedDevice(c.deviceId); setActiveDropdown(null); }}>
                                    {c.label || `Caméra ${c.deviceId.slice(0, 5)}`}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
            </div>
          </div>

          <div className="prejoin-right">
            <h1 className="join-hero-title">Prêt à participer ?</h1>
            <p className="join-hero-subtitle">Le candidat est peut-être déjà en ligne. Rejoignez la salle pour commencer l'analyse.</p>
            
            <button className="btn-participate" onClick={handleJoin}>
              Participer à la réunion
            </button>

            <div className="meeting-status-row">
              <div className="status-avatars">
                <div className="status-avatar"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="user" /></div>
                <div className="status-avatar"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aria" alt="user" /></div>
                <div className="status-avatar more">+1</div>
              </div>
              <div className="status-text">Interviewer en attente</div>
            </div>

            <div className="encryption-note">
                <Shield size={14} />
                <span>Connexion Chiffrée & AI Active</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- MEETING VIEW (Live) ---
  return (
    <div className="meeting-container">
      <div className="meeting-body">
        <div className="room-content">
          <div className="video-grid">
            <div className="video-tile">
              <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              {!remoteVideoRef.current?.srcObject && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                    <Users size={40} className="text-gray-700 mb-4" />
                    <p className="text-gray-500 font-medium">En attente du candidat...</p>
                </div>
              )}
              <div className="candidate-name">Candidat</div>
              <div className="emotion-hud">
                <div className="emotion-badge">
                  <div className="emotion-dot"></div>
                  <span>{emotion}</span>
                </div>
              </div>
            </div>

            <div className="local-video-pip">
              {isBlurOn ? <canvas ref={canvasRef} className="local-video" /> : (
                <Webcam ref={webcamRef} audio={false} mirrored={true} className="local-video" videoConstraints={{ deviceId: selectedDevice }} />
              )}
              <div className="pip-label">RH (Moi)</div>
            </div>
          </div>
        </div>

        {activePanel !== 'none' && (
          <div className="side-panel">
            <div className="panel-header">
              <div className="panel-title">{activePanel === 'chat' ? 'Transcription' : activePanel === 'notes' ? 'Notes' : 'Participants'}</div>
              <X size={20} className="cursor-pointer" onClick={() => setActivePanel('none')} />
            </div>
            <div className="panel-content">
              {activePanel === 'chat' && transcript.map((m, i) => (
                <div key={i} className="transcript-message">
                  <span className="msg-sender">{m.sender}</span>
                  <p className="msg-text">{m.text}</p>
                </div>
              ))}
              {activePanel === 'notes' && (
                <textarea className="w-full h-full bg-transparent border-none text-white resize-none outline-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Vos notes..." />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="control-bar">
        <div className="flex gap-4">
          <button className="control-btn" onClick={() => setActivePanel('chat')}><MessageSquare size={20} /></button>
          <button className="control-btn" onClick={() => setActivePanel('notes')}><FileText size={20} /></button>
        </div>

        <div className="main-controls">
          <button className={`control-btn ${!isMicOn ? 'danger' : ''}`} onClick={() => setIsMicOn(!isMicOn)}>
            {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          <button className={`control-btn ${!isCamOn ? 'danger' : ''}`} onClick={() => setIsCamOn(!isCamOn)}>
            {isCamOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          <button className={`control-btn ${isBlurOn ? 'active' : ''}`} onClick={() => setIsBlurOn(!isBlurOn)}>
            <Sparkles size={22} />
          </button>
          <button className="control-btn danger" onClick={leaveMeeting}><PhoneOff size={22} /></button>
        </div>

        <div className="flex gap-4 items-center">
            <div className="text-xl font-bold opacity-60 mr-4">{currentTime}</div>
            <MoreVertical size={20} className="cursor-pointer opacity-60" />
        </div>
      </div>
    </div>
  );
};

export default LiveInterview;
