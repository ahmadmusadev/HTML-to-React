/**
 * Strict column definition for public.profiles table in Supabase.
 *
 * Schema verified from PostgreSQL / migrations:
 * - id: UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
 * - madrasa_id: UUID REFERENCES public.madrasas(id) ON DELETE SET NULL
 * - full_name: TEXT NOT NULL
 * - role: TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher'))
 * - phone: TEXT
 * - created_at: TIMESTAMPTZ DEFAULT now() (managed by database, omitted from upsert)
 *
 * NOTE: The profiles table does NOT have an `updated_at` column.
 * Including `updated_at` causes a PostgreSQL error: column "updated_at" does not exist.
 */
export const PROFILES_ALLOWED_COLUMNS = [
  'id',
  'madrasa_id',
  'full_name',
  'role',
  'phone'
] as const;

export type ProfileAllowedColumn = typeof PROFILES_ALLOWED_COLUMNS[number];

export interface ProfileUpsertInput {
  id: string;
  fullName: string;
  role: string;
  madrasaId?: string | null;
  phone?: string | null;
}

export interface ProfileUpsertPayload {
  id: string;
  madrasa_id: string | null;
  full_name: string;
  role: string;
  phone: string | null;
}

/**
 * Builds a schema-safe payload for upserting into public.profiles.
 * Guarantees that only valid, existing columns in the profiles table are included.
 * Explicitly excludes non-existent fields like `updated_at` to prevent Postgres schema errors.
 */
export function buildProfileUpsertPayload(input: ProfileUpsertInput): ProfileUpsertPayload {
  const normalizedFullName = (input.fullName || '').trim();
  const normalizedMadrasaId = (input.madrasaId || '').trim();
  const normalizedPhone = (input.phone || '').trim();

  return {
    id: input.id,
    full_name: normalizedFullName,
    role: input.role,
    madrasa_id: normalizedMadrasaId || null,
    phone: normalizedPhone || null
  };
}
