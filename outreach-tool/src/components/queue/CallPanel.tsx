'use client';

import { type Lead } from '@/lib/types';
import CallDialer from '@/components/CallDialer';
import CalComModal from '@/components/leads/CalComModal';

interface CallPanelProps {
  lead: Lead;
}

export default function CallPanel({ lead }: CallPanelProps) {
  if (!lead.phone) {
    return (
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
        <p className="text-sm text-gray-400">This lead has no phone number.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Phone dialer
      </h2>
      <CallDialer
        lead={{
          id: lead.id,
          phone: lead.phone,
          country_code: lead.country_code || null,
          owner_name: lead.owner_name || null,
        }}
      />
      <div className="mt-4">
        <CalComModal
          lead={lead}
          show={!!lead.meeting_link || !!process.env.NEXT_PUBLIC_CALCOM_USERNAME}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}
