'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Mail, ExternalLink, User, Building2, FileText, Calendar } from 'lucide-react';

interface LinkedInLead {
  id: string;
  place_id: string | null;
  lead_name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function LinkedInLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const leadId = unwrappedParams.id;

  const [lead, setLead] = useState<LinkedInLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const fetchLead = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('linkedin_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) {
      console.error('Error fetching lead:', error);
      setNotesError(error.message);
    } else if (data) {
      setLead(data as LinkedInLead);
      setNotes(data.notes || '');
    }
    setLoading(false);
  };

  const saveNotes = async () => {
    if (!lead) return;
    setSaving(true);
    setNotesError('');

    const { error } = await supabase
      .from('linkedin_leads')
      .update({ notes })
      .eq('id', lead.id);

    if (error) {
      setNotesError(error.message);
    } else {
      // Update local state
      setLead({ ...lead, notes });
    }
    setSaving(false);
  };

  const handleEmailClick = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleLinkedInClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">Lead not found</div>
        <button
          onClick={() => router.push('/dashboard/linkedin-leads')}
          className="text-blue-400 hover:text-blue-300"
        >
          Return to LinkedIn Leads
        </button>
      </div>
    );
  }

  const emailVerified = lead.email_status === 'verified';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/linkedin-leads')}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#27272a] rounded-lg transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-white">Lead Details</h1>
      </div>

      <div className="space-y-6">
        {/* Main Info */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{lead.lead_name || 'Untitled Contact'}</h2>
                {lead.title && (
                  <p className="text-gray-400 mt-1">{lead.title}</p>
                )}
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              lead.source === 'apollo_enrichment'
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-blue-500/20 text-blue-300'
            }`}>
              {lead.source?.replace('_', ' ') || 'Unknown'}
            </span>
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {lead.email && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-white">{lead.email}</span>
                    {lead.email_status === 'verified' && (
                      <CheckCircleIcon />
                    )}
                  </div>
                  <button
                    onClick={() => handleEmailClick(lead.email!)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-[#27272a] rounded transition"
                    title="Send email"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {lead.linkedin_url && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  LinkedIn Profile
                </label>
                <button
                  onClick={() => handleLinkedInClick(lead.linkedin_url!)}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-4 h-4" />
                  {lead.linkedin_url}
                </button>
              </div>
            )}

            {lead.place_id && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Place ID
                </label>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-300 font-mono text-sm">{lead.place_id}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Source
              </label>
              <span className="text-white">{lead.source?.replace('_', ' ') || 'Unknown'}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-6 pt-4 border-t border-[#27272a]">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Added: {new Date(lead.created_at).toLocaleString()}
              </span>
              {lead.updated_at !== lead.created_at && (
                <>
                  <span className="text-gray-600">·</span>
                  <span>
                    Updated: {new Date(lead.updated_at).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
          <label className="block text-sm font-medium text-white mb-2">
            Notes
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Add notes about this lead - your observations, follow-up plans, or any context.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
            placeholder="Enter your notes here..."
          />
          {notesError && (
            <p className="mt-2 text-sm text-red-400">{notesError}</p>
          )}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={saveNotes}
              disabled={saving || notes === lead.notes}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg text-sm transition disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Notes
                </>
              )}
            </button>
            {notes !== lead.notes && (
              <span className="text-xs text-gray-500">Unsaved changes</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}