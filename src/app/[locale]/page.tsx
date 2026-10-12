import { setRequestLocale } from 'next-intl/server';
import { Landing } from '@/components/landing/Landing';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <Landing />;
}
