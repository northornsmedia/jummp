'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ViewportIndicator from '@/components/common/ViewportIndicator';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff]">Privacy Policy</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-2">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500 mt-1">Last updated: September 15, 2026</p>
        </div>

        <div className="py-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">1. Data We Collect</h2>
            <p>
              We collect information necessary to deliver high-quality webinar streaming, including registration details (name, email), device and browser metadata, session duration, and poll/chat responses submitted during broadcasts.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">2. Video & Audio Processing</h2>
            <p>
              Webinar video and audio streams are processed using secure WebRTC encryption in transit. Cloud recordings are stored in encrypted object storage and accessible only by authorized account holders.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">3. Third-Party Integrations & Cookies</h2>
            <p>
              We do not sell personal data to advertisers. Custom tracking pixels (Google Analytics 4, Meta Pixel, Microsoft Clarity) are only initiated when explicitly enabled by webinar hosts in their account settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#00053d]">4. Your Rights</h2>
            <p>
              Under GDPR and applicable privacy regulations, you have the right to request access to, correction of, or permanent deletion of your account and attendee records by emailing privacy@jummp.io.
            </p>
          </section>
        </div>
      </main>

      <Footer />
      <ViewportIndicator />
    </div>
  );
}
