import Link from 'next/link';
import './globals.css';

/** Requests that match no locale route at all (the locale layout has its own not-found). */
export default function NotFound() {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-paper">
        <p className="eyebrow">404</p>
        <h1 className="font-serif text-4xl">This page drifted off course</h1>
        <Link href="/" className="text-sm text-cyan underline-offset-4 hover:underline">
          Back to Skyloom
        </Link>
      </body>
    </html>
  );
}
