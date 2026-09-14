/**
 * Pure validation functions for Avatar file uploads.
 */

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Validates an avatar file prior to uploading.
 *
 * @param {File|null|undefined} file
 * @param {number} [maxSizeBytes=MAX_AVATAR_SIZE_BYTES]
 * @returns {{ isValid: boolean, error: string }}
 */
export function validateAvatarFile(file, maxSizeBytes = MAX_AVATAR_SIZE_BYTES) {
  if (!file) {
    return {
      isValid: false,
      error: 'براہ کرم تصویر منتخب کریں۔'
    };
  }

  // Verify MIME type is an image
  if (!file.type || !file.type.startsWith('image/')) {
    return {
      isValid: false,
      error: 'براہ کرم صرف تصویر (Image) فائل منتخب کریں۔'
    };
  }

  // Verify file size does not exceed limit
  if (file.size > maxSizeBytes) {
    const sizeMb = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      isValid: false,
      error: `تصویر کا سائز ${sizeMb}MB سے کم ہونا چاہیے۔`
    };
  }

  return {
    isValid: true,
    error: ''
  };
}
