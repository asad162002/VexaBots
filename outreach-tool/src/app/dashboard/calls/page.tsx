'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Phone, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { CallControls, CallLeadRow, getStatusColor, getStatusLabel } from '@/components/calls/calls-types';
import type { LeadWithCallStatus, CallLog } from '@/components/calls/calls-types';

function CallsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string | null; email: string | null; caller_id_number: string | null }>>([]);
  const [leads, setLeads] = useState<LeadWithCallStatus[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'called' | 'not_called'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, caller_id_number, role')
        .not('caller_id_number', 'is', null);
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else {
        setProfiles(profilesData ?? []);
        if (profilesData && profilesData.length > 0) {
          setSelectedProfile(profilesData[0].id);
        }
      }

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error;
          // Members only see their own assigned leads
          if (!isAdmin) {
            return { data: data?.filter(l => l.assigned_to === user?.id) ?? [], error };
          }
          return { data, error };
        });
      if (leadsError) console.error('Error fetching leads:', leadsError);

      const { data: logsData, error: logsError } = await supabase
        .from('call_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (logsError) console.error('Error fetching call logs:', logsError);
      else {
        // Members only see their own call logs
        const memberLogs = isAdmin ? logsData : (logsData ?? []).filter(l => l.caller_id === user?.id);
        setCallLogs(memberLogs ?? []);
      }

      if (leadsData) {
        const leadsWithCalls = (leadsData ?? []).map((lead: any) => {
          const logs = (logsData ?? []).filter((log: CallLog) => log.lead_id === lead.id);
          return { ...lead, call_logs: logs, last_call: logs.length > 0 ? logs[0] : null };
        });
        setLeads(leadsWithCalls);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead?.phone) { setMessage('Lead has no phone number'); return; }

    setSubmitting(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/telnyx/call-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          to_number: lead.phone,
          lead_id: lead.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || 'Failed to start call');
      else { setMessage(`Call initiated for ${lead.title || 'lead'}...`); await fetchData(); }
    } catch (err) {
      setMessage('Failed to start call');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      (lead.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (lead.owner_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (lead.phone || '').toLowerCase().includes(searchQuery.toLowerCase());

    const hasBeenCalled = lead.last_call !== null && lead.last_call?.status !== 'initiated';
    if (filterStatus === 'called') return matchesSearch && hasBeenCalled;
    if (filterStatus === 'not_called') return matchesSearch && !hasBeenCalled;
    return matchesSearch;
  });

  // Don't render until auth is loaded to avoid flash of member UI for admins
  if (loading || authLoading) {
    return null;
  }

  return (
    <CallsPageContent
      leads={leads}
      isAdmin={isAdmin}
      filteredLeads={filteredLeads}
      profiles={profiles}
      selectedProfile={selectedProfile}
      filterStatus={filterStatus}
      onFilterStatusChange={setFilterStatus}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    submitting={submitting}
      message={message}
      onCall={handleCall}
      onCallerChange={(e) => setSelectedProfile(e.target.value)}
      onRefresh={fetchData}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
      callLogs={callLogs}
      leadMap={Object.fromEntries(leads.map(l => [l.id, l]))}
    />
  );
}

function CallsPageContent({
  leads, isAdmin, filteredLeads, profiles, selectedProfile, onCallerChange, filterStatus, onFilterStatusChange,
  searchQuery, onSearchChange, submitting, message, onCall, onRefresh,
  dateFrom, dateTo, onDateFromChange, onDateToChange, callLogs, leadMap,
  }: {
  leads: LeadWithCallStatus[];
  isAdmin: boolean;
  filteredLeads: LeadWithCallStatus[];
  profiles: Array<{ id: string; full_name: string | null; email: string | null; caller_id_number: string | null }>;
  selectedProfile: string;
  onCallerChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  filterStatus: 'all' | 'called' | 'not_called';
  onFilterStatusChange: (v: 'all' | 'called' | 'not_called') => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  submitting: boolean;
  message: string;
  onCall: (id: string) => void;
  onRefresh: () => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  callLogs: CallLog[];
  leadMap: Record<string, LeadWithCallStatus>;
}) {
  const filteredLogs = callLogs.filter((log) => {
    if (selectedProfile && log.caller_id !== selectedProfile) return false;
    if (dateFrom) {
      const d = new Date(log.created_at);
      if (d < new Date(`${dateFrom}T00:00:00`)) return false;
    }
    if (dateTo) {
      const d = new Date(log.created_at);
      if (d > new Date(`${dateTo}T23:59:59`)) return false;
    }
    return true;
  });

  const totalDuration = filteredLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
  const answeredCount = filteredLogs.filter((l) => l.status === 'answered' || l.status === 'completed').length;

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cold Caller Dashboard</h1>
        <button onClick={onRefresh} className="text-xs text-muted hover:text-foreground transition" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <CallControls
        isAdmin={isAdmin}
        selectedProfile={selectedProfile}
        profiles={profiles}
        filterStatus={filterStatus}
        onCallerChange={onCallerChange}
        onFilterChange={onFilterStatusChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        leadsCount={leads.length}
        calledCount={leads.filter(l => l.last_call && l.last_call.status !== 'initiated').length}
        pendingCount={leads.filter(l => !l.last_call || l.last_call.status === 'initiated').length}
      />

      {message && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
          {message}
        </div>
      )}

      <div className="bg-secondary border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Lead</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Phone</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Last Call</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Duration</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.map((lead) => (
                <CallLeadRow
                  key={lead.id}
                  lead={lead}
                  submitting={submitting}
                  onCall={onCall}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-muted">No leads found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Call History */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Call History</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { onDateFromChange(''); onDateToChange(''); }}
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3 text-xs text-muted">
          <span>{filteredLogs.length} calls</span>
          <span>{answeredCount} answered</span>
          <span>{Math.floor(totalDuration / 60)}m {totalDuration % 60}s total</span>
        </div>

        <div className="bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Date</th>
                  <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Lead</th>
                  <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Caller</th>
                  <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">To Number</th>
                  <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-2.5">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const lead = log.lead_id ? leadMap[log.lead_id] : null;
                  const caller = profiles.find(p => p.id === log.caller_id);
                  const mins = Math.floor((log.duration_seconds || 0) / 60);
                  const secs = (log.duration_seconds || 0) % 60;
                  return (
                    <tr key={log.id} className="hover:bg-card/50">
                      <td className="px-4 py-2.5 text-sm text-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-foreground">
                        {lead?.title || 'Unknown Lead'}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">
                        {caller?.full_name || caller?.email || 'Unknown'}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">{log.to_number}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(log.status)}`}>
                          {getStatusLabel(log.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">
                        {log.duration_seconds ? `${mins}m ${secs}s` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Phone className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted">No calls found for this caller and date range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallsPage;
