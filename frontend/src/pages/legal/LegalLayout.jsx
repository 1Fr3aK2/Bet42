import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const LAST_UPDATED = '12 October 2026';

// Shared layout of the Privacy Policy and Terms of Service:
// title, date, table of contents and numbered sections.
export default function LegalLayout({ title, intro, sections, otherLink }) {
  useDocumentTitle(title);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-dim">
      <header className="mb-8">
        <h1 className="m-0 text-2xl font-bold uppercase tracking-[0.12em] text-text">{title}</h1>
        <p className="mt-2 text-xs text-faint">Last updated: {LAST_UPDATED}</p>
        <p className="mt-4">{intro}</p>
      </header>

      <nav aria-label="Contents" className="mb-8 rounded-lg border border-line bg-panel p-4">
        <h2 className="m-0 mb-2 text-[11px] uppercase tracking-[0.2em] text-dim">Contents</h2>
        <ol className="m-0 grid list-decimal gap-1 pl-5 sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a className="text-accent no-underline hover:underline" href={`#${section.id}`}>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, index) => (
        <section key={section.id} id={section.id} className="mb-8 scroll-mt-6">
          <h2 className="mb-3 text-base font-bold text-text">
            {index + 1}. {section.title}
          </h2>
          <div className="flex flex-col gap-3 [&_li]:mb-1 [&_strong]:text-text [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5">
            {section.body}
          </div>
        </section>
      ))}

      <footer className="border-t border-line pt-6 text-xs text-faint">
        See also: <Link className="text-accent" to={otherLink.to}>{otherLink.label}</Link>
      </footer>
    </article>
  );
}
