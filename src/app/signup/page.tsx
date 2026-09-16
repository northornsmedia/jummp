'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Video,
  ArrowRight,
  Mail,
  User,
  Lock,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Star,
  Users,
  Check,
} from 'lucide-react';
import ViewportIndicator from '@/components/common/ViewportIndicator';
import { supabase } from '@/lib/supabaseClient';

const PLANS_CONFIG: Record<
  string,
  {
    name: string;
    priceMonthly: string;
    description: string;
    badge?: string;
    features: string[];
  }
> = {
  starter: {
    name: 'Starter',
    priceMonthly: '₹999',
    description: 'Perfect for solo creators & small interactive workshops.',
    features: [
      'Unlimited attendees per session',
      '1 active concurrent room',
      '1080p Full HD streaming',
      'Live chat, Q&A & polls',
    ],
  },
  pro: {
    name: 'Pro',
    priceMonthly: '₹1,999',
    description: 'For growing businesses running frequent, high-impact webinars.',
    badge: 'MOST POPULAR',
    features: [
      'Unlimited attendees (no seat caps)',
      'Unlimited concurrent webinar rooms',
      '1080p 60fps & 4K ultra-low latency',
      'Timed offer cards & ticket sales',
      'Real-time attendance & retention curves',
      'Cloud recording & browser backup',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 'Custom',
    description: 'Dedicated infrastructure, custom SLAs & white-label branding.',
    features: [
      '1M+ concurrent attendee support',
      'Dedicated media server clusters',
      'Custom white-label domain & SSL',
      'Dedicated account manager & 99.99% SLA',
    ],
  },
};

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get('plan') || 'pro').toLowerCase();
  const [selectedPlan, setSelectedPlan] = useState<string>(
    PLANS_CONFIG[initialPlan] ? initialPlan : 'pro'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const activePlanInfo = PLANS_CONFIG[selectedPlan] || PLANS_CONFIG.pro;

  // Calculate simple password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score; // 0 to 4
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ['Too weak', 'Weak', 'Good', 'Strong', 'Very strong'];
  const strengthColors = [
    'bg-slate-200',
    'bg-red-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-emerald-500',
  ];

  const handleGoogleSignup = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Google sign-up failed.');
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signUp({
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
        setErrorMsg(error.message);
      } else if (data.session) {
        router.push('/dashboard');
      } else {
        setErrorMsg('Check your email to confirm your account before signing in.');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* FREE INSTANT MEETING CALLOUT BANNER (Polished & Constrained) */}
      <div className="mb-8 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-white border border-blue-500/20 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0b5cff] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Want to host or join a meeting right now?</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                Free Forever
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              No account or credit card required. Launch an instant P2P session with one click.
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-95 text-white font-bold text-xs shrink-0 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <span>Meet Free</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* TWO-COLUMN SPLIT HERO & REGISTRATION CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* LEFT COLUMN: VALUE PROPOSITION & PLAN OVERVIEW */}
        <div className="lg:col-span-6 space-y-6 text-left">
          {/* Top Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#0b5cff] text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UNLIMITED WEBINAR BROADCASTING</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#00053d] tracking-tight leading-[1.15]">
            Scale your events with <span className="text-[#0b5cff]">zero seat caps</span>.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
            Stream to 50 or 500,000 attendees with flat pricing, ultra-low latency WebRTC, and zero required downloads for participants.
          </p>

          {/* Interactive Plan Selector Tabs */}
          <div className="p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 flex items-center gap-1">
            {(['starter', 'pro', 'enterprise'] as const).map((planKey) => {
              const plan = PLANS_CONFIG[planKey];
              const isSelected = selectedPlan === planKey;
              return (
                <button
                  key={planKey}
                  type="button"
                  onClick={() => setSelectedPlan(planKey)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-[#00053d] shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span>{plan.name}</span>
                  {plan.badge && (
                    <span className="hidden sm:inline text-[9px] px-1.5 py-0.2 bg-blue-100 text-[#0b5cff] rounded-md font-extrabold">
                      HOT
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Plan Feature Checklist */}
          <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-baseline justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Selected Plan
                </span>
                <div className="text-lg font-extrabold text-[#00053d] flex items-center gap-2">
                  <span>{activePlanInfo.name} Plan</span>
                  {activePlanInfo.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0b5cff] border border-blue-100">
                      {activePlanInfo.badge}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[#0b5cff]">
                  {activePlanInfo.priceMonthly}
                </span>
                {activePlanInfo.priceMonthly !== 'Custom' && (
                  <span className="text-xs text-slate-500 font-medium"> /month</span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600 italic">
              {activePlanInfo.description}
            </p>

            <ul className="space-y-2 pt-1">
              {activePlanInfo.features.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Proof & Security Badges */}
          <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 border-t border-slate-200/60">
            <div className="flex items-center gap-1 text-amber-500 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="ml-1 text-slate-700 font-semibold text-[11px]">4.9/5 Rating</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>256-bit TLS Encryption</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Instant Activation</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REGISTRATION FORM CARD */}
        <div className="lg:col-span-6 w-full">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-2xl shadow-blue-500/10 p-6 sm:p-8 text-left relative overflow-hidden transition-all">
            {/* Top Accent Gradient Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0b5cff] via-indigo-500 to-cyan-400" />

            {/* Selected Plan Tag & Trial Badge */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-[#0b5cff] text-[11px] font-bold uppercase tracking-wider border border-blue-100">
                <Sparkles className="w-3 h-3" />
                <span>Selected: {activePlanInfo.name} Plan</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                14-Day Free Trial
              </span>
            </div>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#00053d] tracking-tight">
                Create {activePlanInfo.name} Account
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Join over 10,000+ teams streaming high-impact webinars on JUMMP.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in fade-in">
                {errorMsg}
              </div>
            )}

            {/* 1-Click Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 active:scale-99 font-semibold text-sm text-slate-800 transition-all shadow-xs"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

            {/* Elegant Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Or corporate email
              </span>
            </div>

            {/* Email Registration Form */}
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Create Password
                  </label>
                  {password && (
                    <span className="text-[10px] font-bold text-slate-500">
                      {strengthLabels[strength]}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Live Password Strength Meter */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`rounded-full transition-colors duration-300 ${
                            strength >= step ? strengthColors[strength] : 'bg-slate-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Setting up your account...</span>
                  </div>
                ) : (
                  <>
                    <span>Complete Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-[11px] text-center text-slate-400 leading-relaxed">
              By registering, you agree to our{' '}
              <Link href="/terms-conditions" className="text-slate-600 underline hover:text-[#0b5cff]">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="text-slate-600 underline hover:text-[#0b5cff]">
                Privacy Policy
              </Link>
              . No credit card required to start.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#fafcff] flex flex-col justify-between p-4 sm:p-6 lg:p-8 text-slate-900 selection:bg-blue-500/20 font-sans relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0b5cff08_1px,transparent_1px),linear-gradient(to_bottom,#0b5cff08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between pb-4">
        <Link href="/" className="inline-block transition-opacity hover:opacity-80">
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:inline">Already have an account?</span>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0b5cff] font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow-sm flex items-center gap-1.5"
          >
            <span>Sign in</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full my-auto py-6 sm:py-10">
        <Suspense
          fallback={
            <div className="py-24 text-center text-xs text-slate-400 font-mono">
              Loading registration portal...
            </div>
          }
        >
          <SignupContent />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full pt-6 pb-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div>JUMMP Meet • Paid Accounts & Subscriber Services</div>
        <div className="flex items-center gap-4 text-slate-500">
          <Link href="/terms-conditions" className="hover:text-slate-800">
            Terms
          </Link>
          <span>•</span>
          <Link href="/privacy-policy" className="hover:text-slate-800">
            Privacy
          </Link>
          <span>•</span>
          <Link href="/pricing" className="hover:text-[#0b5cff] font-semibold">
            View All Plans
          </Link>
        </div>
      </footer>

      <ViewportIndicator />
    </div>
  );
}
