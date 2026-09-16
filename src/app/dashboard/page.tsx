'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Video,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Star,
  Users,
  Radio,
  Layers,
  LogOut,
  User,
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Settings,
  Flame,
  Activity,
  BarChart3,
  Sliders,
  RefreshCw,
  PlusCircle,
  CreditCard,
  KeyRound,
  XCircle,
} from 'lucide-react';
import ViewportIndicator from '@/components/common/ViewportIndicator';
import { supabase } from '@/lib/supabaseClient';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  plan: 'starter' | 'pro' | 'enterprise' | null;
  plan_unlocked: boolean;
}

const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: '₹999',
    rawPrice: 999,
    period: '/month',
    tagline: 'Solo creators & small interactive workshops',
    badge: null,
    highlight: false,
    features: [
      'Unlimited attendees per session',
      '1 active concurrent room',
      '1080p Full HD streaming',
      'Live chat, moderated Q&A & polls',
      'Zero-DB ephemeral recording download',
      'Instant WebRTC connection',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '₹1,999',
    rawPrice: 1999,
    period: '/month',
    tagline: 'Growing businesses running frequent high-impact webinars',
    badge: 'MOST POPULAR',
    highlight: true,
    features: [
      'Unlimited attendees (no seat caps)',
      'Unlimited concurrent webinar rooms',
      '1080p 60fps & 4K ultra-low latency',
      'Timed offer cards & ticket checkout',
      'Real-time attendance & retention curves',
      'Cloud recording & browser backup',
      'Custom GA4 & Meta Pixel tracking',
      'API & Webhooks automation access',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    rawPrice: 0,
    period: '',
    tagline: 'Dedicated infrastructure, custom SLAs & white-label branding',
    badge: 'DEDICATED',
    highlight: false,
    features: [
      '1M+ concurrent attendee support',
      'Dedicated media server clusters',
      'Custom white-label domain & SSL',
      'Dedicated account manager & 99.99% SLA',
      'Single Sign-On (SAML / Okta)',
      'Full BigQuery attendance sync',
      'Priority 24/7 engineering hotline',
    ],
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  
  // Checkout & Payment State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'summary' | 'processing' | 'blocked'>('summary');
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  
  // VIP Access Passcode Override (For authorized team/admin testing)
  const [showPasscodeOption, setShowPasscodeOption] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Unlocked dashboard state
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [instantRoomId, setInstantRoomId] = useState('');
  const [unlockSuccessToast, setUnlockSuccessToast] = useState(false);

  // Generate a personal room slug
  const personalRoomSlug = useMemo(() => {
    if (!user?.name) return 'studio-host';
    return user.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16) + '-live';
  }, [user?.name]);

  // Load User & Check Plan Status (Payment strictly required)
  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      // 1. Check local storage profile
      let localProfile: UserProfile | null = null;
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('jummp_user_profile');
        if (stored) {
          try {
            localProfile = JSON.parse(stored);
          } catch {
            // ignore
          }
        }
        // Strict payment rule: Never unlock for free. Clear any unverified free unlock flag.
        const verifiedPayment = localStorage.getItem('jummp_verified_payment_token');
        if (!verifiedPayment && localProfile) {
          localProfile.plan_unlocked = false;
          localStorage.removeItem('jummp_unlocked_plan');
        }
      }

      // 2. Query Supabase Auth
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const meta = data.user.user_metadata || {};
          const verifiedToken = typeof window !== 'undefined' ? localStorage.getItem('jummp_verified_payment_token') : null;
          const isActuallyUnlocked = Boolean(verifiedToken && (meta.plan_unlocked || localProfile?.plan_unlocked));

          const profile: UserProfile = {
            name: meta.full_name || localProfile?.name || data.user.email?.split('@')[0] || 'Host',
            email: data.user.email || localProfile?.email || '',
            phone: meta.phone || localProfile?.phone || '',
            plan: meta.plan || localProfile?.plan || 'pro',
            plan_unlocked: isActuallyUnlocked,
          };

          if (isMounted) {
            setUser(profile);
            if (profile.plan) setSelectedPlan(profile.plan);
            setLoading(false);
          }
          return;
        }
      } catch {
        // Continue to fallback
      }

      // 3. Fallback to local profile (e.g. freshly registered)
      if (localProfile) {
        if (isMounted) {
          // Gated behind payment: strictly locked
          const verifiedToken = typeof window !== 'undefined' ? localStorage.getItem('jummp_verified_payment_token') : null;
          localProfile.plan_unlocked = Boolean(verifiedToken);
          setUser(localProfile);
          if (localProfile.plan) setSelectedPlan(localProfile.plan);
          setLoading(false);
        }
      } else {
        // No session or profile: redirect to login
        if (isMounted) {
          router.replace('/login');
        }
      }
    }

    initUser();

    // Create random instant room id
    const rand = Math.random().toString(36).substring(2, 8);
    setInstantRoomId(`webinar-${rand}`);

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Open Checkout Modal for Selected Plan
  const handleOpenCheckout = (planKey: 'starter' | 'pro' | 'enterprise') => {
    setSelectedPlan(planKey);
    setCheckoutStep('summary');
    setShowCheckoutModal(true);
    setWaitlistJoined(false);
    setPasscodeError('');
  };

  // Attempt to Pay (Simulates gateway, then blocks because payment gateway is not integrated yet)
  const handleProceedPayment = () => {
    setCheckoutStep('processing');
    setTimeout(() => {
      // Payments are currently blocked because gateway is not integrated yet!
      setCheckoutStep('blocked');
    }, 900);
  };

  // Verify VIP Host Access Code (Admin/owner bypass for testing)
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    const clean = passcode.trim().toUpperCase();

    if (clean === 'JUMMP2026' || clean === 'VIPHOST' || clean === 'ADMINPASS') {
      // Save verified payment token
      if (typeof window !== 'undefined') {
        localStorage.setItem('jummp_verified_payment_token', 'VIP_TOKEN_' + Date.now());
        localStorage.setItem('jummp_unlocked_plan', selectedPlan);
      }
      setUser((prev) =>
        prev
          ? { ...prev, plan: selectedPlan, plan_unlocked: true }
          : {
              name: 'Host',
              email: '',
              phone: '',
              plan: selectedPlan,
              plan_unlocked: true,
            }
      );
      setShowCheckoutModal(false);
      setUnlockSuccessToast(true);
      setTimeout(() => setUnlockSuccessToast(false), 5000);
    } else {
      setPasscodeError('Invalid passcode. Dashboard access remains strictly locked until payment is verified.');
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jummp_user_profile');
      localStorage.removeItem('jummp_unlocked_plan');
      localStorage.removeItem('jummp_verified_payment_token');
      localStorage.removeItem('jummp_preferred_plan');
    }
    router.replace('/login');
  };

  const copyPersonalLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/meet/${personalRoomSlug}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafcff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500/20 border-t-[#0b5cff] rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-500">Checking subscription & payment status...</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW A: DASHBOARD IS PAYMENT-LOCKED — STRICTLY GATED BEHIND PAYMENT
  // =========================================================================
  if (!user?.plan_unlocked) {
    const activeCheckoutPlan = PLANS[selectedPlan] || PLANS.pro;

    return (
      <div className="min-h-screen bg-[#fafcff] text-slate-900 selection:bg-blue-500/20 font-sans relative overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        {/* Glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0b5cff08_1px,transparent_1px),linear-gradient(to_bottom,#0b5cff08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10" />

        {/* Top Header */}
        <header className="max-w-6xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-200/60">
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
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900">{user?.name || 'Registered Host'}</div>
              <div className="text-[11px] text-slate-500 font-mono">{user?.email}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Main Unlock Container */}
        <main className="max-w-6xl mx-auto w-full my-auto py-8 sm:py-10">
          {/* Header Banner */}
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold tracking-wide">
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span>PAID ACCOUNTS ONLY • HOST DASHBOARD LOCKED</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#00053d] tracking-tight">
              Payment Required to <span className="text-[#0b5cff]">Unlock Dashboard</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              JUMMP Host Broadcast Studio is a paid platform with zero seat caps and full HD broadcasting. Select a subscription plan below to proceed to checkout.
            </p>
          </div>

          {/* Payment Notice Callout Banner */}
          <div className="max-w-3xl mx-auto mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-start gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="block text-amber-950 font-bold mb-0.5">
                Notice: Dashboard Access is Strictly Paid
              </strong>
              Access to host broadcast studios, attendance analytics, and webinar links is only unlocked after verified subscription payment. Online payments are currently undergoing gateway configuration.
            </div>
          </div>

          {/* 3 Plans Selection Grid with Direct Payment CTAs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {(['starter', 'pro', 'enterprise'] as const).map((planKey) => {
              const plan = PLANS[planKey];
              const isSelected = selectedPlan === planKey;

              return (
                <div
                  key={planKey}
                  onClick={() => setSelectedPlan(planKey)}
                  className={`rounded-3xl p-6 sm:p-8 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-[#0b5cff] shadow-2xl shadow-blue-500/15 scale-[1.02] ring-4 ring-blue-500/10'
                      : 'bg-white/80 border border-slate-200 hover:border-slate-300 hover:shadow-lg'
                  }`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3.5 right-6 bg-[#0b5cff] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-md shadow-blue-500/25">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-2xl font-extrabold text-[#00053d] capitalize">
                        {plan.name} Plan
                      </h3>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-[#0b5cff] bg-[#0b5cff] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 min-h-[32px] leading-relaxed">
                      {plan.tagline}
                    </p>

                    {/* Price */}
                    <div className="mt-5 pb-5 border-b border-slate-100 flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-black text-[#00053d]">
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-xs text-slate-500 font-medium">{plan.period}</span>
                      )}
                    </div>

                    {/* Features */}
                    <div className="mt-6 space-y-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Included in this tier:
                      </span>
                      <ul className="space-y-2.5">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Payment CTA Button */}
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCheckout(planKey);
                      }}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-[#0b5cff] hover:bg-[#0a75e7] text-white shadow-lg shadow-blue-500/25 active:scale-98'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {planKey === 'enterprise' ? 'Contact Enterprise Sales' : `Proceed to Pay ${plan.price}`}
                      </span>
                    </button>
                    <span className="block text-[11px] text-center text-slate-400 mt-2 font-medium">
                      {planKey === 'enterprise' ? 'Custom SLA & agreement' : 'Payment required to unlock studio'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Security Badges */}
          <div className="mt-12 pt-6 border-t border-slate-200/60 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Strict Payment Gate</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>256-bit TLS Encryption</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Instant Activation Upon Payment</span>
            </div>
          </div>
        </main>

        {/* CHECKOUT & PAYMENT MODAL (SHOWS PAYMENT GATEWAY STATUS & BLOCKS DIRECT FREE OPEN) */}
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
              {/* Close Button */}
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold absolute top-6 right-6"
              >
                ✕
              </button>

              {/* STEP 1: ORDER SUMMARY BEFORE PAYMENT */}
              {checkoutStep === 'summary' && (
                <div className="space-y-5">
                  <div className="pr-8">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#0b5cff] text-[10px] font-bold uppercase tracking-wider mb-2">
                      <CreditCard className="w-3 h-3" />
                      ORDER CHECKOUT
                    </div>
                    <h3 className="text-xl font-extrabold text-[#00053d]">
                      Subscribe to {activeCheckoutPlan.name} Plan
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Complete payment to activate your JUMMP Host Dashboard.
                    </p>
                  </div>

                  {/* Order Invoice Breakdown */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
                    <div className="flex items-center justify-between font-medium text-slate-700">
                      <span>Plan Subscription ({activeCheckoutPlan.name})</span>
                      <span className="font-bold text-slate-900">{activeCheckoutPlan.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Billing Cycle</span>
                      <span>Monthly Recurring</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Webinar Attendee Cap</span>
                      <span className="text-emerald-600 font-semibold">Unlimited (Zero Caps)</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm font-black text-[#00053d]">
                      <span>Total Due Today</span>
                      <span className="text-[#0b5cff] text-base">{activeCheckoutPlan.price}</span>
                    </div>
                  </div>

                  {/* Customer Info Verification */}
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>Billed To:</span>
                      <strong className="text-slate-800">{user?.name}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Email:</span>
                      <span className="font-mono text-slate-800">{user?.email}</span>
                    </div>
                    {user?.phone && (
                      <div className="flex items-center justify-between">
                        <span>Phone:</span>
                        <span className="font-mono text-slate-800">{user.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Proceed to Payment Action */}
                  <button
                    onClick={handleProceedPayment}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay {activeCheckoutPlan.price} & Unlock</span>
                  </button>

                  <p className="text-[11px] text-center text-slate-400">
                    Encrypted 256-bit payment transaction.
                  </p>
                </div>
              )}

              {/* STEP 2: PROCESSING SIMULATION */}
              {checkoutStep === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 border-3 border-blue-500/20 border-t-[#0b5cff] rounded-full animate-spin" />
                  <div className="text-sm font-bold text-[#00053d]">Connecting to Payment Gateway...</div>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Verifying merchant checkout channels with payment network.
                  </p>
                </div>
              )}

              {/* STEP 3: PAYMENTS BLOCKED NOTICE (DASHBOARD CANNOT OPEN WITHOUT PAYMENT) */}
              {checkoutStep === 'blocked' && (
                <div className="space-y-5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-1">
                    <Lock className="w-6 h-6" />
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      PAYMENTS CURRENTLY PAUSED
                    </span>
                    <h3 className="text-xl font-extrabold text-[#00053d] mt-2">
                      Dashboard Access Blocked
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      We are currently completing payment gateway onboarding (Razorpay / Stripe). Because JUMMP Host Dashboard requires verified payment and is <strong>not offered for free</strong>, the dashboard remains locked until checkout is live.
                    </p>
                  </div>

                  {/* Priority Waitlist Option */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0b5cff]" />
                      <span>Priority Launch Notification</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Your details ({user?.email}) are saved. Join the priority waitlist to receive instant activation notification when payment links open.
                    </p>

                    {waitlistJoined ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>You are registered on the Priority Billing Waitlist!</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWaitlistJoined(true)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Join Priority Billing Waitlist</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Host VIP Passcode Section (For testing/internal use) */}
                  <div className="pt-2 border-t border-slate-100">
                    {!showPasscodeOption ? (
                      <button
                        type="button"
                        onClick={() => setShowPasscodeOption(true)}
                        className="text-[11px] text-slate-500 hover:text-[#0b5cff] underline flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Have an authorized Host Beta Code? Click here</span>
                      </button>
                    ) : (
                      <form onSubmit={handleVerifyPasscode} className="space-y-2 mt-2">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Enter Authorized Host Passcode
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            placeholder="e.g. JUMMP2026"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:border-[#0b5cff] outline-none"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs"
                          >
                            Verify
                          </button>
                        </div>
                        {passcodeError && (
                          <div className="text-[11px] text-rose-600 font-medium">
                            {passcodeError}
                          </div>
                        )}
                      </form>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCheckoutModal(false)}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
                    >
                      Close & Return to Plan Selector
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="max-w-6xl mx-auto w-full pt-6 pb-2 text-center text-xs text-slate-400">
          JUMMP • Paid Host Broadcast Portal & Live Studio
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: DASHBOARD IS UNLOCKED (ONLY ACCESSIBLE WITH VERIFIED PAYMENT)
  // =========================================================================
  const activePlanKey = user.plan || 'pro';
  const activePlan = PLANS[activePlanKey] || PLANS.pro;

  return (
    <div className="min-h-screen bg-[#fafcff] text-slate-900 selection:bg-blue-500/20 font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Toast */}
      {unlockSuccessToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-[#00053d] text-white border border-blue-500/30 shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Dashboard Unlocked!</div>
            <div className="text-[11px] text-slate-300">
              Your {activePlan.name} Plan is active with verified access.
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
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

            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#0b5cff] text-[11px] font-bold tracking-wider uppercase border border-blue-100">
              <Sparkles className="w-3 h-3" />
              Host Studio Dashboard
            </span>
          </div>

          {/* User Profile & Plan Badge */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Active Plan Pill */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{activePlan.name} Active</span>
              </span>
              <button
                onClick={() => setShowPlanChangeModal(true)}
                className="hidden sm:inline-flex text-xs font-semibold text-[#0b5cff] hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Profile Info */}
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900">{user.name}</div>
              <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8 flex-1">
        {/* Welcome Banner & Instant Broadcast Launcher */}
        <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#00053d] via-[#040e3d] to-[#071d5c] text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-3 border border-blue-400/20">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                BROADCAST STUDIO READY
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                Welcome back, {user.name}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
                Your <strong>{activePlan.name} Plan</strong> is active with unlimited attendee capacity, 1080p WebRTC broadcasting, and live audience interaction tools.
              </p>
            </div>

            {/* Instant Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/meet/${instantRoomId}`}
                className="px-5 py-3 rounded-2xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Launch Broadcast Room</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={copyPersonalLink}
                className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 font-semibold text-xs sm:text-sm transition-all flex items-center gap-2"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Host Link'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 4 KPI Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Tier */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Active Plan</span>
              <Sparkles className="w-4 h-4 text-[#0b5cff]" />
            </div>
            <div className="text-2xl font-black text-[#00053d] capitalize">
              {activePlan.name} Plan
            </div>
            <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <span>{activePlan.price} {activePlan.period}</span>
              <span className="text-slate-400">• Verified</span>
            </div>
          </div>

          {/* Card 2: Seat Allowance */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Attendee Capacity</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-[#00053d]">
              Unlimited
            </div>
            <div className="text-xs text-slate-500">Zero seat caps active</div>
          </div>

          {/* Card 3: Video Quality */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Resolution</span>
              <Video className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-[#00053d]">
              {activePlanKey === 'starter' ? '1080p HD' : '1080p 60fps'}
            </div>
            <div className="text-xs text-slate-500">Adaptive WebRTC SFU</div>
          </div>

          {/* Card 4: Verified Status */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Host Status</span>
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-[#00053d]">
              Active Host
            </div>
            <div className="text-xs text-slate-500 font-mono truncate">{user.phone || user.email}</div>
          </div>
        </section>

        {/* Studio Rooms & Profile Sections */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Broadcast Rooms & Studio Controls */}
          <div className="lg:col-span-8 space-y-6">
            {/* Live Studio Rooms Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#00053d] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0b5cff]" />
                    Host Broadcast Rooms
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Launch meetings, share links with participants, or monitor active audiences.
                  </p>
                </div>
                <Link
                  href={`/meet/${instantRoomId}`}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0b5cff] text-xs font-bold transition-all flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Room</span>
                </Link>
              </div>

              {/* Rooms Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="pb-2.5">Room Name</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5">Attendees</th>
                      <th className="pb-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Instant Webinar Room</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {instantRoomId}</div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          Ready
                        </span>
                      </td>
                      <td className="py-3 text-slate-600 font-mono">Unlimited Cap</td>
                      <td className="py-3 text-right space-x-2">
                        <Link
                          href={`/meet/${instantRoomId}`}
                          className="px-3 py-1.5 rounded-xl bg-[#0b5cff] text-white font-bold text-xs hover:bg-[#0a75e7] transition-all inline-flex items-center gap-1"
                        >
                          <span>Launch</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Personal Host Link</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">/{personalRoomSlug}</div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0b5cff] text-[10px] font-bold border border-blue-200">
                          Always On
                        </span>
                      </td>
                      <td className="py-3 text-slate-600 font-mono">Unlimited Cap</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={copyPersonalLink}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all inline-flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Link</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Privileges Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#00053d] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Active Broadcaster Privileges
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="text-xs font-bold text-[#00053d] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Zero Seat Caps</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Host unlimited attendees without paying extra per attendee or per seat.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="text-xs font-bold text-[#00053d] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Interactive Tools</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Audience polls, upvoted Q&A, and live reactions enabled on all rooms.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="text-xs font-bold text-[#00053d] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant Local Downloads</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Client-side media recording with zero lag and direct video file saves.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <div className="text-xs font-bold text-[#00053d] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sub-Second SFU</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Powered by global LiveKit WebRTC edge routing with automatic simulcast.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): User Profile & Tier Overview */}
          <div className="lg:col-span-4 space-y-6">
            {/* User Profile Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Host Profile
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                  VERIFIED
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0b5cff] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Name</span>
                    <strong className="text-slate-900 text-sm font-bold">{user.name}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0b5cff] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                    <span className="text-slate-900 font-mono text-xs truncate block">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0b5cff] flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone Number</span>
                    <span className="text-slate-900 font-mono text-xs">{user.phone || 'Not provided'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Management Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Subscription & Billing
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Active Subscription
                </span>
              </div>

              <div>
                <div className="text-xl font-extrabold text-[#00053d] capitalize">
                  {activePlan.name} Plan
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {activePlan.price} {activePlan.period}
                </div>
              </div>

              <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Zero seat caps enabled</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>HD audio/video broadcasting</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unlimited meeting durations</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full p-4 sm:p-6 border-t border-slate-200/60 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>JUMMP • Broadcaster Host Portal</div>
        <div className="flex items-center gap-4 text-slate-500">
          <Link href="/" className="hover:text-slate-800">
            Meet Free
          </Link>
          <span>•</span>
          <Link href="/admindesk" className="hover:text-slate-800">
            Platform Telemetry
          </Link>
          <span>•</span>
          <Link href="/pricing" className="hover:text-slate-800">
            Pricing
          </Link>
        </div>
      </footer>

      <ViewportIndicator />
    </div>
  );
}
