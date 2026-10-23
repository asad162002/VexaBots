'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Phone, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { CallControls, CallLeadRow } from '@/components/calls/calls-types';
import type { LeadWithCallStatus, CallLog } from '@/components/calls/calls-types';

function CallsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string | null; email: string | null; phone_number: string | null }>>([]);
  const [leads, setLeads] = useState<LeadWithCallStatus[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'called' | 'not_called'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, role')
        .not('phone_number', 'is', null);
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
      const response = await fetch('/api/telnyx/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          leadId: lead.id,
          leadPhone: lead.phone,
          leadName: lead.title || lead.owner_name || 'Unknown',
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
    />
  );
}

function CallsPageContent({
  leads, isAdmin, filteredLeads, profiles, selectedProfile, onCallerChange, filterStatus, onFilterStatusChange,
  searchQuery, onSearchChange, submitting, message, onCall, onRefresh,
  }: {
  leads: LeadWithCallStatus[];
  isAdmin: boolean;
  filteredLeads: LeadWithCallStatus[];
  profiles: Array<{ id: string; full_name: string | null; email: string | null; phone_number: string | null }>;
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
}) {
  return (
    <div className="p-6 min-h-screen bg-[#0f0f0f]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Cold Caller Dashboard</h1>
        <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-white transition" title="Refresh">
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

      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#27272a]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Lead</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Phone</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Last Call</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Duration</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
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
            <Phone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No leads found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallsPage;
