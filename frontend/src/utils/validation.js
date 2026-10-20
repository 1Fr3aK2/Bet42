// Same rules as the backend DTOs (backend/src/users/user-validation.ts).
// Each function returns an error message, or '' when the value is valid.

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;

export function validateUsername(value) {
  if (!USERNAME_PATTERN.test(value.trim())) {
    return 'Username must be 3-20 characters: letters, numbers or _';
  }
  return '';
}

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'Email is required';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return 'Enter a valid email address';
  return '';
}

export function validatePassword(value) {
  if (!PASSWORD_PATTERN.test(value)) {
    return 'Password must be 8-72 characters with at least one letter and one number';
  }
  return '';
}

export function validateBetAmount(value, { minBet = 1, maxBet = 100000, balance }) {
  const amount = Number(value);
  if (value === '' || value === null || Number.isNaN(amount)) return 'Enter an amount';
  if (!Number.isInteger(amount)) return 'Use a whole number of T$';
  if (amount < minBet) return `Minimum bet is ${minBet} T$`;
  if (amount > maxBet) return `Maximum bet is ${maxBet.toLocaleString('en-US')} T$`;
  if (balance !== undefined && amount > balance) return 'Insufficient balance';
  return '';
}

export function validateAvatarFile(file) {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a PNG, JPEG, WebP or GIF image';
  if (file.size > AVATAR_MAX_FILE_BYTES) return 'Image must be smaller than 5 MB';
  return '';
}
