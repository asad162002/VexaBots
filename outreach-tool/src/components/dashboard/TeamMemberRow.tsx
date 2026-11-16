import { useState } from 'react';
import { type Profile } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';

type ProfileWithPhone = Profile & { phone_number?: string | null };

interface TelnyxNumber {
  id: string;
  phone_number: string;
  country?: string;
}

export interface TelnyxCredential {
  id: string;
  name: string;
  status: string;
  connectionId: string | null;
  sipUsername: string | null;
}

interface TeamMemberRowProps {
  profile: ProfileWithPhone;
  isAdmin: boolean;
  currentUserId: string | undefined;
  onRemove: (id: string, email: string) => void;
  removingId: string | null;
  telnyxNumbers: TelnyxNumber[];
  numbersLoading: boolean;
  telnyxCredentials: TelnyxCredential[];
  credentialsLoading: boolean;
  onCallerIdChange: (profileId: string, callerId: string | null) => void;
  onCredentialChange: (profileId: string, credentialId: string | null) => void;
}

export default function TeamMemberRow({
  profile,
  isAdmin,
  currentUserId,
  onRemove,
  removingId,
  telnyxNumbers,
  numbersLoading,
  telnyxCredentials,
  credentialsLoading,
  onCallerIdChange,
  onCredentialChange,
}: TeamMemberRowProps) {
  const [savingCallerId, setSavingCallerId] = useState(false);
  const [callerIdError, setCallerIdError] = useState('');
  const [savingCredential, setSavingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState('');

  const saveCallerId = async (callerId: string | null) => {
    if (profile.id === currentUserId) return;
    setSavingCallerId(true);
    setCallerIdError('');
    const { error } = await supabase
      .from('profiles')
      .update({ caller_id_number: callerId || null })
      .eq('id', profile.id);
    if (error) {
      setCallerIdError(error.message);
    } else {
      setCallerIdError('Saved!');
      setTimeout(() => setCallerIdError(''), 2000);
      // Update local state so the dropdown reflects the change immediately
      onCallerIdChange(profile.id, callerId);
    }
    setSavingCallerId(false);
  };

  // The credential decides whether /api/telnyx/token will mint a WebRTC JWT at
  // all, so it is assigned here rather than written straight from the client.
  const saveCredential = async (credentialId: string | null) => {
    if (profile.id === currentUserId) return;
    setSavingCredential(true);
    setCredentialError('');

    const res = await authFetch('/api/telnyx/assign-credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profile.id, credentialId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setCredentialError(data.error || 'Could not save the credential.');
    } else {
      setCredentialError('Saved!');
      setTimeout(() => setCredentialError(''), 2000);
      onCredentialChange(profile.id, credentialId);
    }

    setSavingCredential(false);
  };

  return (
    <div className="flex items-center justify-between bg-card hover:bg-[#2a2a32] rounded-xl px-4 py-3.5 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0 ${
          profile.role === 'admin' ? 'bg-purple-600' : 'bg-card'
        }`}>
          {profile.email?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-foreground font-medium truncate">{profile.email}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              profile.role === 'admin'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-background0/20 text-muted border border-border/30'
            }`}>
              {profile.role === 'admin' ? 'Admin' : 'Member'}
            </span>
            {profile.id === currentUserId && (
              <span className="text-xs text-muted">(you)</span>
            )}
          </div>
          {isAdmin && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Caller-ID Number
              </label>
              {numbersLoading ? (
                <div className="text-xs text-muted">Loading numbers...</div>
              ) : (
                <>
                  <select
                    value={profile.caller_id_number ?? ''}
                    onChange={(e) => saveCallerId(e.target.value || null)}
                    disabled={savingCallerId}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">No caller-ID assigned</option>
                    {telnyxNumbers.map((num) => (
                      <option key={num.id} value={num.phone_number}>
                        {num.phone_number}{num.country ? ` (${num.country})` : ''}
                      </option>
                    ))}
                  </select>
                  {callerIdError && <p className="text-xs mt-1 text-green-400">{callerIdError}</p>}
                </>
              )}
            </div>
          )}

          {/* Telnyx credential: without one, token minting is refused and the
              member cannot place a call at all. */}
          {isAdmin && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Telnyx Credential
              </label>
              {credentialsLoading ? (
                <div className="text-xs text-muted">Loading credentials...</div>
              ) : (
                <>
                  <select
                    value={profile.telnyx_credential_id ?? ''}
                    onChange={(e) => saveCredential(e.target.value || null)}
                    disabled={savingCredential}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">No credential (cannot call)</option>
                    {telnyxCredentials.map((cred) => (
                      <option key={cred.id} value={cred.id}>
                        {cred.name}{cred.status !== 'active' ? ` (${cred.status})` : ''}
                      </option>
                    ))}
                  </select>
                  {!profile.telnyx_credential_id && telnyxCredentials.length > 0 && (
                    <p className="text-xs mt-1 text-yellow-400">
                      No credential assigned, this member cannot make calls.
                    </p>
                  )}
                  {credentialError && (
                    <p className={`text-xs mt-1 ${credentialError === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>
                      {credentialError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isAdmin && profile.id !== currentUserId && (
        <button
          onClick={() => onRemove(profile.id, profile.email || '')}
          disabled={removingId === profile.id}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {removingId === profile.id ? 'Removing...' : 'Remove'}
        </button>
      )}
    </div>
  );
}
