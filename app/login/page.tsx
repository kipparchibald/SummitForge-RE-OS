'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/auth/browser';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('');
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus(error.message);
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch {
      setStatus('Sign-in failed. Is Supabase configured?');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email) {
      setStatus('Enter your email first, then request a magic link.');
      return;
    }
    setIsLoading(true);
    setStatus('');
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
      });
      setStatus(error ? error.message : `Magic link sent to ${email} — check your inbox.`);
    } catch {
      setStatus('Could not send magic link. Is Supabase configured?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-semibold text-3xl tracking-tight" style={{ color: 'var(--primary)' }} data-company-name>
            SummitForge
          </div>
          <div className="text-sm text-gray-500 mt-1" data-tagline>RE OS • Jefferson County / Eastern Idaho</div>
        </div>

        <form onSubmit={signInWithPassword} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="you@archibaldbagley.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={sendMagicLink}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Email me a magic link instead
          </button>

          {status && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{status}</p>}
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">
          Accounts are provisioned by your broker. Contact Archibald-Bagley for access.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
