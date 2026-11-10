'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#08090a" }}>
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: "rgba(94,106,210,0.15)", border: "1px solid rgba(94,106,210,0.3)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#7170ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 className="text-2xl font-medium" style={{ color: "#f7f8f8", letterSpacing: "-0.02em" }}>Vexabots</h1>
          <p className="text-sm mt-1" style={{ color: "#8a8f98" }}>Outreach Tool</p>
        </div>

        <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-base font-medium mb-5 text-center" style={{ color: "#f7f8f8" }}>Sign in to your account</h2>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8a8f98" }}>Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-muted focus:outline-none transition"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#f7f8f8" }}
                placeholder="you@company.com" required />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#8a8f98" }}>Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-muted focus:outline-none transition"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: "#f7f8f8" }}
                placeholder="Enter your password" required />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full font-medium rounded-lg px-4 py-2.5 text-sm transition disabled:opacity-50"
              style={{ background: "#5e6ad2", color: "#ffffff" }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#62666d" }}>Vexabots AI Automation Agency</p>
      </div>
    </div>
  );
}
