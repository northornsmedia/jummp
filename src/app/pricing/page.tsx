'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Sparkles, HelpCircle, Shield, Zap } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ViewportIndicator from '@/components/common/ViewportIndicator';

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const comparisonFeatures = [
    {
      category: 'Capacity & Streaming',
      features: [
        { name: 'Max Attendees per Session', starter: 'Unlimited', pro: 'Unlimited', enterprise: '1M+ Concurrent' },
        { name: 'Streaming Quality', starter: '1080p HD', pro: '1080p 60fps HD', enterprise: '4K Ultra-Low Latency' },
        { name: 'Max Duration per Session', starter: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
        { name: 'Concurrent Webinar Rooms', starter: '1 Active', pro: 'Unlimited', enterprise: 'Dedicated Cluster' },
      ],
    },
    {
      category: 'Audience Engagement',
      features: [
        { name: 'Live Chat & Reactions', starter: true, pro: true, enterprise: true },
        { name: 'Moderated Q&A with Upvoting', starter: true, pro: true, enterprise: true },
        { name: 'Interactive Live Polls', starter: true, pro: true, enterprise: true },
        { name: 'Timed Offer Cards & CTAs', starter: false, pro: true, enterprise: true },
        { name: 'Stage Hand-Raise & Spotlight', starter: true, pro: true, enterprise: true },
      ],
    },
    {
      category: 'Monetization & Analytics',
      features: [
        { name: 'Sell Paid Webinar Tickets', starter: false, pro: true, enterprise: true },
        { name: 'Custom GA4 & Meta Pixel Tracking', starter: false, pro: true, enterprise: true },
        { name: 'Attendance Curve Reports', starter: 'Basic', pro: 'Real-time Deep', enterprise: 'Full Export & BigQuery' },
        { name: 'API & Webhooks Access', starter: false, pro: true, enterprise: true },
        { name: 'White-label Custom Domain', starter: false, pro: true, enterprise: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-8 pb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Simple, Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#00053d] tracking-tight mt-4">
            Scale your reach, <span className="text-[#0b5cff]">not your bill</span>.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Choose the perfect plan for your webinars. Flat pricing with zero per-seat fees or surprise overages.
          </p>

          {/* Billing Switch */}
          <div className="mt-8 inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] uppercase font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                2 Months Free
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Starter</h3>
                <p className="text-sm text-slate-500 mt-1">Perfect for solo creators, coaches, and weekly workshops.</p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-xs text-slate-400 line-through">₹1,499</span>
                  <span className="text-4xl font-extrabold text-[#00053d]">
                    ₹{billingPeriod === 'monthly' ? '499' : '399'}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>
                <div className="mt-1 text-xs text-emerald-600 font-semibold">Save ₹1,000 per month</div>

                <div className="mt-8 space-y-3">
                  {[
                    'Unlimited participants in webinars',
                    'Unlimited webinar duration',
                    'No time restrictions',
                    'Standard HD streaming',
                    'Interactive polls and live Q&A',
                    'Screen annotation & whiteboard',
                    'Auto-record sessions to cloud',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-[#0b5cff] shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href="/signup?plan=starter"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-colors"
                >
                  Start with Starter
                </Link>
              </div>
            </div>

            {/* Professional Plan (Best Value) */}
            <div className="bg-gradient-to-b from-blue-50/40 via-white to-white rounded-2xl border-2 border-[#0b5cff] p-6 sm:p-8 shadow-xl flex flex-col justify-between relative">
              <div className="absolute -top-3 right-6 bg-[#0b5cff] text-white text-xs font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-xs">
                Best Value
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-[#00053d]">Professional</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0b5cff]">
                    Popular
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Built for high-scale product launches and growing business.</p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-xs text-slate-400 line-through">₹10,000</span>
                  <span className="text-4xl font-extrabold text-[#00053d]">
                    ₹{billingPeriod === 'monthly' ? '4,999' : '3,999'}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>
                <div className="mt-1 text-xs text-emerald-600 font-semibold">Save ₹5,000 per month</div>

                <div className="mt-8 space-y-3">
                  {[
                    'Everything in Starter Plan',
                    'Unlimited concurrent webinar rooms',
                    'Paid ticket checkout (Razorpay & Stripe)',
                    'Live offer cards with instant buy buttons',
                    'Dedicated WhatsApp VIP support',
                    'Custom analytics (GA4, Pixel, Clarity)',
                    'Full API access & Webhook automation',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link
                  href="/signup?plan=professional"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-sm shadow-md transition-all active:scale-98"
                >
                  Start Professional Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Enterprise</h3>
                <p className="text-sm text-slate-500 mt-1">Dedicated infrastructure for large enterprises and global brands.</p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#00053d]">Custom</span>
                  <span className="text-sm text-slate-500 font-medium">/ custom billing</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-semibold">Tailored for 1M+ participants</div>

                <div className="mt-8 space-y-3">
                  {[
                    'Everything in Professional Plan',
                    'Dedicated cloud streaming cluster',
                    'Custom RTMP pull/push inputs',
                    '99.99% guaranteed SLA uptime',
                    'Custom MSA & compliance reviews',
                    'Dedicated Account Manager & Live Producer',
                    'Single Sign-On (SAML / Okta)',
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <a
                  href="mailto:support@jummp.io"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-colors"
                >
                  Contact Enterprise Sales
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Feature Comparison Table */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#00053d]">
              Compare Plan Capabilities
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Complete breakdown of features across all plans.
            </p>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="py-4 px-6 font-bold text-[#00053d] w-2/5">Feature</th>
                    <th className="py-4 px-6 font-bold text-slate-700 w-1/5">Starter</th>
                    <th className="py-4 px-6 font-bold text-[#0b5cff] w-1/5">Professional</th>
                    <th className="py-4 px-6 font-bold text-slate-700 w-1/5">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonFeatures.map((sec, idx) => (
                    <React.Fragment key={idx}>
                      <tr className="bg-slate-50/40">
                        <td colSpan={4} className="py-2.5 px-6 font-extrabold text-xs uppercase tracking-wider text-slate-500">
                          {sec.category}
                        </td>
                      </tr>
                      {sec.features.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-6 text-slate-800 font-medium">{row.name}</td>
                          <td className="py-3.5 px-6 text-slate-600">
                            {typeof row.starter === 'boolean' ? (
                              row.starter ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <span className="text-slate-300 font-bold">—</span>
                            ) : (
                              row.starter
                            )}
                          </td>
                          <td className="py-3.5 px-6 font-semibold text-[#0b5cff]">
                            {typeof row.pro === 'boolean' ? (
                              row.pro ? <CheckCircle2 className="w-4 h-4 text-[#0b5cff]" /> : <span className="text-slate-300 font-bold">—</span>
                            ) : (
                              row.pro
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-slate-700 font-medium">
                            {typeof row.enterprise === 'boolean' ? (
                              row.enterprise ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <span className="text-slate-300 font-bold">—</span>
                            ) : (
                              row.enterprise
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <ViewportIndicator />
    </div>
  );
}
