'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, Terminal, Code2, Key, Globe, Shield, ExternalLink } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ViewportIndicator from '@/components/common/ViewportIndicator';

export default function DocsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const curlAuth = `curl -X GET "https://api.jummp.io/v1/webinars" \\
  -H "Authorization: Bearer jmp_live_948fbc23018e" \\
  -H "Content-Type: application/json"`;

  const webhookPayload = `{
  "event": "webinar.attendee_joined",
  "timestamp": "2026-09-15T14:32:00Z",
  "data": {
    "webinar_id": "demo-room-101",
    "attendee": {
      "id": "att_884920",
      "email": "sarah.k@example.com",
      "name": "Sarah K.",
      "country": "IN",
      "joined_at": "2026-09-15T14:31:58Z"
    }
  }
}`;

  const iframeSnippet = `<iframe
  src="https://jummp.io/embed/demo-room-101?token=JWT_ONE_TIME_JOIN_TOKEN"
  width="100%"
  height="700"
  allow="camera; microphone; display-capture; fullscreen"
  frameborder="0"
></iframe>`;

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0b5cff] bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Developer Documentation
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#00053d] mt-3">
              JUMMP API & Webhooks
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1 max-w-2xl">
              Integrate live broadcasts, automate attendee provisioning, and receive real-time webhook callbacks.
            </p>
          </div>

          <div className="py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar TOC */}
            <aside className="lg:col-span-1 space-y-1 text-sm sticky top-28 self-start hidden lg:block">
              <div className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">
                Contents
              </div>
              <a href="#authentication" className="block py-1.5 px-3 rounded-lg font-medium text-slate-700 hover:bg-slate-100">
                Authentication
              </a>
              <a href="#base-url" className="block py-1.5 px-3 rounded-lg font-medium text-slate-700 hover:bg-slate-100">
                API Base URL
              </a>
              <a href="#webhooks" className="block py-1.5 px-3 rounded-lg font-medium text-slate-700 hover:bg-slate-100">
                Webhooks Architecture
              </a>
              <a href="#iframe" className="block py-1.5 px-3 rounded-lg font-medium text-slate-700 hover:bg-slate-100">
                Secure Iframe Embedding
              </a>
            </aside>

            {/* Main Docs Body */}
            <div className="lg:col-span-3 space-y-12 max-w-3xl">
              {/* Section 1: Authentication */}
              <section id="authentication" className="space-y-4">
                <h2 className="text-2xl font-bold text-[#00053d] flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#0b5cff]" />
                  Authentication
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Authenticate your API requests by including your secret API token in the{' '}
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#0b5cff] font-mono text-xs">
                    Authorization: Bearer &lt;TOKEN&gt;
                  </code>{' '}
                  header. You can generate API tokens inside your Host Dashboard under Settings → API Keys.
                </p>

                <div className="rounded-2xl bg-slate-950 text-slate-200 p-4 font-mono text-xs overflow-x-auto relative shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" /> bash
                    </span>
                    <button
                      onClick={() => copyCode(curlAuth, 'curl')}
                      className="hover:text-white flex items-center gap-1"
                    >
                      {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'curl' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-blue-300">{curlAuth}</pre>
                </div>
              </section>

              {/* Section 2: Webhooks */}
              <section id="webhooks" className="space-y-4">
                <h2 className="text-2xl font-bold text-[#00053d] flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#0b5cff]" />
                  Webhooks Architecture
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Configure a Webhook URL in your dashboard to receive real-time notifications for event lifecycle transitions, attendee entries, and poll responses.
                </p>

                <div className="rounded-2xl bg-slate-950 text-slate-200 p-4 font-mono text-xs overflow-x-auto relative shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" /> JSON Payload
                    </span>
                    <button
                      onClick={() => copyCode(webhookPayload, 'webhook')}
                      className="hover:text-white flex items-center gap-1"
                    >
                      {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'webhook' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-emerald-300">{webhookPayload}</pre>
                </div>
              </section>

              {/* Section 3: Secure Iframe Embedding */}
              <section id="iframe" className="space-y-4">
                <h2 className="text-2xl font-bold text-[#00053d] flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#0b5cff]" />
                  Secure Iframe Embedding
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Embed JUMMP live rooms directly into your custom customer portal or learning management system (LMS). Generate a one-time signed join token from your backend server to bypass login forms.
                </p>

                <div className="rounded-2xl bg-slate-950 text-slate-200 p-4 font-mono text-xs overflow-x-auto relative shadow-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" /> HTML Snippet
                    </span>
                    <button
                      onClick={() => copyCode(iframeSnippet, 'iframe')}
                      className="hover:text-white flex items-center gap-1"
                    >
                      {copiedKey === 'iframe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'iframe' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-amber-300">{iframeSnippet}</pre>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <ViewportIndicator />
    </div>
  );
}
