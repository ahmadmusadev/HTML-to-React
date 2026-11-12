import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Attendance from './Attendance';
import * as MadrasaContextModule from '../context/MadrasaContext';
import * as PayrollApiModule from '../lib/payrollApi';
import {
  checkStaffHolidayStatus,
  getDayOfWeekIndex,
  WEEKDAY_NAMES_URDU
} from '../utils/StaffAttendanceMappers';

describe('Staff Attendance Weekly Holiday & Official Holiday Validation', () => {
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
      activeMadrasa: { id: '11111111-1111-1111-1111-111111111111', name: 'جامعہ دارالعلوم' },
      madrasas: [{ id: '11111111-1111-1111-1111-111111111111', name: 'جامعہ دارالعلوم' }],
      classesList: mockClasses,
      setClassesList: vi.fn(),
      loadMadrasaData: vi.fn().mockImplementation((key) => {
        if (key === 'hf_payroll_settings') return { weekly_off_days: [5] };
        return null;
      }),
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

    vi.spyOn(PayrollApiModule, 'fetchPayrollSettings').mockResolvedValue({
      weekly_off_days: [5] // Default Friday
    });
    vi.spyOn(PayrollApiModule, 'fetchHolidays').mockResolvedValue([]);
  });

  describe('Pure Helper Functions', () => {
    it('getDayOfWeekIndex accurately calculates day of week in local time', () => {
      // 2026-11-13 is Friday (day index 5)
      expect(getDayOfWeekIndex('2026-11-13')).toBe(5);
      // 2026-11-14 is Saturday (day index 6)
      expect(getDayOfWeekIndex('2026-11-14')).toBe(6);
      // 2026-11-15 is Sunday (day index 0)
      expect(getDayOfWeekIndex('2026-11-15')).toBe(0);
      // Invalid dates return -1
      expect(getDayOfWeekIndex('')).toBe(-1);
      expect(getDayOfWeekIndex(null)).toBe(-1);
    });

    it('checkStaffHolidayStatus flags Friday as weekly off when weekly_off_days is [5]', () => {
      const result = checkStaffHolidayStatus('2026-11-13', [5]);
      expect(result.isHoliday).toBe(true);
      expect(result.isWeeklyOff).toBe(true);
      expect(result.dayIndex).toBe(5);
      expect(result.dayName).toBe('جمعہ');
      expect(result.title).toContain('ہفتہ وار چھٹی (جمعہ)');
    });

    it('checkStaffHolidayStatus flags Sunday as weekly off when institution chooses Sunday [0]', () => {
      const resultSunday = checkStaffHolidayStatus('2026-11-15', [0]);
      expect(resultSunday.isHoliday).toBe(true);
      expect(resultSunday.isWeeklyOff).toBe(true);
      expect(resultSunday.dayIndex).toBe(0);
      expect(resultSunday.dayName).toBe('اتوار');
      expect(resultSunday.title).toContain('ہفتہ وار چھٹی (اتوار)');

      // On Sunday-off institution, Friday is a working day
      const resultFriday = checkStaffHolidayStatus('2026-11-13', [0]);
      expect(resultFriday.isHoliday).toBe(false);
      expect(resultFriday.isWeeklyOff).toBe(false);
    });

    it('checkStaffHolidayStatus flags official holidays from holidays table', () => {
      const hols = [{ holiday_date: '2026-11-14', title: 'اقبال ڈے' }];
      const result = checkStaffHolidayStatus('2026-11-14', [5], hols);
      expect(result.isHoliday).toBe(true);
      expect(result.isSpecialHoliday).toBe(true);
      expect(result.title).toBe('اقبال ڈے');
    });
  });

  describe('UI Integration in Staff Attendance', () => {
    it('blocks attendance options when Friday (13 Nov 2026) is selected and displays clear Urdu notice', async () => {
      render(<Attendance />);

      // Switch to staff attendance tab
      const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
      fireEvent.click(staffTabBtn);

      // Wait for staff to be loaded initially on working day
      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      // Select 13 Nov 2026 (Friday)
      const dateInput = screen.getByLabelText('تاریخ');
      fireEvent.change(dateInput, { target: { value: '2026-11-13' } });

      await waitFor(() => {
        // Warning banner must be present
        expect(screen.getByText(/منتخب کردہ تاریخ \(2026-11-13 بروز جمعہ\) ادارے کی مقرر کردہ ہفتہ وار چھٹی/)).toBeInTheDocument();
      });

      // Blocked card must be displayed
      expect(screen.getByText('تعطیل کا دن — باقاعدہ حاضری کا اندراج معطل ہے')).toBeInTheDocument();

      // Attendance options/table must NOT be rendered
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      // Save button must NOT be rendered
      expect(screen.queryByRole('button', { name: 'چیک اِن محفوظ کریں' })).not.toBeInTheDocument();
    });

    it('allows unlocking attendance exceptionally via button if madrasa was open on holiday', async () => {
      render(<Attendance />);

      const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
      fireEvent.click(staffTabBtn);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText('تاریخ');
      fireEvent.change(dateInput, { target: { value: '2026-11-13' } });

      await waitFor(() => {
        expect(screen.getByText('تعطیل کا دن — باقاعدہ حاضری کا اندراج معطل ہے')).toBeInTheDocument();
      });

      // Click exception button
      const overrideBtn = screen.getByRole('button', { name: 'اگر ادارہ کھلا تھا تو استثنائی طور پر حاضری درج کریں' });
      fireEvent.click(overrideBtn);

      // Table and save buttons should now appear
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'چیک اِن محفوظ کریں' })).toBeInTheDocument();
        expect(screen.getByText(/استثنائی موڈ فعال ہے/)).toBeInTheDocument();
      });

      // Can lock back
      const lockBackBtn = screen.getByRole('button', { name: 'واپس تعطیل پر لاک کریں' });
      fireEvent.click(lockBackBtn);

      await waitFor(() => {
        expect(screen.getByText('تعطیل کا دن — باقاعدہ حاضری کا اندراج معطل ہے')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });

    it('renders normal working day attendance when Saturday (14 Nov 2026) is selected', async () => {
      render(<Attendance />);

      const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
      fireEvent.click(staffTabBtn);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText('تاریخ');
      fireEvent.change(dateInput, { target: { value: '2026-11-14' } });

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'چیک اِن محفوظ کریں' })).toBeInTheDocument();
        expect(screen.queryByText('تعطیل کا دن — باقاعدہ حاضری کا اندراج معطل ہے')).not.toBeInTheDocument();
      });
    });

    it('adapts when madrasa chooses Sunday as weekly off: Sunday (15 Nov) is blocked and Friday (13 Nov) is allowed', async () => {
      // Mock madrasa settings with Sunday [0] as weekly off
      vi.spyOn(PayrollApiModule, 'fetchPayrollSettings').mockResolvedValue({
        weekly_off_days: [0]
      });

      render(<Attendance />);

      const staffTabBtn = screen.getByRole('button', { name: 'عملے کی حاضری' });
      fireEvent.click(staffTabBtn);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText('تاریخ');

      // 1. Select Sunday 2026-11-15 -> MUST be blocked
      fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

      await waitFor(() => {
        expect(screen.getByText(/منتخب کردہ تاریخ \(2026-11-15 بروز اتوار\) ادارے کی مقرر کردہ ہفتہ وار چھٹی/)).toBeInTheDocument();
        expect(screen.getByText('تعطیل کا دن — باقاعدہ حاضری کا اندراج معطل ہے')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });

      // 2. Select Friday 2026-11-13 -> MUST be open/allowed
      fireEvent.change(dateInput, { target: { value: '2026-11-13' } });

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'چیک اِن محفوظ کریں' })).toBeInTheDocument();
        expect(screen.queryByText('تعطیل کا دن — باقاعدہ حاضری کا اندراج معطل ہے')).not.toBeInTheDocument();
      });
    });
  });
});
