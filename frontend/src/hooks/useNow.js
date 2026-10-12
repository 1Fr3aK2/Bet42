import { useEffect, useState } from 'react';

// Current timestamp, refreshed every `interval` ms (for countdowns).
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);

  return now;
}
