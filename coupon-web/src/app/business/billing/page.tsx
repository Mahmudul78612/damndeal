'use client';

import Link from 'next/link';

/** Placeholder while these screens still live in the legacy /vendor portal. */
export default function Page() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
      <p className="text-3xl mb-2">🚧</p>
      <h1 className="font-extrabold text-[17px] text-ink">This screen is moving here</h1>
      <p className="text-[13px] text-gray-500 mt-1.5">
        For now it still lives in the classic portal — everything you do there shows up here too.
      </p>
      <Link href="/vendor" className="btn-claim inline-block mt-4 px-6 py-2.5 text-[14px]">
        <span className="relative z-10">Open classic portal</span>
      </Link>
    </div>
  );
}
