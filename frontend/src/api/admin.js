import { apiFetch, toQuery } from './client';

// User management (ADMIN only)
export function listUsers(params) {
  return apiFetch(`/users${toQuery(params)}`);
}

export function getUser(id) {
  return apiFetch(`/users/${id}`);
}

export function updateUserAsAdmin(id, changes) {
  return apiFetch(`/users/${id}`, { method: 'PATCH', body: changes });
}

export function setUserRole(id, role) {
  return apiFetch(`/users/${id}/role`, { method: 'PATCH', body: { role } });
}

export function deleteUserAsAdmin(id) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

// Forum moderation (MODERATOR and ADMIN)
export function getPendingContent() {
  return apiFetch('/forum/moderation/pending');
}

// type: 'post' | 'comment', action: 'approve' | 'remove'
export function reviewContent(type, id, action, note) {
  return apiFetch(`/forum/moderation/${type}s/${id}/review`, {
    method: 'PATCH',
    body: { action, ...(note && { note }) },
  });
}

export function getReports(status) {
  return apiFetch(`/forum/reports${toQuery({ status })}`);
}

// action: 'dismiss' | 'remove'
export function resolveReport(id, action, note) {
  return apiFetch(`/forum/reports/${id}/resolve`, {
    method: 'PATCH',
    body: { action, ...(note && { note }) },
  });
}

export function getModerationLogs() {
  return apiFetch('/forum/moderation/logs');
}
