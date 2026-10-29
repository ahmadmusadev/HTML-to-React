import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Attendance from './Attendance';
import * as MadrasaContextModule from '../context/MadrasaContext';

describe('Staff Attendance UI - half_leave Option & Helper Text', () => {
  const mockStaff = [
    {
      id: 'staff-uuid-1',
      name: 'قاری محمد بلال',
      staff_code: 1001,
      shift_start: '06:50:00',
      shift_end: '14:45:00',
      status: 'active'
    }
  ];

  const mockClasses = [
    {
      id: 'class-uuid-1',
      name: 'حفظ اول',
      class_name: 'حفظ اول',
      teacher: 'قاری محمد بلال',
      teacher_name: 'قاری محمد بلال'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: '11111111-1111-1111-1111-111111111111',
      activeMadrasa: { id: '11111111-1111-1111-1111-111111111111', name: 'جامعہ حفظ' },
      madrasas: [{ id: '11111111-1111-1111-1111-111111111111', name: 'جامعہ حفظ' }],
      classesList: mockClasses,
      setClassesList: vi.fn(),
      loadMadrasaData: vi.fn().mockReturnValue(null),
      saveMadrasaData: vi.fn(),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchRecordsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue(mockClasses),
      fetchStaffFromSupabase: vi.fn().mockResolvedValue(mockStaff),
      fetchStudentAttendanceFromSupabase: vi.fn().mockResolvedValue([]),
      fetchStaffAttendanceFromSupabase: vi.fn().mockResolvedValue([]),
      fetchStaffAttendancePendingDate: vi.fn().mockResolvedValue(null),
      upsertStaffAttendanceCheckIn: vi.fn().mockResolvedValue([]),
      upsertStaffAttendanceCheckOut: vi.fn().mockResolvedValue([])
    });
  });

  it('renders "آدھی چھٹی" status option in the staff attendance table', async () => {
    render(<Attendance />);

    // Click on staff attendance tab ("عملے کی حاضری")
    const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
    fireEvent.click(staffTabBtn);

    // Wait for staff table to appear
    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    // Check that select dropdown contains "آدھی چھٹی" option
    const statusSelect = screen.getByRole('combobox');
    expect(statusSelect).toBeInTheDocument();

    const halfLeaveOption = Array.from(statusSelect.options).find(opt => opt.value === 'half_leave');
    expect(halfLeaveOption).toBeDefined();
    expect(halfLeaveOption.textContent).toBe('آدھی چھٹی');
  });

  it('displays the helper text when status is switched to "half_leave"', async () => {
    render(<Attendance />);

    const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
    fireEvent.click(staffTabBtn);

    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    // Initially status is present, helper text should not exist
    expect(screen.queryByText('آدھی چھٹی والے دن صرف وہ منٹ لکھیں جو آدھی چھٹی کے علاوہ ہوں۔')).not.toBeInTheDocument();

    // Select "half_leave"
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'half_leave' } });

    // Helper text must now be visible
    await waitFor(() => {
      const helperElements = screen.getAllByText('آدھی چھٹی والے دن صرف وہ منٹ لکھیں جو آدھی چھٹی کے علاوہ ہوں۔');
      expect(helperElements.length).toBeGreaterThan(0);
      expect(helperElements[0]).toBeInTheDocument();
    });
  });

  it('preserves late and early minutes inputs enabled when status is "half_leave"', async () => {
    render(<Attendance />);

    const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
    fireEvent.click(staffTabBtn);

    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'half_leave' } });

    // In checkin mode, late minutes input should not be disabled
    const inputs = screen.getAllByRole('spinbutton'); // number inputs for minutes
    const lateMinutesInput = inputs[0];
    expect(lateMinutesInput).not.toBeDisabled();

    // Type 20 minutes late
    fireEvent.change(lateMinutesInput, { target: { value: '20' } });
    expect(lateMinutesInput.value).toBe('20');
  });

  it('accurately counts half_leave as 0.5 present and 0.5 leave in daily summary strip', async () => {
    render(<Attendance />);

    const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
    fireEvent.click(staffTabBtn);

    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    // Switch to half_leave
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'half_leave' } });

    // Verify daily summary stats
    expect(screen.getAllByText('آدھی چھٹی').length).toBeGreaterThanOrEqual(2);
    // Fractional 0.5 present and 0.5 leave
    const halfValues = screen.getAllByText('0.5');
    expect(halfValues.length).toBeGreaterThanOrEqual(2); // One for present equivalent, one for leave equivalent
  });
});
