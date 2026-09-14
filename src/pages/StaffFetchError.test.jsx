import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Staff from './Staff';
import * as MadrasaContextModule from '../context/MadrasaContext';
import * as AuthContextModule from '../context/AuthContext';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('Staff Component Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      role: 'admin',
      user: { id: 'user-1' },
      profile: { madrasa_id: VALID_UUID }
    });
  });

  it('displays honest Urdu error banner and 0 staff when fetchStaffFromSupabase fails', async () => {
    const mockFetchStaff = vi.fn().mockRejectedValue(new Error('سرور سے رابطہ نہ ہو سکا۔ برائے مہربانی اپنا انٹرنیٹ کنکشن چیک کریں۔'));
    const mockFetchClasses = vi.fn().mockResolvedValue([]);

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: VALID_UUID,
      fetchStaffFromSupabase: mockFetchStaff,
      fetchClassesFromSupabase: mockFetchClasses,
      addStaffToSupabase: vi.fn(),
      updateStaffInSupabase: vi.fn(),
      deleteStaffFromSupabase: vi.fn()
    });

    render(<Staff />);

    await waitFor(() => {
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert.textContent).toContain('سرور سے رابطہ نہ ہو سکا');
    });

    // Verify no staff cards rendered
    expect(screen.queryByText(/استاد کوڈ/)).not.toBeInTheDocument();
  });

  it('renders clean empty state with no error banner when database has 0 staff', async () => {
    const mockFetchStaff = vi.fn().mockResolvedValue([]);
    const mockFetchClasses = vi.fn().mockResolvedValue([]);

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: VALID_UUID,
      fetchStaffFromSupabase: mockFetchStaff,
      fetchClassesFromSupabase: mockFetchClasses,
      addStaffToSupabase: vi.fn(),
      updateStaffInSupabase: vi.fn(),
      deleteStaffFromSupabase: vi.fn()
    });

    render(<Staff />);

    await waitFor(() => {
      expect(mockFetchStaff).toHaveBeenCalledWith(VALID_UUID);
    });

    // No error banner
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Empty state message
    expect(screen.getByText('ابھی تک کوئی اسٹاف پروفائل موجود نہیں۔')).toBeInTheDocument();
  });
});
