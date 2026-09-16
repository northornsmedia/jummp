import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jummp.live';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'JUMMP - Video Calling & High-Scale Broadcasting',
    template: '%s | JUMMP',
  },
  description:
    'Instant 1-click video calls, screen sharing, and high-scale webinars with JUMMP. Zero downloads, browser-native HD audio and video.',
  keywords: [
    'JUMMP',
    'JUMMP Meet',
    'webinar platform',
    'virtual events',
    'live streaming',
    'video conferencing',
    'instant video calls',
    'screen sharing',
  ],
  authors: [{ name: 'JUMMP' }],
  creator: 'JUMMP',
  publisher: 'JUMMP',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/assets/jummp-logo.png', type: 'image/png' },
    ],
    shortcut: '/assets/jummp-logo.png',
    apple: '/assets/jummp-logo.png',
  },
  openGraph: {
    title: 'JUMMP - Video Calling & High-Scale Broadcasting',
    description:
      'Instant 1-click video calls, screen sharing, and high-scale webinars with JUMMP. Zero downloads, browser-native HD audio and video.',
    url: siteUrl,
    siteName: 'JUMMP',
    images: [
      {
        url: '/assets/jummp-logo.png',
        width: 1200,
        height: 630,
        alt: 'JUMMP',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JUMMP - Video Calling & High-Scale Broadcasting',
    description:
      'Instant 1-click video calls, screen sharing, and high-scale webinars with JUMMP. Zero downloads, browser-native HD audio and video.',
    images: ['/assets/jummp-logo.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0b5cff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/assets/jummp-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/assets/jummp-logo.png" />
      </head>
      <body className="min-h-screen bg-white antialiased text-[#0a0a0a]">
        {children}
      </body>
    </html>
  );
}
