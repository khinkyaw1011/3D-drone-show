import { Landing } from '@/components/landing/Landing';
import { type LocaleParams, pageLocale } from '@/lib/page';

export default async function HomePage(props: LocaleParams) {
  await pageLocale(props);
  return <Landing />;
}
