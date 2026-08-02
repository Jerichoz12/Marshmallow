import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  User as UserIcon,
  Maximize2
} from 'lucide-react';
import { ActiveCallState, User } from '../types';
import { wsManager } from '../services/api';
import { playRingtone } from '../utils/sound';
import { UserAvatar } from './UserAvatar';

interface VideoCallModalProps {
  callState: ActiveCallState | null;
  currentUser: User;
  onEndCall: () => void;
  onAcceptCall: () => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  callState,
  currentUser,
  onEndCall,
  onAcceptCall
}) => {
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, cameraOff]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Ringtone handling for incoming call
  useEffect(() => {
    let stopRingtone: (() => void) | null = null;
    if (callState && !callState.isCaller && callState.status === 'ringing') {
      stopRingtone = playRingtone();
    }
    return () => {
      if (stopRingtone) stopRingtone();
    };
  }, [callState]);

  // Call Duration Timer
  useEffect(() => {
    let timer: any;
    if (callState?.status === 'connected') {
      timer = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDurationSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState?.status]);

  // WebRTC Setup
  useEffect(() => {
    if (!callState || callState.status !== 'connected') return;

    let stream: MediaStream | null = null;

    const setupWebRTC = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        peerConnectionRef.current = pc;

        // Try getting local camera stream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
        } catch (mediaErr) {
          console.warn('Native camera unavailable, creating animated canvas stream:', mediaErr);
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          let frame = 0;
          const draw = () => {
            if (!ctx) return;
            frame++;
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(1, '#831843');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(currentUser.nickname, 320, 220);

            ctx.fillStyle = '#f472b6';
            ctx.font = '14px sans-serif';
            ctx.fillText('● Live Video Stream', 320, 250);
          };
          setInterval(draw, 50);
          stream = canvas.captureStream(30);
        }

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => pc.addTrack(track, stream!));

        // Remote track handler
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
            }
          }
        };

        // ICE candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            wsManager.send('call_ice_candidate', {
              receiverId: callState.peerId,
              candidate: event.candidate
            });
          }
        };

        // Handle ICE Candidate relay from WebSocket
        const unbindIce = wsManager.on('call_ice_candidate', (payload) => {
          if (payload.candidate && peerConnectionRef.current) {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        });

        if (callState.isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          wsManager.send('call_offer', {
            receiverId: callState.peerId,
            callId: callState.callId,
            callerId: currentUser.id,
            callerUsername: currentUser.username,
            callerNickname: currentUser.nickname,
            callerAvatarUrl: currentUser.avatarUrl,
            callerBorderId: currentUser.borderId,
            type: callState.type,
            sdp: offer
          });

          const unbindAnswer = wsManager.on('call_answer', async (payload) => {
            if (payload.sdp && peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
          });

          return () => {
            unbindAnswer();
            unbindIce();
          };
        } else {
          const unbindOffer = wsManager.on('call_offer', async (payload) => {
            if (payload.sdp && peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              wsManager.send('call_answer', {
                receiverId: callState.peerId,
                sdp: answer
              });
            }
          });

          return () => {
            unbindOffer();
            unbindIce();
          };
        }
      } catch (err) {
        console.error('WebRTC Setup Error:', err);
      }
    };

    setupWebRTC();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
    };
  }, [callState?.status, callState?.isCaller]);

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted;
      });
      setMicMuted(!micMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOff;
      });
      setCameraOff(!cameraOff);
    }
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !speakerMuted;
      setSpeakerMuted(!speakerMuted);
    }
  };

  if (!callState) return null;

  // INCOMING RINGING BANNER / MODAL
  if (!callState.isCaller && callState.status === 'ringing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden"
        >
          {/* Pulsing ring background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-pink-500/10 rounded-full blur-xl animate-ping" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4">
              <UserAvatar
                userId={callState.peerId}
                borderId={callState.peerBorderId}
                src={callState.peerAvatarUrl}
                username={callState.peerUsername}
                nickname={callState.peerNickname}
                size="2xl"
              />
            </div>
            <h3 className="text-xl font-bold text-slate-100">{callState.peerNickname}</h3>
            <p className="text-xs text-pink-400 font-medium mt-1 uppercase tracking-wider">
              Incoming 1-on-1 {callState.type} Call...
            </p>

            <div className="mt-8 flex items-center justify-center space-x-6">
              <button
                onClick={onEndCall}
                className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 transition hover:scale-110 active:scale-95"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <button
                onClick={onAcceptCall}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition hover:scale-110 active:scale-95 animate-bounce"
                title="Accept Call"
              >
                <Phone className="w-6 h-6" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ACTIVE CONNECTED OR OUTGOING RINGING CALL OVERLAY
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* Top Bar Info */}
      <div className="flex items-center justify-between z-20 bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80">
        <div className="flex items-center space-x-3">
          <UserAvatar
            userId={callState.peerId}
            borderId={callState.peerBorderId}
            src={callState.peerAvatarUrl}
            username={callState.peerUsername}
            nickname={callState.peerNickname}
            size="md"
          />
          <div>
            <h4 className="font-bold text-sm text-slate-100">{callState.peerNickname}</h4>
            <p className="text-xs text-slate-400 font-mono">
              {callState.status === 'connected'
                ? `Active Call • ${Math.floor(callDurationSeconds / 60)}:${(callDurationSeconds % 60).toString().padStart(2, '0')}`
                : 'Calling user...'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider">
            WebRTC Encrypted
          </span>
        </div>
      </div>

      {/* Main Video Display Stage */}
      <div className="relative flex-1 my-4 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
        {/* Remote Partner Video Stream */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Fallback Partner Avatar if video not active */}
        {(!remoteStream || callState.type === 'audio') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
            <div className="mb-4">
              <UserAvatar
                userId={callState.peerId}
                borderId={callState.peerBorderId}
                src={callState.peerAvatarUrl}
                username={callState.peerUsername}
                nickname={callState.peerNickname}
                size="3xl"
              />
            </div>
            <h3 className="text-xl font-bold text-slate-100">{callState.peerNickname}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {callState.status === 'connected' ? 'Voice Call Connected' : 'Ringing...'}
            </p>
          </div>
        )}

        {/* Local Video Stream Picture-in-Picture Preview */}
        <div className="absolute bottom-4 right-4 w-32 h-44 sm:w-44 sm:h-60 bg-slate-950 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraOff ? 'hidden' : 'block'}`}
          />
          {cameraOff && (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950">
              <UserIcon className="w-8 h-8 mb-1" />
              <span className="text-[10px]">Cam Off</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="z-20 bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 p-4 rounded-3xl flex items-center justify-center space-x-4 max-w-md mx-auto w-full">
        <button
          onClick={toggleMic}
          className={`p-3.5 rounded-2xl transition ${
            micMuted ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCamera}
          className={`p-3.5 rounded-2xl transition ${
            cameraOff ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={cameraOff ? 'Turn Cam On' : 'Turn Cam Off'}
        >
          {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleSpeaker}
          className={`p-3.5 rounded-2xl transition ${
            speakerMuted ? 'bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={speakerMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {speakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          onClick={onEndCall}
          className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center space-x-2 transition active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
};
