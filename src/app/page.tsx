'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Play,
  Users,
  Clock,
  Video,
  ShieldCheck,
  BarChart3,
  Flame,
  Radio,
  Sparkles,
  ChevronDown,
  Layers,
  Zap,
  Globe2,
  Tv,
  Coins,
  SmilePlus,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ViewportIndicator from '@/components/common/ViewportIndicator';
import { useViewport } from '@/hooks/useViewport';
import MeetingBar from '@/components/meet/MeetingBar';

export default function LandingPage() {
  const { isMobile } = useViewport();
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const faqs = [
    {
      q: 'Is attendee count limited?',
      a: 'No cap. Whether you are hosting 50 or 500,000, your price remains flat and performance stays rock-solid.',
    },
    {
      q: 'How often can I run webinars?',
      a: 'Completely unrestricted. Run as many live or evergreen sessions as your schedule allows. We never meter your success.',
    },
    {
      q: 'Do attendees install an app?',
      a: 'Zero downloads or installs. Attendees join instantly from any modern browser (Chrome, Safari, Edge, Firefox) on any device with one tap.',
    },
    {
      q: 'Is pricing per seat?',
      a: 'Flat pricing with no per-seat fees or hidden tiers. Scale your team and your audience without fearing surprise bills.',
    },
    {
      q: 'Will this work for small workshops or only large events?',
      a: 'Optimized for both. From intimate 15-person client workshops to 50,000+ attendee marketing keynote broadcasts.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="flex-1 pt-20">
        {/* ================= HERO SECTION ================= */}
        <section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 bg-gradient-to-b from-blue-50/40 via-white to-white">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-r from-blue-400/10 via-indigo-300/10 to-blue-500/10 blur-3xl -z-10 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Top Pill Announcement */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-900 text-xs sm:text-sm font-semibold mb-6 shadow-xs hover:bg-amber-100/70 transition-colors">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <Flame className="w-4 h-4 text-amber-600" />
              <span>Stop Paying ₹10,000 per month to run webinars</span>
              <span className="hidden sm:inline text-amber-400">•</span>
              <span className="text-[#0b5cff] font-bold">Get Instant Discount →</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#00053d] tracking-tight leading-[1.12] max-w-5xl mx-auto">
              Host any <span className="text-[#0b5cff]">webinar</span>, with{' '}
              <span className="highlight-underline text-[#00053d]">
                unlimited participants
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
              A single platform that widens your reach and raises the bar on every event—from marketing keynotes to 100k+ broadcasts. Browser-native, ultra-low latency, and zero seat restrictions.
            </p>

            {/* Dual CTAs */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-bold text-white bg-[#0b5cff] hover:bg-[#0a75e7] px-8 py-4 rounded-xl shadow-lg shadow-blue-500/25 active:scale-98 transition-all"
              >
                Start Free Account
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-6 py-4 rounded-xl shadow-xs transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[#0b5cff]">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
                Product walkthrough
              </button>
            </div>

            {/* Google Meet Style Instant Start & Join Bar on Front Page */}
            <div className="mt-8 max-w-xl mx-auto">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl shadow-blue-500/5">
                <div className="flex items-center justify-between px-2 pb-2.5 text-xs text-slate-500 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-[#00053d]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>JUMMP Meet</span>
                    <span className="font-normal text-slate-400">• Google Meet style calls</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#0b5cff] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                    Instant Link • No Install
                  </span>
                </div>
                <MeetingBar />
              </div>
            </div>

            {/* Live Metrics Row */}
            <div className="mt-14 pt-8 border-t border-slate-200/60 grid grid-cols-3 max-w-3xl mx-auto divide-x divide-slate-200">
              <div className="px-2 sm:px-4 text-center">
                <div className="text-xl sm:text-3xl font-extrabold text-[#00053d]">12,450+</div>
                <div className="text-[11px] sm:text-sm text-slate-500 font-medium mt-1">Webinars Hosted</div>
              </div>
              <div className="px-2 sm:px-4 text-center">
                <div className="text-xl sm:text-3xl font-extrabold text-[#0b5cff]">1.8M+</div>
                <div className="text-[11px] sm:text-sm text-slate-500 font-medium mt-1">Minutes Attended</div>
              </div>
              <div className="px-2 sm:px-4 text-center">
                <div className="text-xl sm:text-3xl font-extrabold text-[#00053d]">450K+</div>
                <div className="text-[11px] sm:text-sm text-slate-500 font-medium mt-1">Webinar Attendees</div>
              </div>
            </div>

            {/* ================= HERO PRODUCT SHOWCASE MOCKUP ================= */}
            <div className="mt-12 relative max-w-5xl mx-auto">
              <div className="relative rounded-2xl md:rounded-3xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden p-2 sm:p-3 bg-gradient-to-b from-slate-50 to-white">
                {/* Floating Top Bar Mockup */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-xs text-slate-400 font-mono bg-slate-100 px-3 py-1 rounded-md">
                    https://jummp.live/consumer/broadcast-studio
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" /> LIVE
                    </span>
                  </div>
                </div>

                {/* Hero Studio Mockup Image / Interactive Canvas */}
                <div className="relative w-full aspect-[16/9] sm:aspect-[16/10] rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center group">
                  <Image
                    src="/assets/figma-exports/hero-img.webp"
                    alt="JUMMP Live Broadcast Studio Mockup"
                    fill
                    priority
                    className="object-cover"
                    onError={(e) => {
                      // fallback if webp is not accessible
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Fallback Mockup UI Overlay if image is loading or custom styled */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-4 sm:p-6 text-left">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-white">
                      <div>
                        <span className="px-2.5 py-1 rounded-md bg-blue-600/90 text-xs font-semibold uppercase tracking-wider">
                          Keynote Stage
                        </span>
                        <h3 className="text-lg sm:text-2xl font-bold mt-1 text-white drop-shadow-md">
                          Scale Your Online Business to 7-Figures
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300">
                          Broadcasting live with 4,281 attendees in room
                        </p>
                      </div>
                      <Link
                        href="/consumer/demo-room-101"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-colors shadow-md"
                      >
                        Enter Interactive Studio
                        <ArrowRight className="w-4 h-4 text-[#0b5cff]" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Mobile Preview Badge */}
              <div className="absolute -bottom-6 -right-2 sm:right-6 bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3 animate-float hidden sm:flex">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0b5cff] flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs text-slate-500 font-medium">Browser-Native</div>
                  <div className="text-sm font-bold text-[#00053d]">Zero App Installs</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= JUMMP MEET (GOOGLE MEET SERVICE) SHOWCASE ================= */}
        <section id="meet" className="py-16 md:py-24 bg-gradient-to-b from-white via-blue-50/20 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                JUMMP Meet Service
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#00053d] mt-3 tracking-tight">
                Google Meet simplicity, <span className="text-[#0b5cff]">built right into JUMMP</span>.
              </h2>
              <p className="text-slate-600 mt-4 text-base sm:text-lg leading-relaxed">
                Start instant video meetings or schedule ahead. Generates dynamic Google Meet-style links with our domain, real-time host admission control, and encrypted audio & video.
              </p>
            </div>

            {/* Google Meet Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0b5cff] flex items-center justify-center mb-4">
                  <Video className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#00053d]">Dynamic Meeting Links</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Every click creates a unique Google Meet style link like <code className="text-[#0b5cff] font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded">jmp-xxxx-yyy</code> with our URL. No account needed to join.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#00053d]">Host Knock & Admission</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Guests wait in the green room and ask to join. The host receives real-time audio chimes and top-screen prompts to admit or deny entry.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#00053d]">Audio, Video & Screen Share</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  Full Google Meet style bottom controls: mute/unmute, HD webcam feeds, display sharing, floating reactions, hand raising, and in-call chat.
                </p>
              </div>
            </div>

            {/* Quick Action Container */}
            <div className="max-w-2xl mx-auto p-6 rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Try JUMMP Meet Right Now</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
                Ready to hop on a call?
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mb-6">
                Click below to start an instant meeting or schedule one for later.
              </p>
              <MeetingBar />
            </div>
          </div>
        </section>

        {/* ================= SOCIAL PROOF / PLATFORM COMPARISON ================= */}
        <section id="comparison" className="py-16 md:py-24 bg-slate-50/70 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Direct Comparison
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-3">
                The platform that doesn&apos;t hold features{' '}
                <span className="text-[#0b5cff]">hostage</span>.
              </h2>
              <p className="text-slate-600 mt-3 text-base sm:text-lg">
                Stop paying per seat and start scaling with a platform engineered for flawless browser broadcasts.
              </p>
            </div>

            {/* Comparison Table / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
              {/* Card 1: Standard Conferencing */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4">
                    Other Webinar Tools
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800">Standard Conferencing</h3>
                  <p className="text-sm text-slate-500 mt-1">Built for 10-person office calls, not high-scale broadcasts.</p>

                  <div className="mt-6 space-y-4">
                    {[
                      { title: 'Expensive per-seat pricing', desc: 'Bills jump dramatically as your team and guest list grow.' },
                      { title: 'Mandatory downloads', desc: 'Forces attendees to install heavy desktop apps, hurting show-up rates.' },
                      { title: 'Capacity bottlenecks', desc: 'Frequent drops and lagginess once audiences cross 100 attendees.' },
                      { title: 'Clunky interface', desc: 'Confusing meeting controls designed for internal workplace calls.' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
                  Average cost: ₹10,000+ / month
                </div>
              </div>

              {/* Card 2: JUMMP (Highlighted) */}
              <div className="bg-gradient-to-b from-blue-50/50 to-white rounded-2xl border-2 border-[#0b5cff] p-6 sm:p-8 shadow-xl flex flex-col justify-between relative">
                <div className="absolute -top-3.5 right-6 bg-[#0b5cff] text-white text-[11px] font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                  Recommended Choice
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#0b5cff] text-xs font-bold uppercase tracking-wider mb-4">
                    JUMMP
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#00053d]">Modern High-Scale Broadcasts</h3>
                  <p className="text-sm text-slate-600 mt-1">Engineered for low-latency web events and unlimited viewers.</p>

                  <div className="mt-6 space-y-4">
                    {[
                      { title: 'Flat, transparent monthly fee', desc: 'Host 100 or 1,000,000 people without changing your bill.' },
                      { title: '100% Browser-based, zero downloads', desc: 'One click and your viewers are in from any device.' },
                      { title: 'HD Cloud streaming', desc: 'Low-latency global CDN network delivers crisp video everywhere.' },
                      { title: 'In-session monetization & CTAs', desc: 'Drop live offer cards, timed buttons, and collect payments.' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 line-through">₹1,499</span>
                    <div className="text-2xl font-extrabold text-[#00053d]">
                      ₹499<span className="text-xs font-normal text-slate-500"> / month</span>
                    </div>
                  </div>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-sm shadow-sm transition-all"
                  >
                    Switch to JUMMP
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CORE FEATURES GRID ================= */}
        <section id="features" className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Powerful Features
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-3">
                Everything you need to broadcast like a <span className="text-[#0b5cff]">pro</span>.
              </h2>
              <p className="text-slate-600 mt-3 text-base sm:text-lg">
                High-performance broadcasting tools crafted for modern presenters, marketers, and educators.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Users,
                  title: 'Unlimited Capacity',
                  desc: 'Scale from 50 attendees to 1,000,000+ viewers without bandwidth penalties or seat charges.',
                  color: 'text-blue-600 bg-blue-50',
                },
                {
                  icon: Tv,
                  title: 'HD Cloud Streams',
                  desc: 'Crystal-clear 1080p 60fps streaming with adaptive bitrate for viewers on any mobile connection.',
                  color: 'text-indigo-600 bg-indigo-50',
                },
                {
                  icon: Radio,
                  title: 'Host Control Center',
                  desc: 'Manage stage spotlights, co-hosts, attendee hand-raises, and moderated Q&A from a single panel.',
                  color: 'text-emerald-600 bg-emerald-50',
                },
                {
                  icon: BarChart3,
                  title: 'Real-Time Engagement Tracking',
                  desc: 'Measure exact attendance curves, poll participation rates, and drop-off timestamps instantly.',
                  color: 'text-amber-600 bg-amber-50',
                },
                {
                  icon: Clock,
                  title: 'Evergreen Auto-Webinars',
                  desc: 'Record once, schedule automated broadcasts that simulate live sessions with interactive chat cues.',
                  color: 'text-purple-600 bg-purple-50',
                },
                {
                  icon: Coins,
                  title: 'Paid Ticket Checkout',
                  desc: 'Sell paid registrations directly through Razorpay, Stripe, or Cashfree with instant payouts.',
                  color: 'text-rose-600 bg-rose-50',
                },
              ].map((f, i) => {
                const IconComponent = f.icon;
                return (
                  <div
                    key={i}
                    className="p-6 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-lg transition-all duration-200 bg-white group flex flex-col justify-between"
                  >
                    <div>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color} group-hover:scale-105 transition-transform`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-[#00053d] mb-2">{f.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= PRICING TEASER SECTION ================= */}
        <section id="pricing" className="py-16 md:py-24 bg-slate-50/70 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Simple Flat Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-3">
                Premium performance, <span className="text-[#0b5cff]">unbeatable pricing</span>.
              </h2>
              <p className="text-slate-600 mt-2 text-base">
                Scale your audience without scaling your budget.
              </p>

              {/* Billing Toggle */}
              <div className="mt-6 inline-flex items-center p-1 rounded-xl bg-white border border-slate-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    billingPeriod === 'monthly'
                      ? 'bg-[#0b5cff] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    billingPeriod === 'annual'
                      ? 'bg-[#0b5cff] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Starter Plan */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-900">Starter Plan</h3>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      Ideal for Startups
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">Perfect for coaches, small teams, and weekly workshops.</p>
                  
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-xs text-slate-400 line-through">₹1,499</span>
                    <span className="text-4xl font-extrabold text-[#00053d]">
                      ₹{billingPeriod === 'monthly' ? '499' : '399'}
                    </span>
                    <span className="text-sm text-slate-500 font-medium">/ month</span>
                    <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      Save ₹1,000
                    </span>
                  </div>

                  <ul className="space-y-3 text-sm text-slate-600">
                    {[
                      'Unlimited participants in webinars',
                      'Unlimited webinar duration',
                      'No time restrictions',
                      'HD streaming & recording',
                      'Interactive polls and live Q&A',
                      'Screen annotation & presentation tools',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#0b5cff] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <Link
                    href="/signup"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors"
                  >
                    Start with Starter
                  </Link>
                </div>
              </div>

              {/* Professional Plan (Best Value) */}
              <div className="bg-white rounded-2xl border-2 border-[#0b5cff] p-6 sm:p-8 shadow-xl flex flex-col justify-between relative">
                <div className="absolute -top-3 right-6 bg-[#0b5cff] text-white text-xs font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                  Best Value
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-[#00053d]">Professional Plan</h3>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#0b5cff]">
                      High Scale
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">Engineered for growing businesses and high-attendance launches.</p>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-xs text-slate-400 line-through">₹10,000</span>
                    <span className="text-4xl font-extrabold text-[#00053d]">
                      ₹{billingPeriod === 'monthly' ? '4,999' : '3,999'}
                    </span>
                    <span className="text-sm text-slate-500 font-medium">/ month</span>
                    <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      Save ₹5,000
                    </span>
                  </div>

                  <ul className="space-y-3 text-sm text-slate-700">
                    {[
                      'Everything in Starter Plan',
                      'Unlimited concurrent webinar rooms',
                      'Dedicated WhatsApp priority support',
                      'Paid ticket checkout (Razorpay/Stripe)',
                      'Custom branded webinar URLs',
                      'Custom GA4, Pixel & Clarity analytics',
                      'API access & automated Webhooks',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <Link
                    href="/signup"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-sm shadow-md transition-all"
                  >
                    Get Instant Access
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Link href="/pricing" className="text-sm font-semibold text-[#0b5cff] hover:underline inline-flex items-center gap-1">
                View detailed plan comparison & enterprise features →
              </Link>
            </div>
          </div>
        </section>

        {/* ================= FAQ ACCORDION SECTION ================= */}
        <section id="faq" className="py-16 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                FAQ
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-3">
                Frequently Asked Questions
              </h2>
              <p className="text-slate-600 mt-2 text-base">
                Everything you need to know about our high-scale broadcast platform.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = faqOpen === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setFaqOpen(isOpen ? null : idx)}
                      className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-bold text-[#00053d] text-base sm:text-lg hover:text-[#0b5cff] transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#0b5cff]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= FINAL CTA BANNER ================= */}
        <section className="py-16 bg-gradient-to-r from-[#00053d] via-[#0b5cff] to-[#00053d] text-white text-center relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Ready to host your first <span className="text-blue-300">webinar</span>?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-blue-100 max-w-xl mx-auto">
              Join thousands of creators and marketers who deliver professional, lag-free broadcasts every single time.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-[#00053d] font-bold text-base hover:bg-slate-100 shadow-xl transition-all active:scale-98"
              >
                Start Now For Free
                <ArrowRight className="w-4 h-4 text-[#0b5cff]" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-base border border-white/20 transition-colors"
              >
                View Pricing Plans
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ViewportIndicator />

      {/* Video Walkthrough Modal */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg">JUMMP Product Walkthrough</h3>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
              <div className="w-16 h-16 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center mb-4">
                <Play className="w-8 h-8 text-white fill-current ml-1" />
              </div>
              <h4 className="text-xl font-bold mb-2">Interactive Product Tour</h4>
              <p className="text-sm text-slate-300 max-w-md">
                Experience high-performance browser streaming, attendee engagement tools, and one-click session creation.
              </p>
              <Link
                href="/consumer/demo-room-101"
                className="mt-6 px-6 py-2.5 rounded-xl bg-[#0b5cff] text-white font-bold text-sm hover:bg-[#0a75e7]"
              >
                Try Live Interactive Room →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
