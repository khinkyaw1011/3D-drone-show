import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Markdown } from '@/components/site/Markdown';
import { PageShell } from '@/components/site/PageShell';
import { type LocaleParams, pageLocale, pageMetadata } from '@/lib/page';
import { SHOW_PROJECT_PAGE } from '@/lib/site';

export const generateMetadata = pageMetadata('Project');

/** Read once at build time: the page is static. Edit `content/project.md` to change it. */
const CONTENT = readFileSync(join(process.cwd(), 'content/project.md'), 'utf8');

export default async function ProjectPage(props: LocaleParams) {
  const locale = await pageLocale(props);
  if (!SHOW_PROJECT_PAGE) notFound();
  const t = await getTranslations({ locale, namespace: 'Project' });
  return (
    <PageShell eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')}>
      <article className="max-w-3xl" lang="en">
        <Markdown>{CONTENT}</Markdown>
      </article>
    </PageShell>
  );
}
