import { apiFetch } from './client';

// Email + password login. Returns { access_token }.
export function loginUser({ email, password }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
    token: '',
  });
}
