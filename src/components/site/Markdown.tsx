import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Site typography for rendered markdown: the same tokens as the rest of the text pages. */
const components: Components = {
  h2: (props) => <h2 className="mt-14 font-heading text-3xl text-paper first:mt-0 sm:text-4xl" {...props} />,
  h3: (props) => <h3 className="mt-8 text-lg font-medium text-paper" {...props} />,
  p: (props) => <p className="mt-4 text-[0.9375rem] leading-relaxed text-paper/75" {...props} />,
  ul: (props) => <ul className="mt-4 list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-paper/75 marker:text-glow/70" {...props} />,
  ol: (props) => <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-paper/75 marker:font-mono marker:text-xs marker:text-glow" {...props} />,
  strong: (props) => <strong className="font-medium text-paper" {...props} />,
  a: (props) => <a className="text-cyan underline-offset-4 hover:underline" {...props} />,
  code: (props) => <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-paper/90" {...props} />,
  // Wide tables scroll inside their own box, so the page never scrolls sideways on a phone.
  table: (props) => (
    <div className="scrollbar-thin mt-6 overflow-x-auto rounded-[14px] border border-line">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="eyebrow border-b border-line bg-ink-2/60 px-4 py-3 font-normal" {...props} />,
  td: (props) => <td className="border-b border-line/60 px-4 py-3 align-top leading-relaxed text-paper/75 first:whitespace-nowrap first:text-paper" {...props} />,
};

/** Trusted, static markdown (files in `content/`) rendered with GitHub-flavoured extras (tables, task lists). */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
