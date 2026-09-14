import { describe, it, expect } from 'vitest';
import { validateAvatarFile, MAX_AVATAR_SIZE_BYTES } from './avatarValidation';

describe('avatarValidation', () => {
  it('rejects null or undefined file', () => {
    expect(validateAvatarFile(null)).toEqual({
      isValid: false,
      error: 'براہ کرم تصویر منتخب کریں۔'
    });
    expect(validateAvatarFile(undefined)).toEqual({
      isValid: false,
      error: 'براہ کرم تصویر منتخب کریں۔'
    });
  });

  it('rejects non-image files', () => {
    const pdfFile = { name: 'document.pdf', type: 'application/pdf', size: 1000 };
    const textFile = { name: 'notes.txt', type: 'text/plain', size: 500 };
    const noTypeFile = { name: 'unknown', type: '', size: 500 };

    expect(validateAvatarFile(pdfFile)).toEqual({
      isValid: false,
      error: 'براہ کرم صرف تصویر (Image) فائل منتخب کریں۔'
    });
    expect(validateAvatarFile(textFile)).toEqual({
      isValid: false,
      error: 'براہ کرم صرف تصویر (Image) فائل منتخب کریں۔'
    });
    expect(validateAvatarFile(noTypeFile)).toEqual({
      isValid: false,
      error: 'براہ کرم صرف تصویر (Image) فائل منتخب کریں۔'
    });
  });

  it('rejects image files exceeding max size limit (2MB)', () => {
    const largeFile = {
      name: 'large_avatar.png',
      type: 'image/png',
      size: MAX_AVATAR_SIZE_BYTES + 1
    };

    const result = validateAvatarFile(largeFile);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('2MB سے کم ہونا چاہیے');
  });

  it('accepts valid image files within size limit', () => {
    const validJpg = {
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 500 * 1024 // 500 KB
    };

    const validPng = {
      name: 'photo.png',
      type: 'image/png',
      size: 1.5 * 1024 * 1024 // 1.5 MB
    };

    const validWebp = {
      name: 'photo.webp',
      type: 'image/webp',
      size: MAX_AVATAR_SIZE_BYTES // exactly 2MB
    };

    expect(validateAvatarFile(validJpg)).toEqual({ isValid: true, error: '' });
    expect(validateAvatarFile(validPng)).toEqual({ isValid: true, error: '' });
    expect(validateAvatarFile(validWebp)).toEqual({ isValid: true, error: '' });
  });

  it('supports custom max size parameter', () => {
    const customFile = {
      name: 'custom.jpg',
      type: 'image/jpeg',
      size: 1.5 * 1024 * 1024
    };

    // Limit to 1MB
    const result = validateAvatarFile(customFile, 1 * 1024 * 1024);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('1MB سے کم ہونا چاہیے');
  });
});
