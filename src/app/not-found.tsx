import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#00053d] text-white flex flex-col items-center justify-between p-6">
      <div className="w-full max-w-4xl flex items-center justify-between">
        <Link href="/" className="relative h-8 w-28">
          <Image src="/assets/jummp-logo.png" alt="JUMMP" fill priority className="object-contain object-left" />
        </Link>
      </div>

      <div className="max-w-md w-full text-center space-y-5 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <div className="text-6xl font-extrabold text-[#0b5cff]">404</div>
        <h1 className="text-2xl font-bold text-white">Page or Room Not Found</h1>
        <p className="text-sm text-slate-400">
          The link you entered may be invalid or has expired.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25"
        >
          Return to Home
        </Link>
      </div>

      <div className="text-xs text-slate-500">
        © {new Date().getFullYear()} JUMMP. All rights reserved.
      </div>
    </div>
  );
}
