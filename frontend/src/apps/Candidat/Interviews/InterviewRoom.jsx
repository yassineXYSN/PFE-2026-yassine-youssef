import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, 
  Users, Settings, Layout, X, Sparkles, HelpCircle, Shield, ChevronDown, Volume2, MoreVertical
} from 'lucide-react';
import { useBackgroundBlur } from '../../../hooks/useBackgroundBlur';
import '../../HR/applications/FaceAffectus.css';

const InterviewRoom = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  
  // -- UI States --
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

  // -- Meeting States --
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isBlurOn, setIsBlurOn] = useState(false);
  const [transcript, setTranscript] = useState([]);

  // -- Refs --
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const interviewIdRef = useRef(null);

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

  // Handle outside click to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-container')) setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Request permissions initially
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        refreshDevices();
      })
      .catch(err => console.error("Initial permission error:", err));
  }, [refreshDevices]);

  // Fetch Interview ID from Application
  useEffect(() => {
    const fetchApp = async () => {
        try {
            const resp = await fetch(`/api/applications/${applicationId}`);
            const data = await resp.json();
            if (data.interview_id) {
                interviewIdRef.current = data.interview_id;
            }
        } catch (e) {
            console.error("Error fetching application interview id", e);
        }
    };
    fetchApp();
  }, [applicationId]);

  // 2. WebRTC (After Join)
  useEffect(() => {
    if (!hasJoined || !interviewIdRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/interviews/ws/${interviewIdRef.current}/candidate`;
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

    const initiateConnection = async () => {
        if (webcamRef.current?.video?.srcObject) {
            webcamRef.current.video.srcObject.getTracks().forEach(track => {
                pcRef.current.addTrack(track, webcamRef.current.video.srcObject);
            });
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            wsRef.current.send(JSON.stringify({ type: 'offer', offer }));
        }
    };
    
    wsRef.current.onopen = initiateConnection;

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [hasJoined]);

  // 3. Blur Loop
  useEffect(() => {
    let af;
    const loop = async () => {
      if (isBlurOn && isBlurLoaded) await blurProcessFrame();
      af = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(af);
  }, [isBlurOn, isBlurLoaded, blurProcessFrame]);

  // Time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedMicLabel = mics.find(d => d.deviceId === selectedMic)?.label || "Microphone";
  const selectedCamLabel = devices.find(d => d.deviceId === selectedDevice)?.label || "Caméra";
  const selectedSpeakerLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || "Haut-parleurs";


  const handleJoin = () => setHasJoined(true);
  const leaveMeeting = () => {
    if (window.confirm("Quitter l'entretien ?")) {
      navigate('/candidat/dashboard');
    }
  };

  if (!hasJoined) {
    return (
      <div className="selection-view">
        <header className="prejoin-header">
          <div className="brand-title">HumatiQ Salle d'Attente</div>
          <div className="flex gap-4 items-center">
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
            <h1 className="join-hero-title">Prêt à entrer ?</h1>
            <p className="join-hero-subtitle">Le recruteur est prêt à vous recevoir. Assurez-vous d'être dans un endroit calme.</p>
            
            <button className="btn-participate" onClick={handleJoin}>
              Entrer dans la salle
            </button>

            <div className="meeting-status-row">
              <div className="status-avatars">
                <div className="status-avatar"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="user" /></div>
              </div>
              <div className="status-text">Recruteur en ligne</div>
            </div>

            <div className="encryption-note">
                <Shield size={14} />
                <span>Session Sécurisée & Chiffrée</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
                    <p className="text-gray-500 font-medium text-center">En attente de l'interlocuteur...<br/><span className="text-xs opacity-50">Le recruteur se connecte</span></p>
                </div>
              )}
              <div className="candidate-name">Recruteur (RH)</div>
            </div>

            <div className="local-video-pip">
              {isBlurOn ? <canvas ref={canvasRef} className="local-video" /> : (
                <Webcam ref={webcamRef} audio={false} mirrored={true} className="local-video" videoConstraints={{ deviceId: selectedDevice }} />
              )}
              <div className="pip-label">Moi</div>
            </div>
          </div>
        </div>
      </div>

      <div className="control-bar">
        <div className="flex gap-4 items-center">
          <div className="text-sm font-bold opacity-60">Session HumatiQ</div>
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
          <button className="control-btn danger" onClick={leaveMeeting}>
            <PhoneOff size={22} />
          </button>
        </div>

        <div className="flex gap-4 items-center">
            <div className="text-xl font-bold opacity-60 mr-4">{currentTime}</div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;
