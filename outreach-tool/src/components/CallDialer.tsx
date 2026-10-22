'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type CallLog, type CallStatus } from '@/lib/types';
import { Phone, AlertCircle, Clock, Loader2, CheckCircle, XCircle, PhoneOff, PhoneMissed } from 'lucide-react';

type Caller = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number?: string | null;
};

interface CallDialerProps {
  lead: {
    id: string;
    phone: string | null;
    country_code: string | null;
    owner_name: string | null;
  } | null;
  onCallEnd?: (callLog: CallLog) => void;
}

const STATUS_BADGE: Record<CallStatus, { label: string; className: string }> = {
  initiated: { label: 'Dialing', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  ringing: { label: 'Ringing', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  answered: { label: 'Answered', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  busy: { label: 'Busy', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  voicemail: { label: 'Voicemail', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  no_answer: { label: 'No Answer', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  disconnected: { label: 'Disconnected', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

export default function CallDialer({ lead, onCallEnd }: CallDialerProps) {
  const [callers, setCallers] = useState<Caller[]>([]);
  const [selectedCaller, setSelectedCaller] = useState<string>('');
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>('');
  const [status, setStatus] = useState<CallStatus>('initiated');
  const [message, setMessage] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [isCalling, setIsCalling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCallersAndNumbers();
  }, [lead?.id]);

  const fetchCallersAndNumbers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number')
        .not('phone_number', 'is', null);
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      const callerList = (profiles ?? []).map((p: Caller) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone_number: p.phone_number,
      }));

      setCallers(callerList);
      if (callerList.length > 0) {
        setSelectedCaller(callerList[0].id);
        setSelectedFromNumber(callerList[0].phone_number || '');
      }
    } catch (e) {
      console.error('Unexpected error:', e);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    if (!lead?.phone) {
      setError('No phone number on this lead.');
      return;
    }
    if (!selectedCaller) {
      setError('Select a caller first.');
      return;
    }
    if (!selectedFromNumber) {
      setError('No caller number selected. Please add a US number in settings or contact admin.');
      return;
    }

    setIsCalling(true);
    setStatus('initiated');
    setMessage('');
    setError(null);
    setDuration(0);

    try {
      const response = await fetch('/api/telnyx/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          callerId: selectedCaller,
          leadPhone: lead.phone,
          leadName: lead.owner_name || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start call');
      }

      setMessage('Call initiated. Ringing...');

      const interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      const callEventSource = new EventSource(`/api/call/${data.callId}/events`);

      callEventSource.addEventListener('call-started', (e) => {
        const evt = JSON.parse(e.data);
        setStatus(evt.status);
        setMessage(`Calling ${lead.phone}...`);
      });

      callEventSource.addEventListener('call-answered', (e) => {
        const evt = JSON.parse(e.data);
        setStatus(evt.status);
        setMessage('Connected. You can talk now.');
      });

      callEventSource.addEventListener('call-busy', (e) => {
        const evt = JSON.parse(e.data);
        setStatus(evt.status);
        setMessage('Called party is busy.');
      });

      callEventSource.addEventListener('call-no-answer', (e) => {
        const evt = JSON.parse(e.data);
        setStatus(evt.status);
        setMessage('No answer.');
      });

      callEventSource.addEventListener('call-voicemail', (e) => {
        const evt = JSON.parse(e.data);
        setStatus(evt.status);
        setMessage('Left on voicemail.');
      });

      callEventSource.addEventListener('call-disconnected', (e) => {
        const evt = JSON.parse(e.data);
        setStatus(evt.status);
        setMessage('Call ended.');
        callEventSource.close();
        clearInterval(interval);
      });

      callEventSource.onerror = () => {
        setStatus('disconnected');
        setMessage('Connection lost.');
        callEventSource.close();
        clearInterval(interval);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setIsCalling(false);
    }
  };

  const endCall = useCallback(() => {
    setStatus('disconnected');
    setMessage('Call ended.');
    setDuration(0);
    setIsCalling(false);
  }, []);

  return (
    <div>
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {lead?.phone ? 'Phone Dialer' : 'No Phone Available'}
        </h2>

        {!lead?.phone ? (
          <p className="text-sm text-gray-400">
            This lead has no phone number. Dialer is disabled.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">{lead.phone}</span>
            </div>

            {callers.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                      Caller
                    </label>
                    <select
                      value={selectedCaller}
                      onChange={(e) => {
                        setSelectedCaller(e.target.value)
                        const caller = callers.find(c => c.id === e.target.value)
                        setSelectedFromNumber(caller?.phone_number || '')
                      }}
                      className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {callers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name || c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                      From Number
                    </label>
                    <select
                      value={selectedFromNumber}
                      onChange={(e) => setSelectedFromNumber(e.target.value)}
                      className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select call number...</option>
                      {callers
                        .filter((c) => c.phone_number)
                        .map((c) => (
                          <option key={c.id} value={c.phone_number || ''}>
                            {c.full_name || c.email} — {c.phone_number}
                          </option>
                        ))}
                    </select>
                    </div>
                </div>
              </>
            )}

            {selectedFromNumber && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3 text-green-500/60" />
                <span>Calling from {selectedFromNumber}</span>
              </div>
            )}

            {!selectedFromNumber && (
              <p className="text-xs text-gray-500">
                Add a US number in your Telnyx dashboard, then select it here before calling.
              </p>
            )}

            {status !== 'initiated' && status !== 'ringing' && (
              <button
                onClick={startCall}
                disabled={isCalling}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-green-800 text-white font-semibold rounded-lg px-4 py-3 text-sm transition disabled:cursor-not-allowed"
              >
                {isCalling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting call...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    <span>Call Now</span>
                  </>
                )}
              </button>
            )}

            {status === 'answered' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={endCall}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition"
                >
                  <XCircle className="w-4 h-4" />
                  <span>End Call</span>
                </button>
              </div>
            )}

            {(status === 'ringing' || status === 'answered') && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-gray-300">{formatDuration(duration)}</span>
                </div>
              </div>
            )}

            {(status === 'busy' ||
              status === 'voicemail' ||
              status === 'no_answer' ||
              status === 'disconnected') && (
                <div className="flex items-center gap-2 p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">
                    {STATUS_BADGE[status].label}
                    {message && ` - ${message}`}
                  </span>
                </div>
              )}

            {status === 'answered' && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-500/60" />
                <span className="text-sm text-green-400">You are connected to the lead.</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
