import { X } from 'lucide-react';
import { type Lead } from '@/lib/types';

interface CalComModalProps {
  lead: Lead;
  show: boolean;
  onClose: () => void;
  onBooked?: (booking: {
    date: string;
    time: string;
    timezone: string;
    link: string;
  }) => void;
}

export default function CalComModal({ lead, show, onClose, onBooked }: CalComModalProps) {
  if (!show) {
    return null;
  }

  const calUsername = process.env.NEXT_PUBLIC_CALCOM_USERNAME || 'demo';
  const calEventType = process.env.NEXT_PUBLIC_CALCOM_EVENT_TYPE || '30min';
  const prefillName = encodeURIComponent(lead.owner_name || '');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-secondary border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            {lead.meeting_link ? 'Meeting Details' : 'Book a Meeting'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {lead.meeting_link ? (
            <a
              href={lead.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent break-all"
            >
              {lead.meeting_link}
            </a>
          ) : (
            <iframe
              src={`https://cal.com/${calUsername}/${calEventType}?prefill[name]=${prefillName}`}
              title="Book Meeting"
              className="w-full h-[600px] border border-border rounded-lg"
              allowFullScreen
            />
          )}
        </div>
        {!lead.meeting_link && (
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted mb-3">
              Book a meeting with yourself, the client, and the cold caller via Cal.com.
              Set NEXT_PUBLIC_CALCOM_USERNAME and NEXT_PUBLIC_CALCOM_EVENT_TYPE in .env.local.
            </p>
            {onBooked && (
              <button
                onClick={() => {
                  const now = new Date();
                  onBooked({
                    date: now.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }),
                    time: now.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    link: `https://cal.com/${process.env.NEXT_PUBLIC_CALCOM_USERNAME || 'demo'}/${process.env.NEXT_PUBLIC_CALCOM_EVENT_TYPE || '30min'}`,
                  });
                }}
                className="w-full bg-green-600 hover:bg-green-500 text-foreground font-semibold rounded-lg px-4 py-2.5 text-sm transition mb-2"
              >
                Confirm booking made
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full bg-card hover:bg-muted text-foreground font-semibold rounded-lg px-4 py-2.5 text-sm transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
