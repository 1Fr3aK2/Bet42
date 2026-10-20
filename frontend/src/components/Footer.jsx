import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="no-print border-t border-line bg-bg px-4 py-6 text-xs text-faint">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
        <p className="text-center md:text-left">
          © {new Date().getFullYear()} Transcendence · 42 school project. T$ is a virtual currency with no real-money value.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap justify-center gap-4">
          <Link className="text-dim no-underline hover:text-accent" to="/privacy">Privacy Policy</Link>
          <Link className="text-dim no-underline hover:text-accent" to="/terms">Terms of Service</Link>
          <a className="text-dim no-underline hover:text-accent" href="/status/">System status</a>
        </nav>
      </div>
    </footer>
  );
}
