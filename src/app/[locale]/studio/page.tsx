import { StudioApp } from '@/components/studio/StudioApp';
import { type LocaleParams, pageLocale, pageMetadata } from '@/lib/page';

export const generateMetadata = pageMetadata('Studio');

export default async function StudioPage(props: LocaleParams) {
  await pageLocale(props);
  return <StudioApp />;
}
