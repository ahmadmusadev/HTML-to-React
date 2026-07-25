import { describe, it, expect } from 'vitest';
import { supabase } from './supabaseClient';

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
});
