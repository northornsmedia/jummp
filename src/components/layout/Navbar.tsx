'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight, Sparkles, Bell, CheckCircle2 } from 'lucide-react';
import { useViewport } from '@/hooks/useViewport';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [comingSoonModal, setComingSoonModal] = useState<{ title: string; desc: string } | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const pathname = usePathname();
  const { isMobile } = useViewport();

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
    {
      name: 'Dashboard',
      href: '#',
      comingSoon: true,
      desc: 'The all-in-one broadcast management hub, attendee analytics, and webinar studio are currently in private beta testing.',
    },
    {
      name: 'Live Studio',
      href: '#',
      comingSoon: true,
      desc: 'The ultra-low-latency 1080p 60fps attendee viewing stage with live chat, polls, and instant offer cards is coming soon.',
    },
    { name: 'Docs', href: '/docs' },
  ];

  const handleNavClick = (link: (typeof navLinks)[0], e: React.MouseEvent) => {
    if (link.comingSoon) {
      e.preventDefault();
      setNotifySubmitted(false);
      setNotifyEmail('');
      setComingSoonModal({ title: link.name, desc: link.desc || '' });
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
                    onClick={(e) => handleNavClick(link, e)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'text-[#0b5cff] bg-blue-50/60 font-semibold'
                        : 'text-slate-600 hover:text-[#0b5cff] hover:bg-slate-50'
                    }`}
                  >
                    <span>{link.name}</span>
                    {link.comingSoon && (
                      <span className="text-[10px] font-bold text-[#0b5cff] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                        Coming Soon
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Right CTAs */}
            <div className="hidden md:flex items-center gap-3">
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
                  onClick={(e) => handleNavClick(link, e)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-base font-medium text-slate-800 hover:bg-blue-50 hover:text-[#0b5cff] transition-colors"
                >
                  <span>{link.name}</span>
                  {link.comingSoon && (
                    <span className="text-[10px] font-bold text-[#0b5cff] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                      Coming Soon
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
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

      {/* Themed Coming Soon Popup Modal */}
      {comingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setComingSoonModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              ✕
            </button>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#0b5cff] text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Feature in Private Beta</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#00053d] tracking-tight">
                {comingSoonModal.title}{' '}
                <span className="text-[#0b5cff] underline decoration-blue-200 decoration-wavy">
                  Coming Soon
                </span>
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">
                {comingSoonModal.desc}
              </p>

              {notifySubmitted ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>You will be the first to know when it goes live!</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (notifyEmail) setNotifySubmitted(true);
                  }}
                  className="space-y-2.5 pt-2"
                >
                  <div className="relative">
                    <Bell className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="Enter email for VIP early access"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-[#0b5cff] outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-xs shadow-sm transition-all"
                  >
                    Notify Me on Launch
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
