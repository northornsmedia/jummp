'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight, Video } from 'lucide-react';
import { createAnonymousMeeting } from '@/lib/meetingSession';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: 'Features', href: '/#features' },
    { name: 'Comparison', href: '/#comparison' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Docs', href: '/docs' },
  ];

  const startAnonymousMeeting = async () => {
    if (creatingMeeting) return;
    setCreatingMeeting(true);
    try {
      const { room } = await createAnonymousMeeting();
      window.location.assign(`/meet/${room}`);
    } catch (error) {
      console.error(error);
      setCreatingMeeting(false);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-100 py-3'
            : 'bg-white/90 backdrop-blur-xs py-4 border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Brand Logo - Using official JUMMP logo image */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative h-9 w-28 sm:w-32">
                <Image
                  src="/assets/jummp-logo.png"
                  alt="JUMMP"
                  fill
                  priority
                  className="object-contain object-left group-hover:opacity-90 transition-opacity"
                />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'text-[#0b5cff] bg-blue-50/60 font-semibold'
                        : 'text-slate-600 hover:text-[#0b5cff] hover:bg-slate-50'
                    }`}
                  >
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Right CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <button
                type="button"
                onClick={startAnonymousMeeting}
                disabled={creatingMeeting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/70 text-[#0b5cff] hover:bg-blue-100 font-bold text-xs transition-colors shadow-2xs"
                title="Start an instant JUMMP Meet video call"
              >
                <Video className="w-3.5 h-3.5" />
                <span>{creatingMeeting ? 'Starting…' : 'Meet'}</span>
              </button>
              <Link
                href="/login"
                className="text-sm font-semibold text-slate-700 hover:text-[#0b5cff] px-3 py-2 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 px-4 py-2.5 rounded-xl shadow-sm shadow-blue-500/20 transition-all"
              >
                Start Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mobile Right Controls */}
            <div className="flex items-center gap-2 md:hidden">
              <Link
                href="/signup"
                className="text-xs font-semibold text-white bg-[#0b5cff] hover:bg-[#0a75e7] px-3 py-1.5 rounded-lg shadow-sm"
              >
                Start Now
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white/98 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-base font-medium text-slate-800 hover:bg-blue-50 hover:text-[#0b5cff] transition-colors"
                >
                  <span>{link.name}</span>
                </Link>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startAnonymousMeeting}
                disabled={creatingMeeting}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-[#0b5cff] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
              >
                <Video className="w-4 h-4" />
                <span>{creatingMeeting ? 'Starting…' : 'Start Instant Meeting'}</span>
              </button>
              <Link
                href="/login"
                className="w-full text-center py-2.5 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-[#0b5cff] hover:bg-[#0a75e7] rounded-xl shadow-sm"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
