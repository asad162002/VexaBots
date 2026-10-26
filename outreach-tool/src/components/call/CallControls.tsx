'use client';

import {
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  PauseCircle,
  PlayCircle,
  Volume2,
  Keyboard,
} from 'lucide-react';
import { useTelnyxCall } from '@/hooks/use-telnyx-call';

interface CallControlsProps {
  showTimer?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export default function CallControls({
  showTimer = true,
  layout = 'horizontal',
}: CallControlsProps) {
  const {
    status,
    message,
    durationSeconds,
    isMuted,
    isHeld,
    remoteMutedForMoreThan10s,
    remoteVolume,
    setVolume,
    toggleMute,
    toggleHold,
    endCall,
    sendDTMF,
  } = useTelnyxCall();

  const inCall = status === 'in-call';
  const onHold = status === 'held';
  const callInProgress = ['connecting', 'ringing', 'in-call', 'held'].includes(status);
  const canAct = inCall || onHold || status === 'ringing' || status === 'connecting';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const flexDirection = layout === 'vertical' ? 'flex-col' : 'flex-row';
  const alignItems = layout === 'vertical' ? 'items-center' : 'items-center';

  return (
    <div className={`flex ${flexDirection} ${alignItems} gap-3`}>
      {/* Timer */}
      {showTimer && callInProgress && (
        <div className="flex items-center gap-2 text-gray-300 font-mono bg-[#27272a] px-3 py-1.5 rounded-lg text-sm">
          <Clock className="w-4 h-4" />
          {formatDuration(durationSeconds)}
        </div>
      )}

      {/* Status message */}
      {message && (
        <span className="text-xs text-gray-500 font-mono">{message}</span>
      )}

      {/* Mute toggle */}
      {callInProgress && (
        <button
          onClick={toggleMute}
          className={`p-2.5 rounded-lg transition flex items-center gap-1 ${
            isMuted
              ? 'bg-red-600 text-white'
              : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
          }`}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={isMuted ? 'Unmute microphone (M)' : 'Mute microphone (M)'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isMuted && <span className="text-xs font-semibold">Muted</span>}
        </button>
      )}

      {/* Mute warning banner */}
      {remoteMutedForMoreThan10s && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          You are still muted
        </div>
      )}

      {/* Hold toggle */}
      {inCall && (
        <button
          onClick={toggleHold}
          className={`p-2.5 rounded-lg transition flex items-center gap-1 ${
            isHeld
              ? 'bg-blue-600 text-white'
              : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
          }`}
          aria-label={isHeld ? 'Resume call' : 'Hold call'}
          title={isHeld ? 'Resume call' : 'Hold call'}
        >
          {isHeld ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
        </button>
      )}

      {/* DTMF keypad */}
      {callInProgress && (
        <button
          onClick={() => sendDTMF('')}
          className="p-2.5 rounded-lg bg-[#27272a] text-gray-300 hover:bg-[#3f3f46] transition"
          aria-label="Open dial pad"
          title="Dial pad (DTMF)"
        >
          <Keyboard className="w-4 h-4" />
        </button>
      )}

      {/* Speaker volume slider */}
      {callInProgress && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Volume2 className="w-3 h-3" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={remoteVolume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1.5 bg-[#27272a] rounded appearance-none cursor-pointer slider"
            aria-label="Speaker volume"
          />
          <span className="w-8 text-right">{Math.round(remoteVolume * 100)}%</span>
        </div>
      )}

      {/* End call */}
      {canAct && (
        <button
          onClick={endCall}
          className="p-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition flex items-center gap-1"
          aria-label="End call"
          title="End call"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="text-xs">End call</span>
        </button>
      )}
    </div>
  );
}
