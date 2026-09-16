# JUMMP & JUMMP Meet — Complete Project Overview

## 1. Executive Summary
**JUMMP** (specifically the **JUMMP Meet** video conferencing suite) is a modern, privacy-first, enterprise-grade video collaboration platform built with **Next.js 14 App Router**, **WebRTC**, **LiveKit SFU**, and **Supabase Realtime**. It delivers a high-fidelity video calling experience combining the polish and fluid minimalism of **Apple** design with the robust collaboration workflow of **Google Meet**.

---

## 2. Core Architecture & How It Works

### A. Room Generation & Link Lifecycle
* **Cryptographic Collision Resistance**: Every call generates a unique 7-character code formatted as `jmp-xxxx-yyy`. With 26 lowercase characters across 7 slots ($26^7 \approx 8.03 \text{ billion}$ combinations), strangers are never assigned an existing room.
* **Perpetual Link Reuse**: Meeting links function identically to Google Meet recurring rooms. When a call concludes, the room status changes to `ended`. If any participant re-opens that exact link days or weeks later:
  1. The system checks the inactivity duration.
  2. Rooms with zero activity for over **30 days** show an expiration screen with a 1-click **"Reopen this exact room"** option.
  3. Rooms accessed within 30 days automatically **reactivate** in Supabase, update `last_activity_at`, and launch a fresh live WebRTC session without data collisions.
* **Host Auto-Recognition**: When a meeting creator opens their link, local device cryptographic signatures automatically restore their **Host** permissions (knock admission, participant muting, meeting termination) without forcing repetitive logins.

### B. Media & Signaling Pipeline
* **Peer-to-Peer WebRTC + LiveKit SFU**: Video and audio streams transmit directly between participants with zero intermediary cloud transcoding for ultra-low latency.
* **Supabase Realtime Broadcast Channels**: High-speed WebSocket messaging coordinates:
  * Room admission requests (`REQUEST_JOIN`, `ADMIT_GUEST`, `DENY_GUEST`)
  * WebRTC SDP Offer / Answer & ICE Candidate exchange
  * Real-time participant state sync (Mute, Video, Hand Raise)
  * Real-time in-call chat and animated floating emoji reactions
  * Presenter lock signaling (`SCREEN_SHARE_STARTED`, `SCREEN_SHARE_STOPPED`)
* **Audio Visualizer & Voice Activity Detection**: Built using the browser `AudioContext` and `AnalyserNode`. Monitors microphone input volume in real-time to drive speaking equalizers and active-speaker glowing rings.
* **Client-Side HD Recorder**: Utilizes the browser `MediaRecorder` API combined with an `AudioContext` destination mixer. Mixes system display audio with the local microphone track into an encrypted `.webm` recording downloaded directly to the client's device.

---

## 3. What Has Been Completed & Polished

### Rebranding & UI Cleanup
- **Rebranding to JUMMP Meet**: Replaced all legacy "Google Meet" references across the codebase, UI labels, document titles, and internal signaling protocols with **JUMMP Meet**.
- **Removed Debug / Coming Soon Clutter**:
  - Disabled `ViewportIndicator` (`[Desktop Viewport | 1536 x 730 px]`) across all viewports and devices.
  - Cleaned up the header navigation bar to remove placeholder "Coming Soon" badges and dead modals.
  - Streamlined the homepage hero by removing unnecessary dual CTA buttons and floating pill headers.
- **Brand Identity & Social Link Sharing**:
  - Replaced browser favicons with the official `public/assets/jummp-logo.png`.
  - Configured Next.js OpenGraph (`og:image`, `twitter:image`) metadata so messaging apps (WhatsApp, Slack, iMessage) fetch the official JUMMP branding card when links are shared.

### Lobby & Pre-Join Green Room
- **Ambient Branded Loading Screen**: Modern dark backdrop featuring the official JUMMP logo and ambient lighting during room status checks.
- **Audio & Video Pre-Check**: Live camera preview (front/back flip for mobile), microphone volume meter, and display name configuration before entering.
- **Knock & Admit Workflow**: Guests request admission while the host receives interactive audio chimes and a floating request banner.

### In-Call Experience (Apple & Google Meet Grade)
- **Side-by-Side Screen Sharing Stage**:
  - Enforces **one presenter at a time** across the entire call.
  - Presenter stream occupies the primary left/center stage while participant video tiles stack vertically on the right.
  - Resolves blank video feeds by attaching `srcObject` with automated play policies.
- **Dynamic Multi-User Video Grid**:
  - Auto-scaling responsive layout supporting unlimited participants.
  - **Active Speaker Glow**: Video tiles illuminate with an electric-blue ring (`ring-2 ring-[#0b5cff]`) when voice volume is detected.
  - **Voice Equalizer Wave**: 3-bar animated equalizer displays inside the participant badge during active speech.
- **In-Call Chat (Apple iMessage / Google Meet Style)**:
  - Distinguishes local messages (right-aligned Apple-blue gradient bubbles) from remote participants (left-aligned dark frosted glass bubbles with sender initials).
  - System and JUMMP Bot announcements render as subtle centered pills.
  - **Quick Emoji Reaction Bar**: 1-click emoji row (`👍 ❤️ 👏 🔥 😂 🎉`) docked directly above the chat input.
  - **Instant Keyboard Send**: Pressing `Enter` sends messages immediately (`Shift + Enter` for line breaks).
- **Google Meet Unified Side Drawer Tabs**:
  - Top tab navigation inside the drawer allows switching between **Chat** (with unread dot), **People** (with live participant count), and **Details** in a single click.
- **Floating In-Call Toast Notifications**:
  - Subtle floating glass pill appears at the top center of the screen when new messages arrive or when users enter/leave while the side drawer is closed. Tapping opens the drawer directly.
- **Apple-Style Floating Bottom Dock**:
  - Elevated frosted glass capsule (`backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-3xl`) hovering above the bottom margin.
  - Micro-tooltips on hover for all control buttons.
  - Microphone button glows emerald during active speech.
  - End Call button features a red pill with active press feedback.

---

## 4. Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 14.2 (App Router) |
| **Language** | TypeScript (Strict mode) |
| **Styling** | Tailwind CSS with custom glassmorphism & Plus Jakarta Sans typography |
| **Realtime & Database** | Supabase (PostgreSQL, WebSocket Realtime Channels, Broadcast) |
| **Media Protocols** | WebRTC (PeerConnection, SDP Offer/Answer, STUN/TURN), LiveKit Client |
| **Client Audio/Video** | Web Audio API (`AudioContext`), `MediaStream`, `MediaRecorder` |
| **Iconography** | Lucide React |

---

## 5. Development & Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (runs on port 3000)
npm run dev

# 3. Typecheck and Lint
npm run lint

# 4. Production Build
npm run build
```

* Local URL: `http://localhost:3000`
* Direct Meeting URL Example: `http://localhost:3000/meet/jmp-mqlm-ndd?host=true`
