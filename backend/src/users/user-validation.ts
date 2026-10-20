// Validation rules shared by the user DTOs. The frontend applies the same
// rules (frontend/src/utils/validation.js) before sending a form.

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const USERNAME_MESSAGE =
  'username must be 3-20 characters long and use only letters, numbers and _';

export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE =
  'password must be 8-72 characters long and contain at least one letter and one number';

// Avatars are stored as small data URLs (the browser resizes them first).
export const AVATAR_PATTERN =
  /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
export const AVATAR_MESSAGE =
  'avatar must be a PNG, JPEG, WebP or GIF image encoded as a data URL';
export const AVATAR_MAX_LENGTH = 200_000;
