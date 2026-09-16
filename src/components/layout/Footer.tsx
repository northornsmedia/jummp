'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Video, Globe, Shield, Sparkles, CheckCircle2, Apple } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200/80 pt-16 pb-12 text-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-100">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <div className="relative h-8 w-28">
                <Image
                  src="/assets/jummp-logo.png"
                  alt="JUMMP"
                  fill
                  className="object-contain object-left"
                />
              </div>
            </Link>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Scaling the world&apos;s live experiences. The enterprise-grade broadcast platform that doesn&apos;t compromise on quality, pricing, or scale.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/admindesk"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors group"
                title="Open JUMMP AdminDesk Platform Telemetry"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Status</span>
                <span className="text-[10px] text-emerald-600 font-mono">/admindesk</span>
              </Link>
            </div>
          </div>

          {/* Col 1: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/#features" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#comparison" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Platform Comparison
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Host Dashboard
                </Link>
              </li>
              <li>
                <Link href="/consumer/demo-room-101" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Live Attendee Room
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Developers & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Resources & Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/admindesk" className="text-slate-600 hover:text-[#0b5cff] transition-colors flex items-center gap-1.5">
                  <span>AdminDesk Telemetry</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-100 text-blue-700">LIVE</span>
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  API & Webhook Docs
                </Link>
              </li>
              <li>
                <Link href="/terms-conditions" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="#faq" className="text-slate-600 hover:text-[#0b5cff] transition-colors">
                  FAQs
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Apps & Integration */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Get the Apps</h4>
            <p className="text-xs text-slate-500">
              Host and broadcast on the go with zero delay.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
              >
                <Apple className="w-5 h-5 text-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Download on the</div>
                  <div className="text-xs font-bold text-slate-800">iOS App Store</div>
                </div>
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 text-xs">▶</div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">GET IT ON</div>
                  <div className="text-xs font-bold text-slate-800">Google Play</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} JUMMP. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy-policy" className="hover:text-slate-700 transition-colors">
              Security
            </Link>
            <Link href="/terms-conditions" className="hover:text-slate-700 transition-colors">
              Privacy
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Built for 1M+ Concurrent Attendees</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
