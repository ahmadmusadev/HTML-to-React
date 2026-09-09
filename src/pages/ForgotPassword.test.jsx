import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form properly', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    expect(screen.getByText('پاسورڈ بازیافت کریں')).toBeInTheDocument();
    expect(screen.getByLabelText(/رجسٹرڈ ای میل ایڈریس/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /پاسورڈ ری سیٹ لنک بھیجیں/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /لاگ ان صفحہ پر واپس جائیں/i })).toBeInTheDocument();
  });

  it('submits email and displays success notification', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/رجسٹرڈ ای میل ایڈریس/i);
    fireEvent.change(emailInput, { target: { value: 'user@madrasa.com' } });

    const submitBtn = screen.getByRole('button', { name: /پاسورڈ ری سیٹ لنک بھیجیں/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@madrasa.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
      );
      expect(screen.getByRole('status')).toHaveTextContent(/پاسورڈ تبدیل کرنے کا لنک آپ کے ای میل ایڈریس پر بھیج دیا گیا ہے/i);
    });
  });

  it('displays error message when Supabase fails', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new Error('User not found'),
    });

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/رجسٹرڈ ای میل ایڈریس/i);
    fireEvent.change(emailInput, { target: { value: 'unknown@madrasa.com' } });

    const submitBtn = screen.getByRole('button', { name: /پاسورڈ ری سیٹ لنک بھیجیں/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/User not found/i);
    });
  });
});
