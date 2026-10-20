import { useEffect } from 'react';

// Sets the browser tab title (also read by screen readers on navigation).
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Transcendence` : 'Transcendence';
  }, [title]);
}
