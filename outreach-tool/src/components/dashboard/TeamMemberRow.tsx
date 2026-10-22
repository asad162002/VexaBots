import { useState } from 'react';
import { type Profile } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ProfileWithPhone = Profile & { phone_number?: string | null };

interface TeamMemberRowProps {
  profile: ProfileWithPhone;
  isAdmin: boolean;
  currentUserId: string | undefined;
  onRemove: (id: string, email: string) => void;
  removingId: string | null;
}

export default function TeamMemberRow({ profile, isAdmin, currentUserId, onRemove, removingId }: TeamMemberRowProps) {
  const [phoneInput, setPhoneInput] = useState(profile.phone_number || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const savePhoneNumber = async () => {
    if (!phoneInput.trim()) return;
    setSavingPhone(true);
    setPhoneError('');
    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: phoneInput.trim() })
      .eq('id', profile.id);
    if (error) {
      setPhoneError(error.message);
    } else {
      setPhoneError('Saved!');
      setTimeout(() => setPhoneError(''), 2000);
    }
    setSavingPhone(false);
  };

  return (
    <div className="flex items-center justify-between bg-[#27272a] hover:bg-[#2a2a32] rounded-xl px-4 py-3.5 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
          profile.role === 'admin' ? 'bg-purple-600' : 'bg-gray-700'
        }`}>
          {profile.email?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate">{profile.email}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              profile.role === 'admin'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
            }`}>
              {profile.role === 'admin' ? 'Admin' : 'Member'}
            </span>
            {profile.id === currentUserId && (
              <span className="text-xs text-gray-500">(you)</span>
            )}
          </div>
          {isAdmin && (
            <div className="mt-2">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onBlur={savePhoneNumber}
                disabled={savingPhone}
                placeholder="+1XXXXXXXXXX"
                className="w-full bg-[#1a1a1a] border border-[#3f3f46] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {phoneError && <p className="text-xs mt-1 text-green-400">{phoneError}</p>}
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
