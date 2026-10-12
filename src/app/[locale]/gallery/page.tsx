import { getTranslations } from 'next-intl/server';
import { ShowGallery } from '@/components/show/ShowGallery';
import { PageShell } from '@/components/site/PageShell';
import { type LocaleParams, pageLocale, pageMetadata } from '@/lib/page';

export const generateMetadata = pageMetadata('Gallery');

export default async function GalleryPage(props: LocaleParams) {
  const locale = await pageLocale(props);
  const t = await getTranslations({ locale, namespace: 'Gallery' });
  return (
    <PageShell eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')}>
      <ShowGallery />
    </PageShell>
  );
}
