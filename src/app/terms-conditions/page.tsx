'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ViewportIndicator from '@/components/common/ViewportIndicator';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff]">Legal Policy</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-2">
            Terms & Conditions
          </h1>
          <p className="text-xs text-slate-500 mt-1">Last updated: September 15, 2026</p>
        </div>

        <div className="py-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">1. Acceptance of Terms</h2>
            <p>
              By accessing and using JUMMP (&quot;the Platform&quot;), you agree to be bound by these Terms and Conditions and our Privacy Policy. If you disagree with any portion of these terms, you may not access or use our services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">2. Description of Services</h2>
            <p>
              JUMMP provides real-time browser-based video broadcasting, virtual meeting rooms, presentation tools, cloud recording, and attendee engagement features. We grant you a revocable, non-exclusive license to use the platform in compliance with applicable laws.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">3. Acceptable Use & Conduct</h2>
            <p>
              You agree not to broadcast prohibited content, infringe intellectual property rights, transmit malicious software, or attempt to compromise server infrastructure. Violation of acceptable use results in immediate account suspension without refund.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">4. Subscription Fees and Billing</h2>
            <p>
              Subscriptions renew automatically on a monthly or annual cadence unless cancelled prior to the billing cycle. All prices are listed in Indian Rupees (INR) or US Dollars (USD) and exclude applicable local taxes.
            </p>
          </section>
        </div>
      </main>

      <Footer />
      <ViewportIndicator />
    </div>
  );
}
