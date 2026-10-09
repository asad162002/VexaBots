'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import Spinner from '@/components/ui/spinner';
import { Users, Shield, Mail, Trash2, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignLimits, setAssignLimits] = useState<Record<string, { max_leads: number; current_leads: number }>>({});
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');

  useEffect(() => {
    fetchProfiles();
    fetchLimits();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching profiles:', error);
    } else {
      setProfiles(data ?? []);
    }
    setLoading(false);
  };

  const fetchLimits = async () => {
    setLimitsLoading(true);
    const { data, error } = await supabase
      .from('assignment_limits')
      .select('profile_id, max_leads, current_leads');

    if (error) {
      console.error('Error fetching limits:', error);
    } else {
      const limitMap: Record<string, { max_leads: number; current_leads: number }> = {};
      (data ?? []).forEach((l: any) => {
        limitMap[l.profile_id] = {
          max_leads: l.max_leads,
          current_leads: l.current_leads,
        };
      });
      setAssignLimits(limitMap);
    }
    setLimitsLoading(false);
  };

  const updateLimit = async (profileId: string, maxLeads: number) => {
    const { error } = await supabase
      .from('assignment_limits')
      .upsert({
        profile_id: profileId,
        max_leads: maxLeads,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error updating limit:', error);
      alert('Failed to update limit.');
    } else {
      setAssignLimits(prev => ({
        ...prev,
        [profileId]: { ...prev[profileId], max_leads: maxLeads },
      }));
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(data.error || 'Failed to send invitation');
      setInviting(false);
      return;
    }

    setInviteSuccess(data.message);
    setInviteEmail('');
    setInviteName('');
    setInviting(false);
    fetchProfiles();
  };

  const handleRemove = async (profileId: string, email: string) => {
    if (!confirm(`Remove ${email} from the team? This cannot be undone.`)) return;

    setRemovingId(profileId);
    setRemoveError('');

    const { error } = await supabase.from('profiles').delete().eq('id', profileId);

    if (error) {
      setRemoveError(error.message);
      setRemovingId(null);
      return;
    }

    fetchProfiles();
  };

  const isAdmin = user?.email ? profiles.find(p => p.id === user.id)?.role === 'admin' : false;
  const currentUserProfile = profiles.find(p => p.id === user?.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your team and account settings.</p>
      </div>

      {/* Current User Card */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            {user?.email?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="text-white font-semibold">{user?.email}</h2>
            <p className="text-sm text-gray-400">
              {currentUserProfile?.role === 'admin' ? 'Admin' : 'Member'} · Joined {currentUserProfile?.created_at ? new Date(currentUserProfile.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
            <Shield className="w-4 h-4" />
            <span>You are an admin. You can manage team members.</span>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5 mb-5">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          Team Members
          <span className="text-sm font-normal text-gray-500 ml-2">({profiles.length})</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-gray-500">
              <Spinner size="md" />
              <span>Loading team members...</span>
            </div>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No team members yet.</p>
            <p className="text-gray-600 text-xs mt-1">Add members below to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between bg-[#27272a] rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                    {profile.email?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{profile.email}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        profile.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                      }`}>
                        {profile.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                      {profile.id === user?.id && (
                        <span className="text-xs text-gray-500">(you)</span>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && profile.id !== user?.id && (
                  <button
                    onClick={() => handleRemove(profile.id, profile.email || '')}
                    disabled={removingId === profile.id}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50 px-2 py-1 rounded hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {removingId === profile.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment Limits */}
      {isAdmin && (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5 mb-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            Assignment Limits
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Set maximum lead assignments per team member. Leave at 0 for no limit.
          </p>

          {limitsLoading ? (
            <div className="flex items-center gap-3 text-gray-500">
              <Spinner size="sm" />
              <span>Loading limits...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles
                .filter(p => p.role !== 'admin' || p.id === user?.id)
                .map((profile) => {
                  const limit = assignLimits[profile.id]?.max_leads ?? 0;
                  const current = assignLimits[profile.id]?.current_leads ?? 0;
                  return (
                    <div key={profile.id} className="bg-[#27272a] rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                            {profile.email?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">
                              {profile.email}
                              {profile.id === user?.id && ' (you)'}
                            </p>
                            {current > 0 && (
                              <p className="text-xs text-gray-500">
                                {current} assigned {limit > 0 && `of ${limit} max`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {limit > 0 && current > 0 && (
                            <div className="w-16 h-2 bg-[#3f3f46] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
                              />
                            </div>
                          )}
                          <input
                            type="number"
                            min="0"
                            value={limit}
                            onChange={(e) => updateLimit(profile.id, parseInt(e.target.value) || 0)}
                            className="w-20 bg-[#1a1a1a] border border-[#3f3f46] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Invite Member Form */}
      {isAdmin && (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-gray-400" />
            Invite Team Member
          </h2>

          {inviteError && (
            <div className="mb-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{inviteError}</p>
            </div>
          )}

          {inviteSuccess && (
            <div className="mb-3 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-400">{inviteSuccess}</p>
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Full Name (optional)
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="John Smith"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="member">Member (can view and update leads)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed"
            >
              {inviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-[#27272a]/50 rounded-lg">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">How it works:</strong> Sending an invitation creates the user in Supabase Auth and sends them a signup link.
              The user's profile is automatically created when they sign in for the first time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
