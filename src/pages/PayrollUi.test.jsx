import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainLayout } from '../App';
import Payroll from './Payroll';
import * as AuthContextModule from '../context/AuthContext';
import * as MadrasaContextModule from '../context/MadrasaContext';
import * as payrollApi from '../lib/payrollApi';

const VALID_MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_STAFF = [
  {
    id: 'staff-uuid-1',
    staff_code: 101,
    name: 'قاری محمد بلال',
    father_name: 'محمد انور',
    shift_start: '06:50',
    shift_end: '14:45'
  },
  {
    id: 'staff-uuid-2',
    staff_code: 102,
    name: 'حافظ عبد الرحمن',
    father_name: 'عبد الغفور',
    shift_start: '08:00',
    shift_end: '16:00'
  }
];

describe('Payroll UI & Access Control Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Role-gating & Navigation Access Control', () => {
    it('blocks teacher role: "تنخواہ" tab is NOT visible in navigation and typing /payroll URL is blocked', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'teacher-user-id', email: 'teacher@test.com' },
        isAuthenticated: true,
        loading: false,
        role: 'teacher',
        profile: { full_name: 'استاد بلال' },
        signOut: vi.fn()
      });

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم', status: 'active' },
        madrasas: [{ id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم' }],
        madrasaLoading: false,
        pendingSyncCount: 0,
        madrasaError: null,
        fetchStaffFromSupabase: vi.fn().mockResolvedValue(MOCK_STAFF)
      });

      render(
        <MemoryRouter initialEntries={['/payroll']}>
          <MainLayout />
        </MemoryRouter>
      );

      // Verify "تنخواہ" tab is NOT present in the main navigation
      expect(screen.queryByRole('link', { name: 'تنخواہ' })).not.toBeInTheDocument();

      // Verify ProtectedRoute displays unauthorized block
      expect(screen.getByText(/رسائی غیر مجاز/i)).toBeInTheDocument();
      expect(screen.queryByText('تنخواہ و ترتیبات کا انتظام')).not.toBeInTheDocument();
    });

    it('allows admin role: "تنخواہ" tab is visible in navigation and /payroll loads successfully', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'admin-user-id', email: 'admin@test.com' },
        isAuthenticated: true,
        loading: false,
        role: 'admin',
        profile: { full_name: 'مہتمم صاحب' },
        signOut: vi.fn()
      });

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم', status: 'active' },
        madrasas: [{ id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم' }],
        madrasaLoading: false,
        pendingSyncCount: 0,
        madrasaError: null,
        fetchStaffFromSupabase: vi.fn().mockResolvedValue(MOCK_STAFF)
      });

      vi.spyOn(payrollApi, 'fetchStaffSalaries').mockResolvedValue([
        { staff_id: 'staff-uuid-1', base_salary: 30000 }
      ]);
      vi.spyOn(payrollApi, 'fetchPayrollSettings').mockResolvedValue({
        madrasa_id: VALID_MADRASA_ID,
        weekly_off_days: [5],
        late_grace_minutes: 10,
        early_leave_grace_minutes: 5,
        monthly_leave_accrual: 1.5,
        fiscal_year_start_month: 4
      });
      vi.spyOn(payrollApi, 'fetchHolidays').mockResolvedValue([]);
      vi.spyOn(payrollApi, 'fetchLeaveOpening').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/payroll']}>
          <MainLayout />
        </MemoryRouter>
      );

      // Admin sees navigation link
      expect(screen.getByRole('link', { name: 'تنخواہ' })).toBeInTheDocument();

      // Header is rendered
      await waitFor(() => {
        expect(screen.getByText('تنخواہ و ترتیبات کا انتظام')).toBeInTheDocument();
      });
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });
  });

  describe('Payroll Component Functionality', () => {
    beforeEach(() => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'admin-id' },
        isAuthenticated: true,
        loading: false,
        role: 'admin',
        madrasaId: VALID_MADRASA_ID
      });

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم' },
        fetchStaffFromSupabase: vi.fn().mockResolvedValue(MOCK_STAFF)
      });

      vi.spyOn(payrollApi, 'fetchStaffSalaries').mockResolvedValue([
        { staff_id: 'staff-uuid-1', base_salary: 32000 }
      ]);
      vi.spyOn(payrollApi, 'fetchPayrollSettings').mockResolvedValue({
        madrasa_id: VALID_MADRASA_ID,
        weekly_off_days: [5],
        late_grace_minutes: 10,
        early_leave_grace_minutes: 5,
        monthly_leave_accrual: 1.5,
        fiscal_year_start_month: 4
      });
      vi.spyOn(payrollApi, 'fetchHolidays').mockResolvedValue([
        { id: 'h-1', holiday_date: '2026-08-14', title: 'یوم آزادی' }
      ]);
      vi.spyOn(payrollApi, 'fetchLeaveOpening').mockResolvedValue([]);
    });

    it('shows salary input validation message when entering negative or invalid salary', async () => {
      render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      // Find input for the first teacher
      const salaryInput = screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال');
      fireEvent.change(salaryInput, { target: { value: '-500' } });

      const saveBtn = screen.getByRole('button', { name: 'محفوظ کریں' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('تنخواہ ایک درست عدد ہونی چاہیے');
      });
    });

    it('toggles weekly off checkboxes in Settings tab', async () => {
      render(<Payroll />);

      // Switch to Settings subtab
      const settingsTab = screen.getByRole('tab', { name: 'ترتیبات' });
      fireEvent.click(settingsTab);

      await waitFor(() => {
        expect(screen.getByText('ہفتہ وار تعطیلات')).toBeInTheDocument();
      });

      // Check Friday checkbox (index 5)
      const fridayCheckbox = screen.getByLabelText('جمعہ');
      expect(fridayCheckbox.checked).toBe(true);

      // Check Sunday checkbox (index 0)
      const sundayCheckbox = screen.getByLabelText('اتوار');
      expect(sundayCheckbox.checked).toBe(false);

      fireEvent.click(sundayCheckbox);
      expect(sundayCheckbox.checked).toBe(true);
    });

    it('displays clear Urdu message when adding holiday with duplicate date (code 23505)', async () => {
      vi.spyOn(payrollApi, 'addHoliday').mockRejectedValue({
        code: '23505',
        message: 'duplicate key value violates unique constraint'
      });

      render(<Payroll />);

      // Switch to Holidays subtab
      const holidaysTab = screen.getByRole('tab', { name: 'تعطیلات' });
      fireEvent.click(holidaysTab);

      await waitFor(() => {
        expect(screen.getByText('نئی تعطیل شامل کریں')).toBeInTheDocument();
      });

      const dateInput = screen.getByLabelText('تاریخ');
      const titleInput = screen.getByLabelText('تعطیل کا عنوان');

      fireEvent.change(dateInput, { target: { value: '2026-08-14' } });
      fireEvent.change(titleInput, { target: { value: 'یوم آزادی' } });

      const submitBtn = screen.getByRole('button', { name: 'تعطیل شامل کریں' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('اس تاریخ کے لیے پہلے سے تعطیل درج ہے۔');
      });
    });

    it('handles failed salary save: shows error banner, keeps inputs visible, and shows NO success text', async () => {
      vi.spyOn(payrollApi, 'upsertStaffSalaries').mockRejectedValue(
        new Error('ڈیٹا بیس میں اندراج کی اجازت نہیں ہے (RLS Policy Error)')
      );

      render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const salaryInput = screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال');
      fireEvent.change(salaryInput, { target: { value: '45000' } });

      const saveBtn = screen.getByRole('button', { name: 'محفوظ کریں' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('ڈیٹا بیس میں اندراج کی اجازت نہیں ہے');
      });

      // Verifications:
      // 1. Success message must NOT be shown
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // 2. Unsaved inputs remain visible
      expect(salaryInput.value).toBe('45000');
    });

    it('confirms salary data is NEVER written to localStorage or sessionStorage', async () => {
      const localSetSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      // Modify salary
      const salaryInput = screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال');
      fireEvent.change(salaryInput, { target: { value: '55000' } });

      vi.spyOn(payrollApi, 'upsertStaffSalaries').mockResolvedValue([
        { staff_id: 'staff-uuid-1', base_salary: 55000 }
      ]);

      const saveBtn = screen.getByRole('button', { name: 'محفوظ کریں' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('کامیابی سے محفوظ ہو گیا');
      });

      // Check all storage calls
      const calls = localSetSpy.mock.calls;
      for (const [key, value] of calls) {
        expect(key).not.toContain('salary');
        expect(key).not.toContain('payroll');
        expect(String(value)).not.toContain('55000');
      }

      // Check localStorage and sessionStorage contents
      expect(localStorage.getItem('hf_salaries')).toBeNull();
      expect(localStorage.getItem('hf_payroll_settings')).toBeNull();
      expect(sessionStorage.getItem('hf_salaries')).toBeNull();
    });

    it('changing holiday year filter does NOT call fetchStaffSalaries or fetchPayrollSettings again and does NOT clear typed, unsaved salary input', async () => {
      render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      // Type an unsaved salary
      const salaryInput = screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال');
      fireEvent.change(salaryInput, { target: { value: '47500' } });
      expect(salaryInput.value).toBe('47500');

      // Clear spy calls from initial mount
      payrollApi.fetchStaffSalaries.mockClear();
      payrollApi.fetchPayrollSettings.mockClear();
      payrollApi.fetchHolidays.mockClear();

      // Switch to Holidays subtab
      const holidaysTab = screen.getByRole('tab', { name: 'تعطیلات' });
      fireEvent.click(holidaysTab);

      await waitFor(() => {
        expect(screen.getByText('نئی تعطیل شامل کریں')).toBeInTheDocument();
      });

      // Change holiday year filter
      const currentYear = new Date().getFullYear();
      const filterSelect = screen.getByLabelText('سال کا فلٹر:');
      fireEvent.change(filterSelect, { target: { value: String(currentYear + 1) } });

      await waitFor(() => {
        expect(payrollApi.fetchHolidays).toHaveBeenCalledWith(
          expect.anything(),
          VALID_MADRASA_ID,
          String(currentYear + 1)
        );
      });

      // Verify fetchStaffSalaries and fetchPayrollSettings were NOT called again
      expect(payrollApi.fetchStaffSalaries).not.toHaveBeenCalled();
      expect(payrollApi.fetchPayrollSettings).not.toHaveBeenCalled();

      // Switch back to Salary subtab
      const salaryTab = screen.getByRole('tab', { name: 'تنخواہ کا اندراج' });
      fireEvent.click(salaryTab);

      // Verify typed unsaved input is still intact
      const retainedSalaryInput = screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال');
      expect(retainedSalaryInput.value).toBe('47500');
    });

    it('re-rendering with a new fetchStaffFromSupabase function identity does NOT refetch or clear typed input', async () => {
      let fetchStaffFn = vi.fn().mockResolvedValue(MOCK_STAFF);

      const spy = vi.spyOn(MadrasaContextModule, 'useMadrasa').mockImplementation(() => ({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم' },
        fetchStaffFromSupabase: fetchStaffFn
      }));

      const { rerender } = render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const salaryInput = screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال');
      fireEvent.change(salaryInput, { target: { value: '52000' } });
      expect(salaryInput.value).toBe('52000');

      payrollApi.fetchStaffSalaries.mockClear();
      payrollApi.fetchPayrollSettings.mockClear();

      // Trigger re-render with a newly instantiated function reference
      fetchStaffFn = vi.fn().mockResolvedValue(MOCK_STAFF);
      spy.mockImplementation(() => ({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم' },
        fetchStaffFromSupabase: fetchStaffFn
      }));

      rerender(<Payroll />);

      // fetchStaffSalaries should NOT have been refetched
      expect(payrollApi.fetchStaffSalaries).not.toHaveBeenCalled();
      expect(payrollApi.fetchPayrollSettings).not.toHaveBeenCalled();

      // Typed input is preserved
      expect(screen.getByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال').value).toBe('52000');
    });

    it('editing fiscal month in settings (unsaved) does not change leave-opening fiscal year and triggers no fetch; saving leave opening uses savedFiscalStartMonth', async () => {
      vi.spyOn(payrollApi, 'upsertLeaveOpening').mockResolvedValue([
        { staff_id: 'staff-uuid-1', used_days: 3.5, fiscal_year_start: '2026-04-01' }
      ]);

      render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      // Switch to Settings tab
      const settingsTab = screen.getByRole('tab', { name: 'ترتیبات' });
      fireEvent.click(settingsTab);

      await waitFor(() => {
        expect(screen.getByText('ہفتہ وار تعطیلات')).toBeInTheDocument();
      });

      payrollApi.fetchLeaveOpening.mockClear();

      // Edit fiscal month dropdown to 7 (July) without saving
      const monthSelect = screen.getByLabelText('مالی سال کا ابتدائی مہینہ');
      fireEvent.change(monthSelect, { target: { value: '7' } });

      // Settings tab preview indicator should appear
      expect(screen.getByText(/پیش نظارہ/)).toBeInTheDocument();

      // Changing dropdown must NOT have triggered any fetch
      expect(payrollApi.fetchLeaveOpening).not.toHaveBeenCalled();

      // Switch to Leave Opening tab
      const leaveOpeningTab = screen.getByRole('tab', { name: 'چھٹیوں کا ابتدائی حساب' });
      fireEvent.click(leaveOpeningTab);

      await waitFor(() => {
        expect(screen.getByText(/مالی سال کی ابتدا:/)).toBeInTheDocument();
      });

      // Fiscal year range helper text must still reflect saved month 4 (April), NOT unsaved 7 (July)
      expect(screen.getByText(/1 اپریل/)).toBeInTheDocument();
      expect(screen.queryByText(/1 جولائی/)).not.toBeInTheDocument();

      // Edit leave opening input for staff 1
      const leaveInput = screen.getByLabelText('استعمال شدہ چھٹیاں برائے قاری محمد بلال');
      fireEvent.change(leaveInput, { target: { value: '3.5' } });

      const saveLeaveBtn = screen.getByRole('button', { name: 'چھٹیوں کا ابتدائی حساب محفوظ کریں' });
      fireEvent.click(saveLeaveBtn);

      await waitFor(() => {
        expect(payrollApi.upsertLeaveOpening).toHaveBeenCalledTimes(1);
      });

      // Must have used savedFiscalStartMonth (2026-04-01), NOT 2026-07-01
      expect(payrollApi.upsertLeaveOpening).toHaveBeenCalledWith(
        expect.anything(),
        VALID_MADRASA_ID,
        expect.arrayContaining([
          expect.objectContaining({
            staff_id: 'staff-uuid-1',
            used_days: 3.5,
            fiscal_year_start: '2026-04-01'
          })
        ])
      );
    });

    it('shows the mismatch banner and hides salary inputs when authMadrasaId is null', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'super-admin-user' },
        isAuthenticated: true,
        loading: false,
        role: 'super_admin',
        madrasaId: null
      });

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'جامعہ دار العلوم' },
        fetchStaffFromSupabase: vi.fn().mockResolvedValue(MOCK_STAFF)
      });

      render(<Payroll />);

      await waitFor(() => {
        expect(
          screen.getByText('آپ کا اکاؤنٹ اس ادارے سے منسلک نہیں، اس لیے تنخواہ کا ڈیٹا نظر نہیں آئے گا۔')
        ).toBeInTheDocument();
      });

      // Inputs for salary are hidden
      expect(screen.queryByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'محفوظ کریں' })).not.toBeInTheDocument();
    });

    it('shows the mismatch banner when authMadrasaId differs from activeMadrasaId', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'super-admin-user' },
        isAuthenticated: true,
        loading: false,
        role: 'super_admin',
        madrasaId: 'other-home-madrasa-uuid'
      });

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: VALID_MADRASA_ID,
        activeMadrasa: { id: VALID_MADRASA_ID, name: 'دوسرا ادارہ' },
        fetchStaffFromSupabase: vi.fn().mockResolvedValue(MOCK_STAFF)
      });

      render(<Payroll />);

      await waitFor(() => {
        expect(
          screen.getByText('آپ کا اکاؤنٹ اس ادارے سے منسلک نہیں، اس لیے تنخواہ کا ڈیٹا نظر نہیں آئے گا۔')
        ).toBeInTheDocument();
      });

      // Inputs for salary are hidden
      expect(screen.queryByLabelText('ماہانہ تنخواہ برائے قاری محمد بلال')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'محفوظ کریں' })).not.toBeInTheDocument();
    });

    it('holidays table shows the correct Urdu weekday for 2026-08-14 (جمعہ)', async () => {
      render(<Payroll />);

      // Switch to Holidays subtab
      const holidaysTab = screen.getByRole('tab', { name: 'تعطیلات' });
      fireEvent.click(holidaysTab);

      await waitFor(() => {
        expect(screen.getByText('نئی تعطیل شامل کریں')).toBeInTheDocument();
      });

      // Date, Urdu weekday (جمعہ), and Title are present in table
      expect(screen.getByText('2026-08-14')).toBeInTheDocument();
      expect(screen.getByText('جمعہ')).toBeInTheDocument();
      expect(screen.getByText('یوم آزادی')).toBeInTheDocument();
    });

    it('unassigned count element has no inline color style', async () => {
      render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const unassignedTitle = screen.getByText('غیر مقررہ تنخواہ والے اساتذہ');
      const unassignedCard = unassignedTitle.closest('.payroll-summary-card');
      const unassignedValue = unassignedCard.querySelector('.payroll-summary-card-value');

      expect(unassignedValue).toBeInTheDocument();
      expect(unassignedValue.style.color).toBe('');
      expect(unassignedValue.getAttribute('style')).toBeFalsy();
    });

    it('asserts that no visible English parentheticals remain on any tab', async () => {
      const { container } = render(<Payroll />);

      await waitFor(() => {
        expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
      });

      const oldEnglishStrings = [
        '(Weekly Off Days)',
        '(Days)',
        '(Unauthorized)',
        '(Invalid Madrasa ID)',
        '(Supabase client not provided)',
        '(Invalid Staff ID)',
        '(Invalid Holiday ID)',
        '(Integer)',
        '(Multiple of 0.5)',
        'YYYY-MM-01'
      ];

      // Check Salary tab
      for (const str of oldEnglishStrings) {
        expect(container.textContent).not.toContain(str);
      }

      // Check Settings tab
      fireEvent.click(screen.getByRole('tab', { name: 'ترتیبات' }));
      for (const str of oldEnglishStrings) {
        expect(container.textContent).not.toContain(str);
      }

      // Check Holidays tab
      fireEvent.click(screen.getByRole('tab', { name: 'تعطیلات' }));
      for (const str of oldEnglishStrings) {
        expect(container.textContent).not.toContain(str);
      }

      // Check Leave Opening tab
      fireEvent.click(screen.getByRole('tab', { name: 'چھٹیوں کا ابتدائی حساب' }));
      for (const str of oldEnglishStrings) {
        expect(container.textContent).not.toContain(str);
      }
    });
  });
});

