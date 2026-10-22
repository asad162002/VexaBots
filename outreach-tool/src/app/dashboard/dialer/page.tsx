'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, Phone, Search } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  company: string;
  status: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  phone_number: string;
  phone_label: string;
}

interface CallState {
  status: 'idle' | 'connecting' | 'ringing' | 'answered' | 'completed' | 'failed';
  callId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  duration: number;
  recordingUrl: string | null;
}

export default function DialerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedCaller, setSelectedCaller] = useState<string>('');
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    callId: null,
    fromNumber: null,
    toNumber: null,
    duration: 0,
    recordingUrl: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadsDropdown, setShowLeadsDropdown] = useState(false);

  useEffect(() => {
    loadTeamMembers();
    loadLeads();
  }, []);

  const loadTeamMembers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (!error && data) {
      setTeamMembers(data);
    }
  };

  const loadLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, company, status')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLeads(data);
      setFilteredLeads(data);
    }
  };

  useEffect(() => {
    const filtered = leads.filter(lead =>
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone && lead.phone.includes(searchTerm))
    );
    setFilteredLeads(filtered.slice(0, 10));
  }, [searchTerm, leads]);

  const startCall = async () => {
    if (!selectedLead || !selectedCaller) {
      alert('Please select a caller and a lead');
      return;
    }

    setIsLoading(true);
    setCallState({
      status: 'connecting',
      callId: null,
      fromNumber: selectedCaller,
      toNumber: selectedLead.phone,
      duration: 0,
      recordingUrl: null,
    });

    try {
      const response = await fetch('/api/telnyx/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerId: selectedCaller,
          leadPhone: selectedLead.phone,
          leadName: selectedLead.name,
          leadId: selectedLead.id,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setCallState(prev => ({
          ...prev,
          status: 'ringing',
          callId: result.callId,
          fromNumber: result.fromNumber,
        }));

        // Simulate status progression for demo
        setTimeout(() => {
          setCallState(prev => ({ ...prev, status: 'answered' }));
          startDurationTimer();
        }, 2000);
      } else {
        setCallState(prev => ({ ...prev, status: 'failed' }));
      }
    } catch (err) {
      setCallState(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  const startDurationTimer = () => {
    const interval = setInterval(() => {
      setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
    setTimerInterval(interval);
  };

  const stopDurationTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);
  };

  const endCall = async () => {
    if (callState.callId) {
      // In a real implementation, this would call Telnyx API to hang up
      console.log('Calling hangup for call:', callState.callId);
    }

    stopDurationTimer();
    setCallState({
      status: 'completed',
      callId: null,
      fromNumber: null,
      toNumber: null,
      duration: 0,
      recordingUrl: callState.recordingUrl,
    });
    setSelectedLead(null);
    setSearchTerm('');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered': return 'bg-green-500';
      case 'ringing': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'connecting': return 'bg-gray-400';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <nav className="border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-gray-300 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Cold Caller Dialer</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        {/* Team Member Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Your Phone Number</label>
          <select
            value={selectedCaller}
            onChange={(e) => setSelectedCaller(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a number...</option>
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.full_name} - {member.phone_number}
              </option>
            ))}
          </select>
        </div>

        {/* Lead Search */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Search Lead</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, company, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowLeadsDropdown(true)}
              onBlur={() => setTimeout(() => setShowLeadsDropdown(false), 200)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showLeadsDropdown && searchTerm && (
              <div className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-lg mt-1 max-h-60 overflow-y-auto">
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead);
                      setSearchTerm('');
                      setShowLeadsDropdown(false);
                    }}
                    className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0"
                  >
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-sm text-gray-400">{lead.company || 'No company'}</div>
                    <div className="text-sm text-gray-500">{lead.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Lead */}
        {selectedLead && (
          <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-400">Calling:</span>
                <span className="font-bold ml-2">{selectedLead.name}</span>
                <span className="text-gray-500 ml-2">{selectedLead.phone}</span>
                {selectedLead.company && (
                  <span className="text-gray-500"> at {selectedLead.company}</span>
                )}
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="mb-8">
          {callState.status === 'idle' ? (
            <button
              onClick={startCall}
              disabled={isLoading || !selectedLead || !selectedCaller}
              className={`w-full py-4 rounded-lg text-xl font-bold transition ${
                isLoading || !selectedLead || !selectedCaller
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isLoading ? 'Connecting...' : 'Start Call'}
            </button>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(callState.status)} animate-pulse`}></div>
                <span className="capitalize text-lg">{callState.status}</span>
              </div>
              <div className="text-2xl font-bold mb-4">{formatDuration(callState.duration)}</div>
              {callState.fromNumber && (
                <div className="text-sm text-gray-400 mb-4">
                  {callState.fromNumber} → {callState.toNumber}
                </div>
              )}
              <button
                onClick={endCall}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold"
              >
                End Call
              </button>
            </div>
          )}
        </div>

        {/* Recording */}
        {callState.recordingUrl && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">Call Recording</h3>
            <audio controls className="w-full">
              <source src={callState.recordingUrl} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </div>
    </div>
  );
}
