/**
 * Pure validation functions for Account & Teacher invitation workflows.
 * Used across client-side forms and unit tests.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates permission hierarchy for inviting new accounts.
 * - super_admin: can invite admin, teacher, or super_admin
 * - admin: can only invite teacher
 * - teacher / others: cannot invite anyone
 *
 * @param {string} callerRole
 * @param {string} targetRole
 * @returns {boolean}
 */
export function checkInvitePermission(callerRole, targetRole) {
  if (!callerRole || !targetRole) return false;
  if (callerRole === 'super_admin') {
    return ['admin', 'teacher', 'super_admin'].includes(targetRole);
  }
  if (callerRole === 'admin') {
    return targetRole === 'teacher';
  }
  return false;
}

/**
 * Validates the payload for creating/inviting an account.
 *
 * @param {Object} payload
 * @param {string} payload.email
 * @param {string} payload.fullName
 * @param {string} payload.role - 'admin' | 'teacher' | 'super_admin'
 * @param {string} [payload.madrasaName] - Required if role === 'admin'
 * @param {string} [payload.madrasaId] - Required if role === 'teacher'
 * @param {string} [payload.phone]
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validateInvitePayload(payload = {}) {
  const errors = {};

  const email = (payload.email || '').trim().toLowerCase();
  const fullName = (payload.fullName || '').trim();
  const role = (payload.role || '').trim();
  const madrasaName = (payload.madrasaName || '').trim();
  const madrasaId = (payload.madrasaId || '').trim();
  const phone = (payload.phone || '').trim();

  // Email validation
  if (!email) {
    errors.email = 'ای میل ایڈریس درج کرنا لازمی ہے۔';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'براہ کرم درست ای میل ایڈریس درج کریں۔';
  }

  // Full Name validation
  if (!fullName) {
    errors.fullName = 'مکمل نام درج کرنا لازمی ہے۔';
  } else if (fullName.length < 2) {
    errors.fullName = 'نام کم از کم 2 حروف پر مشتمل ہونا چاہیے۔';
  }

  // Role validation
  if (!role) {
    errors.role = 'عہدہ / کردار منتخب کرنا لازمی ہے۔';
  } else if (!['admin', 'teacher', 'super_admin'].includes(role)) {
    errors.role = 'منتخب کردہ کردار درست نہیں ہے۔';
  }

  // Madrasa requirements based on role
  if (role === 'admin') {
    if (!madrasaName) {
      errors.madrasaName = 'مدرسے کا نام درج کرنا لازمی ہے۔';
    } else if (madrasaName.length < 3) {
      errors.madrasaName = 'مدرسے کا نام کم از کم 3 حروف پر مشتمل ہونا چاہیے۔';
    }
  }

  if (role === 'teacher') {
    if (!madrasaId) {
      errors.madrasaId = 'مدرسے کی شناخت (ID) درکار ہے۔';
    } else if (!UUID_REGEX.test(madrasaId)) {
      errors.madrasaId = 'مدرسے کی شناختی ID درست فارمیٹ میں نہیں ہے۔';
    }
  }

  // Optional Phone validation
  if (phone && phone.length > 25) {
    errors.phone = 'فون نمبر بہت طویل ہے۔';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Extracts the specific error message from an Edge Function invocation error.
 * When supabase.functions.invoke() returns a non-2xx status, error.message is generic,
 * but error.context contains the fetch Response object with the custom JSON error body.
 *
 * @param {any} error - The error returned or thrown by supabase.functions.invoke
 * @returns {Promise<string>} - The extracted error string, falling back to error.message
 */
export async function extractEdgeFunctionError(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;

  if (error.context && typeof error.context.json === 'function') {
    try {
      const parsedBody = await error.context.json();
      if (parsedBody && parsedBody.error) {
        return typeof parsedBody.error === 'string'
          ? parsedBody.error
          : JSON.stringify(parsedBody.error);
      }
    } catch {
      // Fall back to error.message if extraction fails for any reason
    }
  }

  return error.message || '';
}
