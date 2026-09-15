import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JUMMP - Professional Webinar Hosting Platform | Live Streaming & Virtual Events',
  description:
    'Level up your webinars with JUMMP. Host secure, scalable virtual events with enterprise-grade features. From small workshops to large conferences - unlimited participants, HD streaming, recording, and seamless integrations.',
  keywords: [
    'webinar platform',
    'virtual events',
    'live streaming',
    'online presentations',
    'video conferencing',
    'webinar hosting',
    'virtual webinars',
    'online workshops',
  ],
  authors: [{ name: 'JUMMP' }],
  icons: {
    icon: '/favicon.ico',
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
      </head>
      <body className="min-h-screen bg-white antialiased text-[#0a0a0a]">
        {children}
      </body>
    </html>
  );
}
