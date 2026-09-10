/**
 * Unambiguous character set for secure password generation:
 * - Uppercase A-Z minus O, I (24 characters)
 * - Lowercase a-z minus l, o (24 characters)
 * - Digits 2-9 (8 characters, no 0, 1)
 * - Symbols !@#$% (5 characters)
 * Total: 61 characters
 */
export const UPPER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const LOWER_CHARS = 'abcdefghijkmnpqrstuvwxyz';
export const DIGIT_CHARS = '23456789';
export const SYMBOL_CHARS = '!@#$%';
export const ALL_UNAMBIGUOUS_CHARS = UPPER_CHARS + LOWER_CHARS + DIGIT_CHARS + SYMBOL_CHARS;

export const FORBIDDEN_AMBIGUOUS_CHARS = ['0', '1', 'O', 'I', 'l', 'o'];

/**
 * Generates a secure random password of specified length (default: 12)
 * using an unambiguous character set and cryptographically secure randomness.
 * Guarantees at least 1 uppercase, 1 lowercase, 1 digit, and 1 symbol.
 *
 * @param {number} length
 * @returns {string}
 */
export function generateSecurePassword(length: number = 12): string {
  if (length < 4) {
    throw new Error('Password length must be at least 4 to include all required character categories');
  }

  // Use Web Crypto API available globally in Deno, modern Node.js, and browser environments
  const cryptoObj = typeof crypto !== 'undefined'
    ? crypto
    : (globalThis as any).crypto;

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure random number generator (crypto.getRandomValues) is not available');
  }

  while (true) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    let pwd = '';
    for (let i = 0; i < length; i++) {
      pwd += ALL_UNAMBIGUOUS_CHARS[bytes[i] % ALL_UNAMBIGUOUS_CHARS.length];
    }
    // Verify that all 4 categories are represented
    const hasUpper = /[ABCDEFGHJKLMNPQRSTUVWXYZ]/.test(pwd);
    const hasLower = /[abcdefghijkmnpqrstuvwxyz]/.test(pwd);
    const hasDigit = /[2-9]/.test(pwd);
    const hasSymbol = /[!@#$%]/.test(pwd);

    if (hasUpper && hasLower && hasDigit && hasSymbol) {
      return pwd;
    }
  }
}
