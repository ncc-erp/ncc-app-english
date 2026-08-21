'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, ShieldCheck, Sparkles, AlertCircle, ArrowRight, UserCheck, Lock, User, Loader2 } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const oauthErrorMessages: Record<string, string> = {
    no_code: 'Authentication cancelled or missing authorization code from Mezon.',
    state_mismatch: 'Security warning: OAuth state mismatch detected. Please try logging in again.',
    no_token: 'Failed to retrieve access token from Mezon server.',
    auth_failed: 'Authentication failed. Please verify your credentials or try again later.',
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!username || !password) {
      setFormError('Please enter username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Redirect to home page on successful login
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Password login error:', err);
      setFormError('Server connection error. Please try again later.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-violet-600/15 blur-[100px] rounded-full pointer-events-none" />

      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full p-8 text-center space-y-6 relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-500/20">
          <BookOpen className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mezon IELTS Platform</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Account Authentication</h1>
          <p className="text-slate-400 text-sm">
            {showPasswordForm
              ? 'Enter your username and password to sign in.'
              : 'Sign in with your Mezon account or Admin account to access the system.'}
          </p>
        </div>

        {/* OAuth Error Alert */}
        {oauthError && !showPasswordForm && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{oauthErrorMessages[oauthError] || 'An error occurred during OAuth authentication.'}</span>
          </div>
        )}

        {!showPasswordForm ? (
          /* Primary Login Selection Mode */
          <div className="space-y-3 pt-2">
            <a
              href="/api/auth/login"
              className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Login with Mezon OAuth2</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center space-x-2 border border-slate-700/50 transition-all"
            >
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>Sign in with Username / Password</span>
            </button>
          </div>
        ) : (
          /* Username / Password Form Mode */
          <form onSubmit={handlePasswordLogin} className="space-y-4 pt-1 text-left">
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username (e.g. admin)"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setFormError('');
                }}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
              >
                ← Back to login options
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-center space-x-2 text-xs font-medium text-slate-400 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Secure Authentication • Encrypted HTTP-Only Cookie</span>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <Link href="/" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          Loading login page...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}


