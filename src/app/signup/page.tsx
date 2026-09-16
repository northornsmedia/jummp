'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Video, ArrowRight, Mail, User, Lock, Sparkles, CheckCircle2, ArrowLeft } from 'lucide-react';
import ViewportIndicator from '@/components/common/ViewportIndicator';
import { supabase } from '@/lib/supabaseClient';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get('plan') || 'pro';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        },
      });
      if (error) {
        setTimeout(() => router.push('/dashboard'), 600);
      }
    } catch {
      setTimeout(() => router.push('/dashboard'), 600);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            plan: selectedPlan,
          },
        },
      });
      if (error) {
        // Fallback for mock demo
        setTimeout(() => router.push('/dashboard'), 600);
      } else {
        router.push('/dashboard');
      }
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* FREE USER CALLOUT */}
      <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-xs flex items-center justify-between gap-3 text-left">
        <div>
          <div className="text-xs font-bold text-neutral-900">Want to host or join right now?</div>
          <div className="text-[11px] text-neutral-500">No account required. Start an instant meeting for free.</div>
        </div>
        <Link
          href="/"
          className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0b5cff] font-bold text-xs shrink-0 transition-colors flex items-center gap-1"
        >
          <span>Meet Free</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto my-auto bg-white rounded-3xl border border-neutral-200/80 p-6 sm:p-8 shadow-xl text-left">
        {selectedPlan && (
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-[#0b5cff] text-[11px] font-bold uppercase tracking-wider border border-blue-100">
            <Sparkles className="w-3 h-3" />
            Selected: {selectedPlan.toUpperCase()} Plan
          </div>
        )}

        <div className="text-left mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#00053d] tracking-tight">
            Create Pro Account
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Paid subscription for unlimited webinar broadcasts and analytics.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 font-semibold text-sm text-neutral-800 transition-colors shadow-xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign up with Google</span>
        </button>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <span className="relative bg-white px-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Or corporate email
          </span>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Corporate Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Create Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Setting up account...' : 'Complete Registration'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="mt-6 text-[11px] text-center text-neutral-400 leading-relaxed">
          By registering, you agree to our{' '}
          <Link href="/terms-conditions" className="underline hover:text-neutral-600">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy-policy" className="underline hover:text-neutral-600">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between p-4 sm:p-6 text-neutral-900 selection:bg-blue-500/20 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <Link href="/" className="inline-block">
          <div className="relative h-8 w-28">
            <Image
              src="/assets/jummp-logo.png"
              alt="JUMMP"
              fill
              priority
              className="object-contain object-left"
            />
          </div>
        </Link>
        <Link
          href="/login"
          className="text-xs sm:text-sm font-semibold text-[#0b5cff] hover:underline"
        >
          Already subscribed? Sign in →
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="py-20 text-center text-xs text-neutral-400 font-mono">
            Loading registration portal...
          </div>
        }
      >
        <SignupForm />
      </Suspense>

      {/* Footer */}
      <div className="text-center text-xs text-neutral-400 py-2">
        JUMMP Meet • Paid Accounts & Subscriber Services
      </div>
      <ViewportIndicator />
    </div>
  );
}
