'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface TeamMember {
  id: string
  full_name: string
  email: string
  phone_number: string
}

interface CallLog {
  id: string
  lead_id: string
  from_number: string
  to_number: string
  status: string
  duration_seconds: number | null
  recorded_url: string | null
  created_at: string
}

export default function CallsPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [selectedLead, setSelectedLead] = useState<string>('')
  const [leads, setLeads] = useState<any[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
    if (error) console.error('Error fetching team members:', error)
    else setTeamMembers(data || [])
  }

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching leads:', error)
    else setLeads(data || [])
  }

  const fetchCallLogs = async () => {
    if (!selectedLead) return
    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .eq('lead_id', selectedLead)
      .order('created_at', { ascending: false })
    if (error) console.error('Error fetching call logs:', error)
    else setCallLogs(data || [])
  }

  useEffect(() => {
    fetchTeamMembers()
    fetchLeads()
    setLoading(false)
  }, [])

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSuccess('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSuccess('Please sign in first.')
        setSubmitting(false)
        return
      }

      const member = teamMembers.find(m => m.id === selectedMember)
      if (!member) {
        setSuccess('Select a caller first.')
        setSubmitting(false)
        return
      }

      const lead = leads.find(l => l.id === selectedLead)
      if (!lead?.phone) {
        setSuccess('Selected lead has no phone number.')
        setSubmitting(false)
        return
      }

      const response = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          callerId: member?.id,
          fromNumber: member?.phone_number || '',
          toNumber: lead.phone,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setSuccess(data.error || 'Failed to start call')
        setSubmitting(false)
        return
      }

      setSuccess('Call initiated. Ringing...')
    } catch (err) {
      setSuccess('Failed to start call')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Cold Caller Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Caller & Call Section */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Make a Call</h2>

          {/* Caller & Phone Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Caller</label>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select caller...</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.phone_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Lead</label>
              <select
                value={selectedLead}
                onChange={(e) => setSelectedLead(e.target.value)}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select lead...</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleStartCall}
            disabled={!selectedMember || !selectedLead || submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition"
          >
            {submitting ? 'Calling...' : 'Call Now'}
          </button>

          {success && <p className="text-sm text-green-400 mt-2">{success}</p>}
        </div>

        {/* Call Logs for Selected Lead */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Call Logs</h2>
          <select
            value={selectedLead}
            onChange={(e) => {
              setSelectedLead(e.target.value)
              setCallLogs([])
            }}
            className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          >
            <option value="">Select lead...</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.phone})
              </option>
            ))}
          </select>

          {callLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No calls logged for this lead.</p>
          ) : (
            <div className="space-y-3">
              {callLogs.map((log) => (
                <div key={log.id} className="border border-[#3f3f46] rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">
                      {log.from_number} → {log.to_number}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.status === 'answered' ? 'bg-green-500/20 text-green-400' :
                      log.status === 'busy' ? 'bg-orange-500/20 text-orange-400' :
                      log.status === 'no_answer' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.created_at).toLocaleString()}
                    {log.duration_seconds && ` | Duration: ${log.duration_seconds}s`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
