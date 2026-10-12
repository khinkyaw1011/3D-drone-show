import { Viewer } from '@/components/viewer/Viewer';
import { type LocaleParams, pageLocale, pageMetadata } from '@/lib/page';

export const generateMetadata = pageMetadata('Viewer');

export default async function ShowPage(props: LocaleParams) {
  await pageLocale(props);
  return <Viewer />;
}
