import { describe, it, expect } from 'vitest';
import { supabase, isValidUUID } from './supabaseClient';

describe('Supabase Client Initializer', () => {
  it('exports a valid Supabase client instance', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('provides helper auth methods', () => {
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
    expect(typeof supabase.auth.signOut).toBe('function');
  });

  it('validates UUID strings correctly', () => {
    expect(isValidUUID('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isValidUUID('madrasa_1')).toBe(false);
    expect(isValidUUID('cls-1')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
  });
});
