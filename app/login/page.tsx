'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookOpen, ShieldCheck, Sparkles, AlertCircle, ArrowRight, Code } from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    no_code: 'Authentication cancelled or missing authorization code from Mezon.',
    state_mismatch: 'Security warning: OAuth state mismatch detected. Please try logging in again.',
    no_token: 'Failed to retrieve access token from Mezon server.',
    auth_failed: 'Authentication failed. Please verify your credentials or try again later.',
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
            <span>Mezon OAuth2 Auth</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Mezon IELTS Platform</h1>
          <p className="text-slate-400 text-sm">
            Sign in with your Mezon account to access AI-powered IELTS Speaking evaluations.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start space-x-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessages[error] || 'An unexpected error occurred during authentication.'}</span>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <a
            href="/api/auth/login"
            className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Login with Mezon</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href="/api/auth/login?mock=true"
            className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center space-x-2 border border-slate-700/50 transition-all"
          >
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dev Mock Login (Local Test)</span>
          </a>
        </div>

        <div className="flex items-center justify-center space-x-2 text-xs font-medium text-slate-400 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>OAuth2 Standard Authorization Code Flow</span>
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
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Loading Mezon Login...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

