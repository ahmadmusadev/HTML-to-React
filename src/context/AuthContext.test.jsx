import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

// Mock Supabase client
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  isValidUUID: vi.fn((str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)),
}));

function TestConsumer({ onAuthReady }) {
  const auth = useAuth();
  React.useEffect(() => {
    if (onAuthReady) onAuthReady(auth);
  }, [auth, onAuthReady]);

  return (
    <div>
      <span data-testid="is-auth">{auth.isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user-email">{auth.user?.email || 'none'}</span>
      <span data-testid="user-role">{auth.role}</span>
    </div>
  );
}

describe('AuthContext Strict Supabase Auth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('throws error and does NOT authenticate when Supabase sign in fails', async () => {
    supabase.auth.signInWithPassword.mockRejectedValue(new Error('Invalid login credentials'));

    let authContextRef = null;

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer onAuthReady={(auth) => { authContextRef = auth; }} />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('no');

    await act(async () => {
      await expect(authContextRef.signIn('wrong@madrasa.com', 'wrongpass')).rejects.toThrow('Invalid login credentials');
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('no');
    expect(screen.getByTestId('user-email').textContent).toBe('none');
    expect(localStorage.getItem('hf_auth_user_v1')).toBeNull();
    expect(localStorage.getItem('hf_auth_profile_v1')).toBeNull();
  });

  it('authenticates user strictly when Supabase returns valid session and profile', async () => {
    const mockUser = {
      id: '11111111-2222-3333-4444-555555555555',
      email: 'admin@madrasa.com',
      aud: 'authenticated',
      role: 'authenticated'
    };
    const mockSession = { user: mockUser, access_token: 'valid-token' };
    const mockProfile = {
      id: mockUser.id,
      full_name: 'مولانا احمد',
      role: 'admin',
      madrasa_id: '99999999-8888-7777-6666-555555555555'
    };

    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
    });

    let authContextRef = null;

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer onAuthReady={(auth) => { authContextRef = auth; }} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await authContextRef.signIn('admin@madrasa.com', 'SecretPass123!');
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('yes');
    expect(screen.getByTestId('user-email').textContent).toBe('admin@madrasa.com');
    expect(screen.getByTestId('user-role').textContent).toBe('admin');
    expect(localStorage.getItem('hf_auth_user_v1')).toBeNull();
  });

  it('clears session on signOut', async () => {
    const mockUser = { id: 'user-1', email: 'admin@madrasa.com' };
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null
    });

    let authContextRef = null;

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer onAuthReady={(auth) => { authContextRef = auth; }} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await authContextRef.signIn('admin@madrasa.com', 'password');
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('yes');

    await act(async () => {
      await authContextRef.signOut();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('no');
    expect(screen.getByTestId('user-email').textContent).toBe('none');
    expect(localStorage.getItem('hf_auth_user_v1')).toBeNull();
  });

  it('purges legacy demo keys on mount', async () => {
    localStorage.setItem('hf_auth_user_v1', JSON.stringify({ email: 'fake@demo.com' }));
    localStorage.setItem('hf_auth_profile_v1', JSON.stringify({ role: 'admin' }));

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(localStorage.getItem('hf_auth_user_v1')).toBeNull();
    expect(localStorage.getItem('hf_auth_profile_v1')).toBeNull();
  });
});
