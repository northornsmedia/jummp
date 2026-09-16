'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Plus,
  Keyboard,
  Link as LinkIcon,
  Calendar,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  X,
  Clock,
} from 'lucide-react';
import {
  parseMeetingId,
  getMeetingUrl,
  saveScheduledMeeting,
  getScheduledMeetings,
  ScheduledMeeting,
} from '@/lib/meetStore';
import { createAnonymousMeeting } from '@/lib/meetingSession';

interface MeetingBarProps {
  className?: string;
}

export default function MeetingBar({ className = '' }: MeetingBarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [meetingInput, setMeetingInput] = useState('');
  const [laterModalOpen, setLaterModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const [generatedMeetingId, setGeneratedMeetingId] = useState('');
  const [copied, setCopied] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Schedule form state
  const [scheduleTitle, setScheduleTitle] = useState('Product Sync & Review');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('15:00');
  const [scheduledResult, setScheduledResult] = useState<ScheduledMeeting | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Instant Meeting
  const handleStartInstantMeeting = async () => {
    if (creatingMeeting) return;
    setCreatingMeeting(true);
    try {
      const { room } = await createAnonymousMeeting();
      setDropdownOpen(false);
      router.push(`/meet/${room}`);
    } catch (error) {
      console.error(error);
      setCreatingMeeting(false);
    }
  };

  // 2. Create Meeting for Later
  const handleCreateForLater = async () => {
    if (creatingMeeting) return;
    setCreatingMeeting(true);
    try {
      const { room } = await createAnonymousMeeting();
      setGeneratedMeetingId(room);
      setDropdownOpen(false);
      setLaterModalOpen(true);
      setCopied(false);
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingMeeting(false);
    }
  };

  // 3. Open Schedule Modal
  const handleOpenSchedule = async () => {
    if (creatingMeeting) return;
    setCreatingMeeting(true);
    try {
      const { room } = await createAnonymousMeeting();
      setGeneratedMeetingId(room);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const localDate = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000);
      setScheduleDate(localDate.toISOString().split('T')[0]);
      setScheduledResult(null);
      setDropdownOpen(false);
      setScheduleModalOpen(true);
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingMeeting(false);
    }
  };

  // Submit Schedule
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const meeting: ScheduledMeeting = {
      id: 'sched-' + Date.now(),
      title: scheduleTitle.trim() || 'JUMMP Meeting',
      date: scheduleDate,
      time: scheduleTime,
      meetingId: generatedMeetingId,
      createdAt: Date.now(),
    };
    saveScheduledMeeting(meeting);
    setScheduledResult(meeting);
  };

  // Join Existing Meeting by Code or Link
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = parseMeetingId(meetingInput);
    if (code) {
      router.push(`/meet/${code}`);
    }
  };

  // Copy meeting link
  const copyLink = (id: string) => {
    const url = getMeetingUrl(id);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Main JUMMP Meet Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* New Meeting Dropdown Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={creatingMeeting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all"
          >
            <Video className="w-5 h-5 fill-white/20" />
            <span>{creatingMeeting ? 'Creating…' : 'New meeting'}</span>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200/80 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={handleStartInstantMeeting}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50/70 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-blue-100/60 text-[#0b5cff] group-hover:bg-[#0b5cff] group-hover:text-white transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#00053d]">Start an instant meeting</div>
                  <div className="text-xs text-slate-500">Jump straight into a call with audio & video</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleCreateForLater}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50/70 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-indigo-100/60 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#00053d]">Create a meeting for later</div>
                  <div className="text-xs text-slate-500">Get a link you can send to people</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleOpenSchedule}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50/70 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-emerald-100/60 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#00053d]">Schedule for later</div>
                  <div className="text-xs text-slate-500">Pick a date & time with invite details</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Enter a code or link input form */}
        <form onSubmit={handleJoin} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={meetingInput}
              onChange={(e) => setMeetingInput(e.target.value)}
              placeholder="Enter a code or link"
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white text-sm text-[#00053d] placeholder-slate-400 focus:outline-none focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={!meetingInput.trim()}
            className={`px-5 py-3.5 rounded-xl font-bold text-sm transition-all ${
              meetingInput.trim()
                ? 'bg-blue-50 text-[#0b5cff] hover:bg-blue-100 cursor-pointer shadow-xs active:scale-98'
                : 'text-slate-400 cursor-not-allowed bg-transparent'
            }`}
          >
            Join
          </button>
        </form>
      </div>

      {/* MODAL 1: Meeting for Later Link Modal */}
      {laterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-left space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-extrabold text-[#00053d]">Here’s the link to your meeting</h3>
              <button
                type="button"
                onClick={() => setLaterModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Copy this link and send it to people you want to meet with. Be sure to save it so you can use it later too.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
              <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800 truncate select-all">
                {getMeetingUrl(generatedMeetingId)}
              </span>
              <button
                type="button"
                onClick={() => copyLink(generatedMeetingId)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#0b5cff] hover:border-blue-300 shadow-xs transition-colors shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {copied && (
              <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5" /> Meeting link copied to clipboard!
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLaterModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => router.push(`/meet/${generatedMeetingId}`)}
                className="px-5 py-2.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Join now as host</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Schedule Meeting Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-left space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#0b5cff]">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-[#00053d]">Schedule Meeting</h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!scheduledResult ? (
              <form onSubmit={handleSaveSchedule} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    required
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    placeholder="e.g. Design Review, Team Weekly"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-[#00053d] focus:outline-none focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#00053d] focus:outline-none focus:border-[#0b5cff]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Time
                    </label>
                    <input
                      type="time"
                      required
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#00053d] focus:outline-none focus:border-[#0b5cff]"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-600">
                  A JUMMP Meet link will be generated and saved for this event.
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                  >
                    Create Invitation
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Meeting Scheduled!
                  </div>
                  <div className="text-xs text-emerald-800">
                    {scheduledResult.title} on {scheduledResult.date} at {scheduledResult.time}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-slate-800 truncate select-all">
                    {getMeetingUrl(scheduledResult.meetingId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink(scheduledResult.meetingId)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#0b5cff] shrink-0"
                    title="Copy invite"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/meet/${scheduledResult.meetingId}`)}
                    className="px-5 py-2.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                  >
                    <span>Start call now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
