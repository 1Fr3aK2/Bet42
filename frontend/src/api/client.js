// Shared fetch helper for every API call.
// - adds the JWT from localStorage
// - turns NestJS error bodies into readable Error messages
// - announces an expired/invalid session so the app can log out

export const SESSION_EXPIRED_EVENT = 'session-expired';

function errorMessage(body, fallback) {
  if (!body) return fallback;
  if (Array.isArray(body.message)) return body.message.join('. ');
  return body.message || fallback;
}

export async function apiFetch(path, { method = 'GET', body, token, raw = false, signal } = {}) {
  const authToken = token ?? localStorage.getItem('token');

  const response = await fetch(path, {
    method,
    signal,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    if (response.status === 401 && authToken) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    const error = new Error(errorMessage(data, `Request failed (${response.status})`));
    error.status = response.status;
    throw error;
  }

  if (raw) return response;
  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Builds "?a=1&b=2", skipping empty values.
export function toQuery(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return query ? `?${query}` : '';
}
