import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

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
      signInWithPassword: vi.fn().mockRejectedValue({
        status: 500,
        message: 'Database error querying schema',
      }),
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

describe('AuthContext with Seed/Demo Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('authenticates admin successfully via fallback when Supabase has server error', async () => {
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
      await authContextRef.signIn('admin@madrasa.com', 'AdminPass123!');
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('yes');
    expect(screen.getByTestId('user-email').textContent).toBe('admin@madrasa.com');
    expect(screen.getByTestId('user-role').textContent).toBe('admin');
    expect(localStorage.getItem('hf_auth_user_v1')).toBeTruthy();
  });

  it('authenticates teacher successfully via fallback', async () => {
    let authContextRef = null;

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer onAuthReady={(auth) => { authContextRef = auth; }} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await authContextRef.signIn('teacher@madrasa.com', 'TeacherPass123!');
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('yes');
    expect(screen.getByTestId('user-email').textContent).toBe('teacher@madrasa.com');
    expect(screen.getByTestId('user-role').textContent).toBe('teacher');
  });

  it('clears session on signOut', async () => {
    let authContextRef = null;

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer onAuthReady={(auth) => { authContextRef = auth; }} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await authContextRef.signIn('admin@madrasa.com', 'AdminPass123!');
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('yes');

    await act(async () => {
      await authContextRef.signOut();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('no');
    expect(localStorage.getItem('hf_auth_user_v1')).toBeNull();
  });
});
