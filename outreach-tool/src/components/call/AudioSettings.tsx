'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Mic,
  Speaker,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTelnyxCall } from '@/hooks/use-telnyx-call';

interface AudioSettingsProps {
  className?: string;
  onTestMic?: () => void;
}

export default function AudioSettings({ className = '', onTestMic }: AudioSettingsProps) {
  const {
    availableInputDevices,
    availableOutputDevices,
    selectedInputDevice,
    selectedOutputDevice,
    canChangeOutputDevice,
    micPermission,
    micLevel,
    selectInputDevice,
    selectOutputDevice,
    testMicrophone,
    stopTestMicrophone,
    refreshDevices,
  } = useTelnyxCall();

  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showLevelMeter, setShowLevelMeter] = useState(false);
  const meterRef = useRef<HTMLDivElement>(null);
  const [audioCtxWarning, setAudioCtxWarning] = useState<string | null>(null);
  const [audioCtxSupported, setAudioCtxSupported] = useState(true);

  // Check Web Audio API support
  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      setAudioCtxSupported(false);
      setAudioCtxWarning('Web Audio API not supported in this browser.');
    }
  }, []);

  // Mic level bar animation
  useEffect(() => {
    if (showLevelMeter && meterRef.current) {
      const percentage = Math.round(micLevel * 100);
      meterRef.current.style.width = `${Math.max(2, percentage)}%`;
    }
  }, [micLevel, showLevelMeter]);

  const handleTestMic = async () => {
    if (isTesting) {
      stopTestMicrophone();
      setIsTesting(false);
      setShowLevelMeter(false);
    } else {
      if (micPermission !== 'granted') {
        await refreshDevices();
      }
      if (micPermission === 'denied') {
        return;
      }
      await testMicrophone();
      setIsTesting(true);
      setShowLevelMeter(true);
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (isTesting) {
          stopTestMicrophone();
          setIsTesting(false);
          setShowLevelMeter(false);
        }
      }, 10000);
    }
  };

  const getPermissionStatusText = () => {
    switch (micPermission) {
      case 'denied':
        return 'Microphone permission denied';
      case 'granted':
        return 'Microphone ready';
      default:
        return 'Permission not yet requested';
    }
  };

  const getPermissionIcon = () => {
    switch (micPermission) {
      case 'denied':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'granted':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const inputLabel = (d: MediaDeviceInfo) => {
    return d.label || `Microphone ${d.deviceId.slice(0, 8)}`;
  };

  const outputLabel = (d: MediaDeviceInfo) => {
    return d.label || `Speaker ${d.deviceId.slice(0, 8)}`;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 transition"
        aria-label="Audio settings"
        aria-expanded={isOpen}
        title="Audio settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 bottom-full mb-2 w-64 bg-[#1a1a1a] border border-[#27272a] rounded-lg shadow-xl p-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Microphone selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <Mic className="w-3 h-3" />
              Microphone
            </label>
            <select
              value={selectedInputDevice || ''}
              onChange={(e) => {
              const val = e.target.value || null;
              selectInputDevice(val);
            }}
              disabled={micPermission === 'denied'}
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Default</option>
              {availableInputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {inputLabel(d)}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between text-xs">
              {getPermissionIcon()}
              <span className="text-gray-400">{getPermissionStatusText()}</span>
            </div>

            {micPermission !== 'granted' && (
              <button
                onClick={refreshDevices}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition"
              >
                Allow microphone access
              </button>
            )}
          </div>

          {/* Microphone test / level meter */}
          <div className="space-y-2">
            <button
              onClick={handleTestMic}
              disabled={!audioCtxSupported || micPermission === 'denied'}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 rounded disabled:opacity-40 transition"
            >
              {isTesting ? (
                <>
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Testing... click to stop
                </>
              ) : (
                <>
                  Test microphone
                </>
              )}
            </button>

            {showLevelMeter && (
              <div className="space-y-1">
                <div className="h-2 bg-[#27272a] rounded overflow-hidden">
                  <div
                    ref={meterRef}
                    className="h-full bg-green-500 rounded transition-all duration-75 ease-out"
                    style={{ width: '2px' }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  Input level: {Math.round(micLevel * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Speaker selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <Speaker className="w-3 h-3" />
              Speaker / Headphones
            </label>
            {canChangeOutputDevice ? (
              <>
                <select
                  value={selectedOutputDevice || ''}
                  onChange={(e) => {
              const val = e.target.value || null;
              selectOutputDevice(val);
            }}
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">System default</option>
                  {availableOutputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {outputLabel(d)}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <VolumeX className="w-3 h-3" />
                <span>Speaker switching not supported (Safari)</span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {audioCtxWarning && (
            <div className="flex items-start gap-2 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{audioCtxWarning}</span>
            </div>
          )}

          {micPermission === 'denied' && (
            <div className="flex items-start gap-2 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                Click the lock icon in your browser's address bar and allow
                microphone access to use call features.
              </span>
            </div>
          )}

          {/* Refresh devices */}
          <button
            onClick={refreshDevices}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 rounded transition"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh device list
          </button>
        </div>
      )}
    </div>
  );
}
