import { describe, it, expect } from 'vitest';
import {
  buildProfileUpsertPayload,
  PROFILES_ALLOWED_COLUMNS
} from '../../supabase/functions/create-account-invite/profilePayload.ts';
import { extractEdgeFunctionError } from './accountInviteValidation.js';

describe('Profile Upsert Payload Helper (Schema Compliance)', () => {
  const sampleInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    fullName: '  قاری احمد  ',
    role: 'teacher',
    madrasaId: '876e4567-e89b-12d3-a456-426614174999',
    phone: '  03001234567  '
  };

  it('defines the exact allowed columns matching public.profiles schema', () => {
    const expectedColumns = ['id', 'madrasa_id', 'full_name', 'role', 'phone'];
    expect([...PROFILES_ALLOWED_COLUMNS].sort()).toEqual(expectedColumns.sort());
    expect(PROFILES_ALLOWED_COLUMNS).not.toContain('updated_at');
    expect(PROFILES_ALLOWED_COLUMNS).not.toContain('created_at');
  });

  it('builds a payload with exactly the allowed profile columns', () => {
    const payload = buildProfileUpsertPayload(sampleInput);

    expect(payload).toEqual({
      id: '123e4567-e89b-12d3-a456-426614174000',
      full_name: 'قاری احمد',
      role: 'teacher',
      madrasa_id: '876e4567-e89b-12d3-a456-426614174999',
      phone: '03001234567'
    });

    const payloadKeys = Object.keys(payload);
    expect(payloadKeys.sort()).toEqual([...PROFILES_ALLOWED_COLUMNS].sort());
  });

  it('CRITICAL: strictly NEVER includes updated_at in the payload', () => {
    const payload = buildProfileUpsertPayload({
      ...sampleInput,
      // Even if an updated_at or timestamp was passed in input
      updated_at: '2026-09-10T12:00:00.000Z'
    });

    expect('updated_at' in payload).toBe(false);
    expect(payload.updated_at).toBeUndefined();
    expect(Object.keys(payload)).not.toContain('updated_at');
  });

  it('does NOT contain any extra fields outside the profiles table schema', () => {
    const maliciousInput = {
      ...sampleInput,
      extraField: 'should_be_ignored',
      nonExistentCol: 123,
      metadata: { foo: 'bar' }
    };

    const payload = buildProfileUpsertPayload(maliciousInput);
    const payloadKeys = Object.keys(payload);

    for (const key of payloadKeys) {
      expect(PROFILES_ALLOWED_COLUMNS).toContain(key);
    }
    expect(payloadKeys).toHaveLength(5);
  });

  it('normalizes optional and empty fields to null', () => {
    const inputWithEmptyOptionals = {
      id: 'usr-1',
      fullName: 'مولانا بلال',
      role: 'admin',
      madrasaId: '   ',
      phone: '   '
    };

    const payload = buildProfileUpsertPayload(inputWithEmptyOptionals);

    expect(payload.madrasa_id).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.full_name).toBe('مولانا بلال');
    expect(payload.role).toBe('admin');
  });

  it('handles null/undefined optional values cleanly', () => {
    const minimalInput = {
      id: 'usr-2',
      fullName: 'استاد علی',
      role: 'teacher'
    };

    const payload = buildProfileUpsertPayload(minimalInput);

    expect(payload.id).toBe('usr-2');
    expect(payload.full_name).toBe('استاد علی');
    expect(payload.role).toBe('teacher');
    expect(payload.madrasa_id).toBeNull();
    expect(payload.phone).toBeNull();
  });
});

describe('Edge Function Rollback Error Response Extraction', () => {
  it('extractEdgeFunctionError extracts the operator-facing Urdu error on 500 profile failure', async () => {
    const expectedUrduError = 'اکاؤنٹ بنانے کے بعد پروفائل کو محفوظ کرنے میں خرابی پیش آئی، براہ کرم دوبارہ کوشش کریں۔';

    // Simulated FunctionsHttpError structure returned by supabase.functions.invoke
    const mockFunctionsError = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: async () => ({
          error: expectedUrduError,
          details: 'column "updated_at" of relation "profiles" does not exist'
        })
      }
    };

    const extracted = await extractEdgeFunctionError(mockFunctionsError);
    expect(extracted).toBe(expectedUrduError);
  });
});
