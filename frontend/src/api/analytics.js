import { apiFetch, toQuery } from './client';

export function getMyAnalytics(filters) {
  return apiFetch(`/api/analytics/me${toQuery(filters)}`);
}

export function getPlatformAnalytics(filters) {
  return apiFetch(`/api/analytics/platform${toQuery(filters)}`);
}

// Downloads the bets as a csv / json / pdf file.
export async function downloadExport(filters, format) {
  const response = await apiFetch(`/api/analytics/me/export${toQuery({ ...filters, format })}`, {
    raw: true,
  });

  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `transcendence-bets.${format}`;
  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
