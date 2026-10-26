'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  phone_number: string | null;
  caller_id_number: string | null;
  avatar_url: string | null;
  telnyx_credential_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  callerNumber: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  isAdmin: false,
  callerNumber: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [callerNumber, setCallerNumber] = useState<string | null>(null);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, phone_number, caller_id_number, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
      setIsAdmin(data.role === 'admin');
      setCallerNumber(data.caller_id_number);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    timeoutId = setTimeout(finish, 4000);

    const init = async () => {
      try {
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          try {
            await loadProfile(sess.user.id);
          } catch {
            // ignore profile failure
          }
        } else {
          setProfile(null);
          setIsAdmin(false);
          setCallerNumber(null);
        }
      } catch {
        // ignore auth init failure
      } finally {
        clearTimeout(timeoutId);
        finish();
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          try {
            await loadProfile(sess.user.id);
          } catch {
            // ignore
          }
        } else {
          setProfile(null);
          setIsAdmin(false);
          setCallerNumber(null);
        }
        finish();
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsAdmin(false);
    setCallerNumber(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isAdmin, callerNumber, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
