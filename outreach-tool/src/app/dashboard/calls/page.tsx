'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Phone, CheckCircle, XCircle, Clock, BarChart3, Filter, Search, PlayCircle, ExternalLink, RefreshCw } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone_number: string | null
  role: string | null
}

interface Lead {
  id: string
  title: string | null
  owner_name: string | null
  phone: string | null
  status: string | null
  source: string | null
  icp_score: number | null
}

interface CallLog {
  id: string
  lead_id: string
  caller_id: string
  from_number: string
  to_number: string
  status: string
  duration_seconds: number | null
  recorded_url: string | null
  created_at: string
}

interface LeadWithCallStatus extends Lead {
  call_logs: CallLog[]
  last_call?: CallLog | null
}

export default function CallsPage() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [leads, setLeads] = useState<LeadWithCallStatus[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [selectedLead, setSelectedLead] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'called' | 'not_called'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, role')
        .not('phone_number', 'is', null)
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
      } else {
        setProfiles(profilesData ?? [])
        if (profilesData && profilesData.length > 0) {
          setSelectedProfile(profilesData[0].id)
        }
      }

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
      if (leadsError) {
        console.error('Error fetching leads:', leadsError)
      }

      const { data: logsData, error: logsError } = await supabase
        .from('call_logs')
        .select('*')
        .order('created_at', { ascending: false })
      if (logsError) {
        console.error('Error fetching call logs:', logsError)
      } else {
        setCallLogs(logsData ?? [])
      }

      // Merge call logs with leads
      if (leadsData) {
        const leadsWithCalls = (leadsData ?? []).map((lead: Lead) => {
          const logs = (logsData ?? []).filter((log: CallLog) => log.lead_id === lead.id)
          return {
            ...lead,
            call_logs: logs,
            last_call: logs.length > 0 ? logs[0] : null
          }
        })
        setLeads(leadsWithCalls)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCall = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead?.phone) {
      setMessage('Lead has no phone number')
      return
    }
    if (!selectedProfile) {
      setMessage('Select a caller first')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      const response = await fetch('/api/telnyx/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerId: selectedProfile,
          leadPhone: lead.phone,
          leadName: lead.title || lead.owner_name || 'Unknown',
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setMessage(data.error || 'Failed to start call')
      } else {
        setMessage(`Call initiated for ${lead.title || 'lead'}...`)
        await fetchData()
      }
    } catch (err) {
      setMessage('Failed to start call')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (lead.owner_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (lead.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const hasBeenCalled = lead.last_call !== null && lead.last_call?.status !== 'initiated'
    
    if (filterStatus === 'called') return matchesSearch && hasBeenCalled
    if (filterStatus === 'not_called') return matchesSearch && !hasBeenCalled
    return matchesSearch
  })

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'answered': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'busy': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'no_answer': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'voicemail': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'initiated': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'ringing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'disconnected': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'answered': return 'Answered'
      case 'busy': return 'Busy'
      case 'no_answer': return 'No Answer'
      case 'voicemail': return 'Voicemail'
      case 'initiated': return 'Dialing'
      case 'ringing': return 'Ringing'
      case 'disconnected': return 'Disconnected'
      default: return status || 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-[#0f0f0f]">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading calls...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-screen bg-[#0f0f0f]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Cold Caller Dashboard</h1>
        <button
          onClick={fetchData}
          className="text-xs text-gray-400 hover:text-white transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Controls */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Caller</label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select caller...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email} ({p.phone_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Filter</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Leads</option>
              <option value="called">Called</option>
              <option value="not_called">Not Called</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lead name, phone..."
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Stats</label>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total</span>
                <span className="text-white font-bold"> {leads.length}</span>
              </div>
              <div>
                <span className="text-gray-400">Called</span>
                <span className="text-green-400 font-bold">
                  {' '}
                  {leads.filter(l => l.last_call && l.last_call.status !== 'initiated').length}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Pending</span>
                <span className="text-yellow-400 font-bold">
                  {' '}
                  {leads.filter(l => !l.last_call || l.last_call.status === 'initiated').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
          {message}
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#27272a]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Lead</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Phone</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">ICP Score</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Last Call</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Duration</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {filteredLeads.map((lead) => {
                const lastCall = lead.last_call
                const hasCalled = lastCall !== null && lastCall?.status !== 'initiated'
                return (
                  <tr key={lead.id} className="hover:bg-[#27272a]/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{lead.title || 'Untitled'}</p>
                        {lead.owner_name && (
                          <p className="text-xs text-gray-500">{lead.owner_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.phone ? (
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Phone className="w-3 h-3 text-gray-500" />
                          {lead.phone}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.icp_score !== null ? (
                        <span className="text-sm text-white">{lead.icp_score}</span>
                      ) : (
                        <span className="text-xs text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasCalled && lastCall ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${getStatusColor(lastCall.status)}`}>
                          {getStatusLabel(lastCall.status)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Not called</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lastCall?.duration_seconds ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-300">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {lastCall.duration_seconds}s
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lead.phone && selectedProfile && (
                          <button
                            onClick={() => handleCall(lead.id)}
                            disabled={submitting}
                            className="text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
                            title={hasCalled ? 'Call again' : 'Call now'}
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        )}
                        {lastCall?.recorded_url && (
                          <a
                            href={lastCall.recorded_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 transition"
                            title="Listen to recording"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </a>
                        )}
                        {lead.id && (
                          <a
                            href={`/dashboard/leads/${lead.id}`}
                            className="text-gray-400 hover:text-gray-300 transition"
                            title="View lead details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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
  )
}
