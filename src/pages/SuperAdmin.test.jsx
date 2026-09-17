import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuperAdmin from './SuperAdmin';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('SuperAdmin Component', () => {
  const mockMadrasas = [
    {
      id: 'm-1',
      name: 'جامعہ دارالعلوم',
      status: 'active',
      phone: '0300-1111111',
      created_at: '2026-09-01T00:00:00.000Z',
      profiles: [
        { id: 'p-1', full_name: 'مولانا احمد', role: 'admin', phone: '0300-1111111' }
      ]
    },
    {
      id: 'm-2',
      name: 'جامعہ عثمانیہ',
      status: 'disabled',
      phone: '0300-2222222',
      created_at: '2026-09-02T00:00:00.000Z',
      profiles: [
        { id: 'p-2', full_name: 'مولانا عثمان', role: 'admin', phone: '0300-2222222' }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'madrasas') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockMadrasas, error: null })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    supabase.rpc.mockResolvedValue({ data: true, error: null });
  });

  it('renders the madrasa list with status pills and action buttons', async () => {
    render(<SuperAdmin />);

    await waitFor(() => {
      expect(screen.getByText('جامعہ دارالعلوم')).toBeInTheDocument();
      expect(screen.getByText('جامعہ عثمانیہ')).toBeInTheDocument();
    });

    // Check status pills
    expect(screen.getByText('فعال')).toBeInTheDocument();
    expect(screen.getByText('معطل')).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByText('معطل کریں')).toBeInTheDocument();
    expect(screen.getByText('بحال کریں')).toBeInTheDocument();
    const deleteButtons = screen.getAllByText('حذف کریں');
    expect(deleteButtons.length).toBe(2);
  });

  it('updates status when toggle button is clicked', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null })
    });

    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'madrasas') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockMadrasas, error: null })
          }),
          update: mockUpdate
        };
      }
      return {};
    });

    render(<SuperAdmin />);

    await waitFor(() => {
      expect(screen.getByText('معطل کریں')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('معطل کریں'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'disabled' });
    });
  });

  it('opens confirmation modal and invokes delete RPC when confirmed', async () => {
    render(<SuperAdmin />);

    await waitFor(() => {
      expect(screen.getByText('جامعہ دارالعلوم')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('حذف کریں');
    fireEvent.click(deleteButtons[0]);

    // Modal should be displayed
    expect(screen.getByText('مدرسہ مستقل طور پر حذف کریں')).toBeInTheDocument();
    expect(screen.getByText(/اس مدرسے سے وابستہ تمام ڈیٹا/)).toBeInTheDocument();

    // Click confirm delete
    const confirmBtn = screen.getByText('ہاں، مستقل حذف کریں');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('delete_madrasa_completely', {
        p_madrasa_id: 'm-1'
      });
    });
  });

  it('cancels deletion when cancel button is clicked', async () => {
    render(<SuperAdmin />);

    await waitFor(() => {
      expect(screen.getByText('جامعہ دارالعلوم')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('حذف کریں');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('مدرسہ مستقل طور پر حذف کریں')).toBeInTheDocument();

    const cancelBtn = screen.getByText('منسوخ کریں');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('مدرسہ مستقل طور پر حذف کریں')).not.toBeInTheDocument();
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
