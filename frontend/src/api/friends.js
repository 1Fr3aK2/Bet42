import { apiFetch } from './client';

// { friends, incoming, outgoing } — each entry: { requestId, since, user: { id, username, level, avatarUrl, online } }
export function getFriends() {
  return apiFetch('/api/friends');
}

export function sendFriendRequest(target) {
  return apiFetch('/api/friends/requests', { method: 'POST', body: target });
}

export function acceptFriendRequest(requestId) {
  return apiFetch(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
}

// Decline (received) or cancel (sent)
export function deleteFriendRequest(requestId) {
  return apiFetch(`/api/friends/requests/${requestId}`, { method: 'DELETE' });
}

export function removeFriend(userId) {
  return apiFetch(`/api/friends/${userId}`, { method: 'DELETE' });
}

// 'self' | 'none' | 'friends' | 'outgoing' | 'incoming'
export function getRelationship(userId) {
  return apiFetch(`/api/friends/relationship/${userId}`);
}
