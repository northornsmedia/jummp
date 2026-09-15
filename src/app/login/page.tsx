'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Video, ArrowRight, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import ViewportIndicator from '@/components/common/ViewportIndicator';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 600);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 text-[#0a0a0a]">
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
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
          href="/signup"
          className="text-xs sm:text-sm font-semibold text-[#0b5cff] hover:underline"
        >
          Need an account? Sign up →
        </Link>
      </div>

      {/* Main Auth Card */}
      <div className="max-w-md w-full mx-auto my-auto bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#00053d] tracking-tight">
            {step === 'email' ? 'Welcome back' : 'Check your email'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {step === 'email'
              ? 'Sign in with your email or Google account to continue.'
              : `We sent a 6-digit verification code to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <div>
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setTimeout(() => router.push('/dashboard'), 600);
              }}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-semibold text-sm text-slate-800 transition-colors shadow-xs"
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
              <span>Continue with Google</span>
            </button>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-xs font-semibold text-slate-400 uppercase">
                Or with email
              </span>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Sending code...' : 'Continue with OTP'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex justify-between gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  className="w-12 h-14 text-center font-extrabold text-xl rounded-xl border border-slate-200 focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying...' : 'Verify & Enter Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                ← Back to email
              </button>
            </div>
          </form>
        )}

        {/* Legal Disclaimer */}
        <p className="mt-8 text-[11px] text-center text-slate-400 leading-relaxed">
          By signing in, you agree to our{' '}
          <Link href="/terms-conditions" className="underline hover:text-slate-600">
            Terms & Conditions
          </Link>{' '}
          and{' '}
          <Link href="/privacy-policy" className="underline hover:text-slate-600">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      {/* Bottom status */}
      <div className="text-center text-xs text-slate-400 py-2">
        Protected with 256-bit SSL encryption
      </div>
      <ViewportIndicator />
    </div>
  );
}
