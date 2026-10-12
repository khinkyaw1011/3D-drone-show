import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Header + content column + footer for the text pages (gallery, guide, about). */
export function PageShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <header className="max-w-2xl">
          <p className="eyebrow text-cyan">{eyebrow}</p>
          <h1 className="display mt-3 text-4xl text-paper sm:text-6xl">{title}</h1>
          {lead && <p className="mt-5 text-base text-paper/70 sm:text-lg">{lead}</p>}
        </header>
        <div className="mt-10 sm:mt-14">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
