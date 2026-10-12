'use client';

import dynamic from 'next/dynamic';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';

const ShowCanvas = dynamic(() => import('@/components/canvas/ShowCanvas'), { ssr: false });

export function SmokeTest() {
  return (
    <main className="fixed inset-0 bg-black">
      <ShowCanvas show={BUILTIN_SHOWS[0]} playing onStatus={(s, e) => console.log('[status]', s, e)} />
    </main>
  );
}
