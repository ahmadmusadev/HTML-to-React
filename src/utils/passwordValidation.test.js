import { describe, it, expect } from 'vitest';
import {
  validatePasswordChange,
  formatPasswordChangeError
} from './passwordValidation';

describe('passwordValidation', () => {
  describe('validatePasswordChange', () => {
    it('rejects empty or missing payload', () => {
      const result = validatePasswordChange();
      expect(result.isValid).toBe(false);
      expect(result.errors.currentPassword).toBe('موجودہ پاسورڈ درج کرنا لازمی ہے۔');
      expect(result.errors.newPassword).toBe('نیا پاسورڈ درج کرنا لازمی ہے۔');
      expect(result.errors.confirmPassword).toBe('نئے پاسورڈ کی تصدیق درج کرنا لازمی ہے۔');
    });

    it('rejects when current password is missing', () => {
      const result = validatePasswordChange({
        currentPassword: '',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.currentPassword).toBeTruthy();
      expect(result.errors.newPassword).toBeUndefined();
      expect(result.errors.confirmPassword).toBeUndefined();
    });

    it('rejects when new password is shorter than 6 characters', () => {
      const result = validatePasswordChange({
        currentPassword: 'oldpassword123',
        newPassword: '12345',
        confirmPassword: '12345'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.newPassword).toBe('نیا پاسورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔');
    });

    it('rejects when confirm password does not match new password', () => {
      const result = validatePasswordChange({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'differentpassword'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.confirmPassword).toBe('نیا پاسورڈ اور تصدیقی پاسورڈ مماثل نہیں ہیں۔');
    });

    it('rejects when confirm password is empty but new password is valid', () => {
      const result = validatePasswordChange({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: ''
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.confirmPassword).toBe('نئے پاسورڈ کی تصدیق درج کرنا لازمی ہے۔');
    });

    it('accepts valid payload with matching passwords of 6+ characters', () => {
      const result = validatePasswordChange({
        currentPassword: 'oldpassword123',
        newPassword: 'securePassword678',
        confirmPassword: 'securePassword678'
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('accepts exact 6 character new password', () => {
      const result = validatePasswordChange({
        currentPassword: 'currentPass',
        newPassword: '123456',
        confirmPassword: '123456'
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });

  describe('formatPasswordChangeError', () => {
    it('handles connection / network errors gracefully', () => {
      expect(formatPasswordChangeError('SERVER_CONNECTION_ERROR')).toContain('سرور یا ڈیٹا بیس سے رابطہ نہیں ہو سکا');
      expect(formatPasswordChangeError({ message: 'Failed to fetch' })).toContain('سرور یا ڈیٹا بیس سے رابطہ نہیں ہو سکا');
      expect(formatPasswordChangeError({ message: 'AuthRetryableFetchError: network timeout' })).toContain('سرور یا ڈیٹا بیس سے رابطہ نہیں ہو سکا');
    });

    it('handles invalid credentials by returning Urdu message for wrong current password', () => {
      expect(formatPasswordChangeError('INVALID_CREDENTIALS')).toBe('موجودہ پاسورڈ غلط ہے');
      expect(formatPasswordChangeError({ message: 'Invalid login credentials' })).toBe('موجودہ پاسورڈ غلط ہے');
      expect(formatPasswordChangeError({ error_description: 'invalid_grant: Invalid credentials' })).toBe('موجودہ پاسورڈ غلط ہے');
    });

    it('handles rate limit errors', () => {
      const res = formatPasswordChangeError({ message: 'rate limit exceeded for requests' });
      expect(res).toContain('بہت زیادہ کوششیں کی گئیں');
    });

    it('handles Supabase weak password error', () => {
      const res = formatPasswordChangeError({ message: 'Password should be at least 6 characters' });
      expect(res).toBe('نیا پاسورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔');
    });

    it('handles custom string errors and unknown error objects', () => {
      expect(formatPasswordChangeError('کسٹم ایرر میسج')).toBe('کسٹم ایرر میسج');
      expect(formatPasswordChangeError({ message: 'Custom database failure' })).toBe('Custom database failure');
    });

    it('falls back to defaultMsg when error is null or undefined or empty object', () => {
      expect(formatPasswordChangeError(null)).toBe('پاسورڈ تبدیل کرنے میں مسئلہ پیش آیا۔');
      expect(formatPasswordChangeError(undefined, 'کسٹم فال بیک')).toBe('کسٹم فال بیک');
      expect(formatPasswordChangeError({})).toBe('پاسورڈ تبدیل کرنے میں مسئلہ پیش آیا۔');
    });
  });
});
