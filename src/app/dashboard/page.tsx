'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ComingSoon from '@/components/common/ComingSoon';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        router.replace('/login');
        return;
      }
      setAuthorized(true);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!authorized) {
    return <div className="min-h-screen bg-white" aria-busy="true" />;
  }

  return (
    <ComingSoon
      tag="Host Portal"
      title="Host Dashboard"
      subtitle="The all-in-one broadcast management center, attendance analytics, and webinar studio are currently finalizing private beta testing."
    />
  );
}
