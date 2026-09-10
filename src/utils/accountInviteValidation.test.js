import { describe, it, expect } from 'vitest';
import {
  validateInvitePayload,
  checkInvitePermission,
  extractEdgeFunctionError
} from './accountInviteValidation';

describe('accountInviteValidation', () => {
  describe('checkInvitePermission', () => {
    it('allows super_admin to invite admin, teacher, and super_admin', () => {
      expect(checkInvitePermission('super_admin', 'admin')).toBe(true);
      expect(checkInvitePermission('super_admin', 'teacher')).toBe(true);
      expect(checkInvitePermission('super_admin', 'super_admin')).toBe(true);
      expect(checkInvitePermission('super_admin', 'invalid_role')).toBe(false);
    });

    it('allows admin to invite ONLY teacher', () => {
      expect(checkInvitePermission('admin', 'teacher')).toBe(true);
      expect(checkInvitePermission('admin', 'admin')).toBe(false);
      expect(checkInvitePermission('admin', 'super_admin')).toBe(false);
    });

    it('rejects teacher or guest from inviting anyone', () => {
      expect(checkInvitePermission('teacher', 'teacher')).toBe(false);
      expect(checkInvitePermission('teacher', 'admin')).toBe(false);
      expect(checkInvitePermission('guest', 'teacher')).toBe(false);
      expect(checkInvitePermission(null, 'teacher')).toBe(false);
    });
  });

  describe('validateInvitePayload', () => {
    it('validates a correct admin invite payload', () => {
      const payload = {
        email: 'admin@jamia.com',
        fullName: 'مولانا احمد',
        role: 'admin',
        madrasaName: 'دار العلوم حقانیہ',
        phone: '03001234567'
      };
      const result = validateInvitePayload(payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('flags missing or invalid madrasaName for admin invite', () => {
      const payload = {
        email: 'admin@jamia.com',
        fullName: 'مولانا احمد',
        role: 'admin',
        madrasaName: '',
      };
      const result = validateInvitePayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.madrasaName).toBeTruthy();
    });

    it('validates a correct teacher invite payload', () => {
      const payload = {
        email: 'teacher@jamia.com',
        fullName: 'قاری محمد بلال',
        role: 'teacher',
        madrasaId: '11111111-1111-1111-1111-111111111111',
        phone: '03009876543'
      };
      const result = validateInvitePayload(payload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('flags missing or non-UUID madrasaId for teacher invite', () => {
      const payload = {
        email: 'teacher@jamia.com',
        fullName: 'قاری محمد بلال',
        role: 'teacher',
        madrasaId: 'not-a-uuid',
      };
      const result = validateInvitePayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.madrasaId).toBeTruthy();
    });

    it('flags invalid email format', () => {
      const payload = {
        email: 'bad-email',
        fullName: 'احمد',
        role: 'admin',
        madrasaName: 'جامعہ'
      };
      const result = validateInvitePayload(payload);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeTruthy();
    });
  });

  describe('extractEdgeFunctionError', () => {
    it('(a) extracts message from a Response-like context with a valid JSON error body', async () => {
      const error = {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: async () => ({ error: 'مدرسے کا نام درج کرنا لازمی ہے' })
        }
      };

      const result = await extractEdgeFunctionError(error);
      expect(result).toBe('مدرسے کا نام درج کرنا لازمی ہے');
    });

    it('(b) falls back to error.message when context.json() throws or rejects', async () => {
      const error = {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: async () => {
            throw new Error('Unexpected token < in JSON at position 0');
          }
        }
      };

      const result = await extractEdgeFunctionError(error);
      expect(result).toBe('Edge Function returned a non-2xx status code');
    });

    it('(c) falls back to error.message when there is no context property (plain network error)', async () => {
      const error = new Error('Failed to fetch');

      const result = await extractEdgeFunctionError(error);
      expect(result).toBe('Failed to fetch');
    });

    it('falls back to error.message when parsedBody has no error field', async () => {
      const error = {
        message: 'Default error message',
        context: {
          json: async () => ({ status: 400 })
        }
      };

      const result = await extractEdgeFunctionError(error);
      expect(result).toBe('Default error message');
    });

    it('handles falsy or empty errors safely', async () => {
      expect(await extractEdgeFunctionError(null)).toBe('');
      expect(await extractEdgeFunctionError(undefined)).toBe('');
    });
  });
});

