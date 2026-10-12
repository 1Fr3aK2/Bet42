import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="m-0 text-5xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-xl font-bold uppercase tracking-widest text-text">Page not found</h1>
      <p className="mt-2 text-sm text-dim">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-6 inline-block text-accent">← Back to trading</Link>
    </div>
  );
}
