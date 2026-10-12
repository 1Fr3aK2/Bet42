// src/api/users.js
import { apiFetch } from './client';

// The starting balance is given by the server, the client only sends credentials.
export function registerUser({ username, email, password }) {
  return apiFetch('/users', {
    method: 'POST',
    body: { username: username.trim(), email: email.trim().toLowerCase(), password },
    token: '',
  });
}

// { username: true|false|null, email: true|false|null } — true = still free
export function checkAvailability({ username, email }) {
  const params = new URLSearchParams();
  if (username) params.set('username', username.trim());
  if (email) params.set('email', email.trim().toLowerCase());
  return apiFetch(`/users/availability?${params}`, { token: '' });
}

// GET /users/me -> the logged-in user (username, avatar, role, wallet, xp...)
export function getMe(token) {
  return apiFetch('/users/me', { token });
}

// PATCH /users/me -> updates username and/or avatar (data URL, or null to remove it)
export function updateUser({ username, avatar }) {
  return apiFetch('/users/me', {
    method: 'PATCH',
    body: { username, ...(avatar !== undefined && { avatar }) },
  });
}

// PATCH /users/password -> only currentPassword and newPassword are sent
// (confirmPassword is checked in the form and not part of the backend DTO)
export function changePassword({ currentPassword, newPassword }) {
  return apiFetch('/users/password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
}

// DELETE /users/me -> deletes the account and all its data (needs the password)
export function deleteAccount(password) {
  return apiFetch('/users/me', { method: 'DELETE', body: { password } });
}

// Public profile of any player
export function getProfile(id) {
  return apiFetch(`/users/${id}/profile`);
}
