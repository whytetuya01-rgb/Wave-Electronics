// One password rule for every place a password is set: creating a user,
// an admin resetting one, the seed script and `npm run admin:setup`.
export const PASSWORD_MIN_LENGTH = 12;
// bcrypt ignores everything after the first 72 bytes.
export const PASSWORD_MAX_BYTES = 72;

// What earlier versions of the seed script gave admin@, store@ and prod@wave.com.
export const LEGACY_DEFAULT_PASSWORDS = ['admin123', 'store123', 'prod123'];

// Those defaults plus the commonest guesses. Never accepted as a new
// password, and refused at sign-in in production even when they match.
const KNOWN_WEAK_PASSWORDS = new Set([
  ...LEGACY_DEFAULT_PASSWORDS,
  'admin',
  'admin1234',
  'admin@123',
  'admin@1234',
  'password@123',
  'welcome@123',
  'administrator',
  'password',
  'password1',
  'password123',
  'password1234',
  'changeme',
  'welcome',
  'welcome123',
  'letmein',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  '123456789012',
  'wave123',
  'waveelectronics',
]);

export function isKnownWeakPassword(password: string): boolean {
  return KNOWN_WEAK_PASSWORDS.has(password.trim().toLowerCase());
}

// Returns why the password is not acceptable, or null when it is.
export function passwordPolicyError(password: unknown, email?: string): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return 'Password must be under 72 characters';
  }
  if (isKnownWeakPassword(password)) {
    return 'This password is too common. Choose a different one';
  }
  if (email) {
    const lower = password.toLowerCase();
    const address = email.trim().toLowerCase();
    if (lower === address || lower === address.split('@')[0]) {
      return 'Password must not be the email address';
    }
  }
  return null;
}
