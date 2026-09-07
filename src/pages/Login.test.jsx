import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as AuthContextModule from '../context/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: { from: { pathname: '/' } } }),
  };
});

describe('Login Component', () => {
  const mockSignIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      signIn: mockSignIn,
      user: null,
      isAuthenticated: false,
      loading: false,
    });
  });

  it('renders login form and demo fill buttons', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('جامعہ حفظ منیجر')).toBeInTheDocument();
    expect(screen.getByLabelText(/ای میل ایڈریس/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/پاس ورڈ/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /مہتمم \/ ایڈمن لاگ ان/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /استاد \/ ٹیچر لاگ ان/i })).toBeInTheDocument();
  });

  it('fills admin credentials when clicking admin demo button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const adminBtn = screen.getByRole('button', { name: /مہتمم \/ ایڈمن لاگ ان/i });
    fireEvent.click(adminBtn);

    const emailInput = screen.getByLabelText(/ای میل ایڈریس/i);
    const passwordInput = screen.getByPlaceholderText('پاس ورڈ درج کریں');

    expect(emailInput.value).toBe('admin@madrasa.com');
    expect(passwordInput.value).toBe('AdminPass123!');
  });

  it('handles server error gracefully with clear message', async () => {
    mockSignIn.mockRejectedValue(new Error('SERVER_CONNECTION_ERROR'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const adminBtn = screen.getByRole('button', { name: /مہتمم \/ ایڈمن لاگ ان/i });
    fireEvent.click(adminBtn);

    const submitBtn = screen.getByRole('button', { name: /سسٹم میں لاگ ان کریں/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/سرور یا ڈیٹا بیس سے رابطہ نہیں ہو سکا/i);
    });
  });

  it('handles invalid credentials with appropriate error message', async () => {
    mockSignIn.mockRejectedValue(new Error('INVALID_CREDENTIALS'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/ای میل ایڈریس/i);
    const passwordInput = screen.getByPlaceholderText('پاس ورڈ درج کریں');

    fireEvent.change(emailInput, { target: { value: 'wrong@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    const submitBtn = screen.getByRole('button', { name: /سسٹم میں لاگ ان کریں/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/غلط ای میل یا پاس ورڈ/i);
    });
  });
});
