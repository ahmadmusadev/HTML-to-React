import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './App';

// Mock contexts
const mockSignOut = vi.fn();
const mockAuthState = {
  user: { email: 'admin@madrasa.com', id: 'admin-123' },
  profile: { full_name: 'ایڈمنسٹریٹر', role: 'admin' },
  role: 'admin',
  signOut: mockSignOut,
};

const mockMadrasaState = {
  activeMadrasa: { name: 'جامعہ حفظ القرآن' },
  activeLogo: null,
  uploadLogo: vi.fn(),
  removeLogo: vi.fn(),
  loadMadrasaData: vi.fn(),
  pendingSyncCount: 0,
  madrasaError: null,
};

vi.mock('./context/AuthContext', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock('./context/MadrasaContext', () => ({
  useMadrasa: () => mockMadrasaState,
  MadrasaProvider: ({ children }) => <div>{children}</div>,
}));

// Mock ProtectedRoute to directly render children
vi.mock('./components/ProtectedRoute', () => ({
  default: ({ children }) => <div data-testid="protected-content">{children}</div>,
}));

// Mock page components
vi.mock('./pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">ڈیش بورڈ پیج</div>,
}));

vi.mock('./pages/AiListen', () => ({
  default: () => <div data-testid="ai-listen-page">اے آئی استاد پیج</div>,
}));

describe('AI Ustad Feature Flag (VITE_SHOW_AI_USTAD)', () => {
  const originalEnv = import.meta.env.VITE_SHOW_AI_USTAD;

  afterEach(() => {
    import.meta.env.VITE_SHOW_AI_USTAD = originalEnv;
  });

  describe('When VITE_SHOW_AI_USTAD is false (flag disabled)', () => {
    beforeEach(() => {
      import.meta.env.VITE_SHOW_AI_USTAD = 'false';
    });

    it('does not render AI Ustad tab in the navigation bar', async () => {
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/']}>
            <MainLayout theme="light" toggleTheme={vi.fn()} />
          </MemoryRouter>
        );
      });

      // Regular tabs should exist
      expect(screen.getByText('ڈیش بورڈ')).toBeInTheDocument();
      expect(screen.getByText('داخلہ جات')).toBeInTheDocument();
      expect(screen.getByText('تعلیمی ریکارڈز')).toBeInTheDocument();

      // AI Ustad tab MUST NOT exist
      expect(screen.queryByText('اے آئی استاد')).toBeNull();
    });

    it('redirects /ai-listen route to / (Home) when accessed directly', async () => {
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/ai-listen']}>
            <MainLayout theme="light" toggleTheme={vi.fn()} />
          </MemoryRouter>
        );
      });

      // Should redirect to Dashboard page and NOT render AiListen
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      expect(screen.queryByTestId('ai-listen-page')).toBeNull();
    });
  });

  describe('When VITE_SHOW_AI_USTAD is true (flag enabled)', () => {
    beforeEach(() => {
      import.meta.env.VITE_SHOW_AI_USTAD = 'true';
    });

    it('renders AI Ustad tab in the navigation bar', async () => {
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/']}>
            <MainLayout theme="light" toggleTheme={vi.fn()} />
          </MemoryRouter>
        );
      });

      // AI Ustad tab MUST exist
      expect(screen.getByText('اے آئی استاد')).toBeInTheDocument();
    });

    it('allows accessing /ai-listen and renders AiListen component', async () => {
      await act(async () => {
        render(
          <MemoryRouter initialEntries={['/ai-listen']}>
            <MainLayout theme="light" toggleTheme={vi.fn()} />
          </MemoryRouter>
        );
      });

      // Should render AiListen page
      expect(screen.getByTestId('ai-listen-page')).toBeInTheDocument();
    });
  });
});
