import { describe, it, expect } from 'vitest';
import {
  generateSecurePassword,
  UPPER_CHARS,
  LOWER_CHARS,
  DIGIT_CHARS,
  SYMBOL_CHARS,
  ALL_UNAMBIGUOUS_CHARS,
  FORBIDDEN_AMBIGUOUS_CHARS
} from '../../supabase/functions/create-account-invite/passwordGenerator.ts';

describe('generateSecurePassword', () => {
  it('generates a password of exact default length 12', () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(12);
  });

  it('generates a password with custom specified length', () => {
    expect(generateSecurePassword(16)).toHaveLength(16);
    expect(generateSecurePassword(24)).toHaveLength(24);
    expect(generateSecurePassword(8)).toHaveLength(8);
  });

  it('rejects length less than 4', () => {
    expect(() => generateSecurePassword(3)).toThrow(/at least 4/);
  });

  it('contains at least 1 uppercase letter from unambiguous set (A-Z minus O/I)', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateSecurePassword();
      const hasUpper = [...password].some(char => UPPER_CHARS.includes(char));
      expect(hasUpper).toBe(true);
    }
  });

  it('contains at least 1 lowercase letter from unambiguous set (a-z minus l/o)', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateSecurePassword();
      const hasLower = [...password].some(char => LOWER_CHARS.includes(char));
      expect(hasLower).toBe(true);
    }
  });

  it('contains at least 1 digit from 2-9 (no 0 or 1)', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateSecurePassword();
      const hasDigit = [...password].some(char => DIGIT_CHARS.includes(char));
      expect(hasDigit).toBe(true);
    }
  });

  it('contains at least 1 symbol from !@#$%', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateSecurePassword();
      const hasSymbol = [...password].some(char => SYMBOL_CHARS.includes(char));
      expect(hasSymbol).toBe(true);
    }
  });

  it('NEVER contains ambiguous characters (O, I, l, o, 0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const password = generateSecurePassword();
      for (const forbidden of FORBIDDEN_AMBIGUOUS_CHARS) {
        expect(password).not.toContain(forbidden);
      }
    }
  });

  it('only contains characters from ALL_UNAMBIGUOUS_CHARS', () => {
    for (let i = 0; i < 100; i++) {
      const password = generateSecurePassword();
      for (const char of password) {
        expect(ALL_UNAMBIGUOUS_CHARS).toContain(char);
      }
    }
  });

  it('generates distinct passwords across multiple runs (cryptographic randomness)', () => {
    const passwords = new Set();
    for (let i = 0; i < 50; i++) {
      passwords.add(generateSecurePassword());
    }
    // All 50 passwords should be unique
    expect(passwords.size).toBe(50);
  });
});
