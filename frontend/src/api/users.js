// src/api/users.js

const API_URL = '';

// The token is stored in localStorage by App.jsx, so the API helpers can read it
// without every caller having to pass it down.
function authHeaders(token = localStorage.getItem('token')) {
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

// NestJS validation errors can come back as an array of messages.
async function buildError(response, fallback) {
  try {
    const error = await response.json();
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    return new Error(message || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function registerUser({ username, email, password, wallet }) {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, wallet }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }

  return response.json();
}

// GET /users/me -> the logged-in user (username, avatar, role, ...)
export async function getMe(token) {
  const response = await fetch(`${API_URL}/users/me`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw await buildError(response, 'Could not load profile');
  }

  return response.json();
}

// PATCH /users/me -> updates username and/or avatar, returns the updated user
export async function updateUser({ username, avatarFile }) {
  let avatar;
  if (avatarFile) {
    avatar = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); // base64 data URL
      reader.onerror = reject;
      reader.readAsDataURL(avatarFile);
    });
  }

  const response = await fetch(`${API_URL}/users/me`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ username, ...(avatar && { avatar }) }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Profile update failed');
  }

  return response.json();
}

// PATCH /users/password -> only currentPassword and newPassword are sent
// (confirmPassword is checked in the form and not part of the backend DTO)
export async function changePassword({ currentPassword, newPassword }) {
  const response = await fetch(`${API_URL}/users/password`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Password change failed');
  }

  return response.json();
}