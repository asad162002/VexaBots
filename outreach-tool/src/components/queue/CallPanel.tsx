'use client';

import { useState } from 'react';
import { type Lead } from '@/lib/types';
import CallDialer from '@/components/CallDialer';
import CalComModal from '@/components/leads/CalComModal';
import { Calendar } from 'lucide-react';

interface CallPanelProps {
  lead: Lead;
  onMeetingBooked?: (booking: {
    date: string;
    time: string;
    timezone: string;
    link: string;
  }) => void;
  onCallEnd?: () => void;
}

export default function CallPanel({ lead, onMeetingBooked, onCallEnd }: CallPanelProps) {
  const [showCal, setShowCal] = useState(false);

  if (!lead.phone) {
    return (
      <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3">
        <p className="text-sm text-gray-500">This lead has no phone number.</p>
      </div>
    );
  }

  const hasCalConfig = !!process.env.NEXT_PUBLIC_CALCOM_USERNAME;

  return (
    <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Phone dialer
      </h2>
      <CallDialer
        lead={{
          id: lead.id,
          phone: lead.phone,
          country_code: lead.country_code || null,
          owner_name: lead.owner_name || null,
        }}
        onCallEnd={onCallEnd}
      />

      {hasCalConfig && !lead.meeting_link && (
        <button
          onClick={() => setShowCal(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d4] active:bg-[#8b3bff] text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
        >
          <Calendar className="w-4 h-4" />
          Book Meeting
        </button>
      )}

      {lead.meeting_link && (
        <div className="mt-3">
          <a
            href={lead.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 break-all"
          >
            {lead.meeting_link}
          </a>
        </div>
      )}

      <CalComModal
        lead={lead}
        show={showCal}
        onClose={() => setShowCal(false)}
        onBooked={onMeetingBooked}
      />
    </div>
  );
}
