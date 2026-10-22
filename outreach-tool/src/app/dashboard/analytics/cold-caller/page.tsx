'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Calendar, Search, Play } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  company: string;
}

interface Log {
  id: string;
  caller_id: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  recording_url: string | null;
  duration_seconds: number;
  created_at: string;
  lead: Lead | null;
}

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString();
};

const formatDuration = (seconds: number) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function ColdCallerAnalyticsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*, leads(name, phone, company)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedLogs: Log[] = data.map(log => ({
        id: log.id,
        caller_id: log.caller_id,
        from_number: log.from_number,
        to_number: log.to_number,
        direction: log.direction,
        status: log.status,
        recording_url: log.recording_url,
        duration_seconds: log.duration_seconds,
        created_at: log.created_at,
        lead: log.leads ? {
          id: '',
          name: log.leads.name || '',
          phone: log.leads.phone || '',
          company: log.leads.company || '',
        } : null,
      }));
      setLogs(formattedLogs);
      setFilteredLogs(formattedLogs);
    }
    setLoading(false);
  };

  useEffect(() => {
    let filtered = logs;
    
    // Filter by date
    const dateStr = formatDate(selectedDate);
    filtered = filtered.filter(log => 
      log.created_at && log.created_at.startsWith(dateStr)
    );

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.from_number?.includes(searchTerm) ||
        log.to_number?.includes(searchTerm) ||
        (log.lead?.name && log.lead.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.status?.includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [selectedDate, searchTerm, logs]);

  const handlePlay = (url: string) => {
    setPlayingUrl(url);
  };

  const handleStop = () => {
    setPlayingUrl(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      answered: 'bg-green-100 text-green-800',
      busy: 'bg-yellow-100 text-yellow-800',
      no_answer: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      initiated: 'bg-purple-100 text-purple-800',
    };
    const style = styles[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Call Analytics</h1>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Date:</label>
            <input
              type="date"
              value={formatDate(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by number, lead name, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{filteredLogs.length}</div>
            <div className="text-sm text-gray-600">Total Calls</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredLogs.filter(l => l.status === 'answered' || l.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-600">Answered</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.floor(filteredLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / 60)}m
            </div>
            <div className="text-sm text-gray-600">Total Duration</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {filteredLogs.filter(l => l.recording_url).length}
            </div>
            <div className="text-sm text-gray-600">Recordings</div>
          </div>
        </div>

        {/* Call Logs Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.created_at ? formatDateTime(log.created_at) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.from_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.to_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.lead ? (
                        <div>
                          <div className="font-medium text-gray-900">{log.lead.name}</div>
                          <div className="text-sm text-gray-500">{log.lead.company}</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(log.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDuration(log.duration_seconds || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.recording_url ? (
                        playingUrl === log.recording_url ? (
                          <button
                            onClick={handleStop}
                            className="text-red-600 hover:text-red-800"
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePlay(log.recording_url!)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Play
                          </button>
                        )
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">
              No calls found for this date.
            </div>
          )}
        </div>

        {/* Audio Player */}
        {playingUrl && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <audio controls autoPlay className="w-full max-w-2xl mx-auto">
              <source src={playingUrl} type="audio/wav" />
            </audio>
          </div>
        )}
      </div>
    </div>
  );
}
