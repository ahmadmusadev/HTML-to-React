/**
 * Pure validation and error formatting functions for Password Change workflows.
 * Used across ProfileModal and unit tests.
 */

/**
 * Validates the Change Password form fields.
 * - currentPassword: required
 * - newPassword: required, minimum 6 characters
 * - confirmPassword: required, must match newPassword
 *
 * @param {Object} payload
 * @param {string} payload.currentPassword
 * @param {string} payload.newPassword
 * @param {string} payload.confirmPassword
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validatePasswordChange(payload = {}) {
  const errors = {};

  const currentPassword = payload?.currentPassword || '';
  const newPassword = payload?.newPassword || '';
  const confirmPassword = payload?.confirmPassword || '';

  // 1. Current password required
  if (!currentPassword) {
    errors.currentPassword = 'موجودہ پاسورڈ درج کرنا لازمی ہے۔';
  }

  // 2. New password required and length >= 6
  if (!newPassword) {
    errors.newPassword = 'نیا پاسورڈ درج کرنا لازمی ہے۔';
  } else if (newPassword.length < 6) {
    errors.newPassword = 'نیا پاسورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔';
  }

  // 3. Confirm password required and must match newPassword
  if (!confirmPassword) {
    errors.confirmPassword = 'نئے پاسورڈ کی تصدیق درج کرنا لازمی ہے۔';
  } else if (newPassword && newPassword !== confirmPassword) {
    errors.confirmPassword = 'نیا پاسورڈ اور تصدیقی پاسورڈ مماثل نہیں ہیں۔';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Formats Supabase or network errors into clear, user-friendly Urdu messages.
 * Adapts patterns established in Login.jsx and ForgotPassword.jsx.
 *
 * @param {any} err
 * @param {string} [defaultMsg]
 * @returns {string}
 */
export function formatPasswordChangeError(err, defaultMsg = 'پاسورڈ تبدیل کرنے میں مسئلہ پیش آیا۔') {
  if (!err) return defaultMsg;

  let rawMsg = '';
  if (typeof err === 'string') {
    rawMsg = err;
  } else if (err && typeof err.message === 'string' && err.message !== '{}') {
    rawMsg = err.message;
  } else if (err && typeof err.error_description === 'string') {
    rawMsg = err.error_description;
  }

  if (
    rawMsg === 'SERVER_CONNECTION_ERROR' ||
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('AuthRetryableFetchError') ||
    rawMsg.includes('network') ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return 'سرور یا ڈیٹا بیس سے رابطہ نہیں ہو سکا۔ برائے مہربانی اپنا انٹرنیٹ چیک کریں اور دوبارہ کوشش کریں۔';
  }

  if (
    rawMsg === 'INVALID_CREDENTIALS' ||
    rawMsg.includes('Invalid login credentials') ||
    rawMsg.includes('invalid_credentials') ||
    rawMsg.includes('invalid_grant')
  ) {
    return 'موجودہ پاسورڈ غلط ہے';
  }

  if (rawMsg.includes('rate limit') || rawMsg.includes('over_email_send_rate_limit')) {
    return 'بہت زیادہ کوششیں کی گئیں۔ براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔';
  }

  if (
    rawMsg.includes('Password should be at least 6 characters') ||
    rawMsg.includes('weak_password')
  ) {
    return 'نیا پاسورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔';
  }

  if (rawMsg.includes('same_password') || rawMsg.includes('should be different')) {
    return 'نیا پاسورڈ پرانے پاسورڈ سے مختلف ہونا چاہیے۔';
  }

  if (rawMsg && rawMsg !== '{}' && rawMsg !== '[object Object]') {
    return rawMsg;
  }

  return defaultMsg;
}
