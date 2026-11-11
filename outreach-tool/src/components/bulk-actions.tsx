'use client';

import { useState } from 'react';
import { UserPlus, X, Trash2 } from 'lucide-react';
import { Profile } from '@/lib/types';

interface BulkActionsProps {
  selectedCount: number;
  selectedIds: string[];
  onAssign: (userId: string, notes: string, quantity?: number) => Promise<void>;
  onClear: () => void;
  onArchive: () => Promise<void>;
  profiles: Profile[];
  assignLimits?: Record<string, { max_leads: number; current_leads: number }>;
}

export default function BulkActions({
  selectedCount,
  selectedIds,
  onAssign,
  onClear,
  onArchive,
  profiles,
  assignLimits,
}: BulkActionsProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignNotes, setAssignNotes] = useState('');
  const [assignQuantity, setAssignQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAssign = async (userId: string) => {
    if (!userId) return;
    setSubmitting(true);
    const quantity = assignQuantity ? parseInt(assignQuantity, 10) : undefined;
    await onAssign(userId, assignNotes, quantity);
    setSubmitting(false);
    setShowAssignModal(false);
    setAssignNotes('');
    setAssignQuantity('');
  };

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Bulk action toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-3 shadow-lg shadow-black/30">
          <span className="text-sm text-muted">
            <span className="font-medium text-foreground">{selectedCount}</span> selected
          </span>

          <div className="w-px h-5 bg-card" />

          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-primary hover:bg-primary rounded-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            Assign
          </button>

          <button
            onClick={onArchive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
            Archive
          </button>

          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:bg-card rounded-lg transition"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Assign {selectedCount} lead{selectedCount !== 1 ? 's' : ''}
            </h3>

            <div className="space-y-3">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleAssign(profile.id)}
                  disabled={submitting}
                  className="w-full flex items-center gap-3 p-3 text-left bg-card hover:bg-[#333336] rounded-lg transition disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-foreground">
                    {profile.full_name?.charAt(0) || profile.email?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile.full_name || profile.email}
                  </p>
                  <p className="text-xs text-muted capitalize">{profile.role}</p>
                  {assignLimits && assignLimits[profile.id] && assignLimits[profile.id].max_leads > 0 && (
                    <p className="text-xs text-muted mt-0.5">
                      {assignLimits[profile.id].current_leads}/{assignLimits[profile.id].max_leads} leads
                    </p>
                  )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                How many? (leave empty for all)
              </label>
              <input
                type="number"
                value={assignQuantity}
                onChange={(e) => setAssignQuantity(e.target.value)}
                placeholder="e.g. 50"
                min="1"
                max={selectedCount}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Notes (optional)
              </label>
              <textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Add a note about this assignment..."
                rows={2}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-card rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
