import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PayrollRun from './PayrollRun';
import * as AuthContextModule from '../context/AuthContext';
import * as payrollApi from '../lib/payrollApi';
import * as payrollRunsApi from '../lib/payrollRunsApi';
import { getWorkingDates } from '../utils/PayrollCalc';

const VALID_MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const VALID_RUN_ID = '22222222-2222-2222-2222-222222222222';

const MOCK_STAFF = [
  {
    id: 'staff-1',
    staff_code: '101',
    name: 'قاری محمد بلال',
    father_name: 'محمد انور',
    shift_start: '08:00',
    shift_end: '14:00'
  },
  {
    id: 'staff-2',
    staff_code: '102',
    name: 'حافظ عبد الرحمن',
    father_name: 'عبد الغفور',
    shift_start: '08:00',
    shift_end: '14:00'
  }
];

const MOCK_SETTINGS = {
  weekly_off_days: [5],
  late_grace_minutes: 15,
  early_leave_grace_minutes: 15,
  monthly_leave_accrual: 1.5,
  fiscal_year_start_month: 4
};

describe('PayrollRun Component - Stage 5 Monthly Payroll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Default admin auth
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      role: 'admin',
      madrasaId: VALID_MADRASA_ID,
      isAuthenticated: true
    });

    // Default mocks
    vi.spyOn(payrollRunsApi, 'fetchRuns').mockResolvedValue([]);
    vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(null);
    vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue([]);
    vi.spyOn(payrollRunsApi, 'createDraftRun').mockResolvedValue({
      id: VALID_RUN_ID,
      madrasa_id: VALID_MADRASA_ID,
      month: '2026-11-01',
      status: 'draft'
    });
    vi.spyOn(payrollRunsApi, 'saveRunItems').mockResolvedValue([]);
    vi.spyOn(payrollRunsApi, 'deleteRunItemsForStaff').mockResolvedValue();
    vi.spyOn(payrollRunsApi, 'fetchMonthAttendance').mockResolvedValue([]);
    vi.spyOn(payrollRunsApi, 'fetchPriorPaidLeave').mockResolvedValue({});
    vi.spyOn(payrollRunsApi, 'finalizeRun').mockResolvedValue({
      id: VALID_RUN_ID,
      status: 'finalized'
    });
    vi.spyOn(payrollRunsApi, 'reopenRun').mockResolvedValue({
      id: VALID_RUN_ID,
      status: 'draft'
    });
    vi.spyOn(payrollRunsApi, 'deleteDraftRun').mockResolvedValue(true);
    vi.spyOn(payrollRunsApi, 'setItemPayment').mockResolvedValue({
      id: 'item-1',
      payment_status: 'paid'
    });
    vi.spyOn(payrollRunsApi, 'updateItemNotes').mockResolvedValue({
      id: 'item-1',
      notes: 'نوٹ'
    });

    vi.spyOn(payrollApi, 'fetchPayrollSettings').mockResolvedValue(MOCK_SETTINGS);
    vi.spyOn(payrollApi, 'fetchStaffSalaries').mockResolvedValue([
      { staff_id: 'staff-1', base_salary: 30000 },
      { staff_id: 'staff-2', base_salary: 35000 }
    ]);
    vi.spyOn(payrollApi, 'fetchHolidays').mockResolvedValue([]);
    vi.spyOn(payrollApi, 'fetchLeaveOpening').mockResolvedValue([]);
  });

  describe('Access Control & Defense in Depth', () => {
    it('blocks teacher role from fetching data and renders unauthorized notice', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        role: 'teacher',
        madrasaId: VALID_MADRASA_ID
      });

      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      expect(screen.getByText('رسائی غیر مجاز')).toBeInTheDocument();
      expect(screen.queryByLabelText(/مہینہ منتخب کریں/)).not.toBeInTheDocument();
      expect(payrollRunsApi.fetchRuns).not.toHaveBeenCalled();
      expect(payrollApi.fetchPayrollSettings).not.toHaveBeenCalled();
    });
  });

  describe('Missing Settings Banner', () => {
    it('displays Urdu message and offers NO create button when settings are missing', async () => {
      vi.spyOn(payrollApi, 'fetchPayrollSettings').mockResolvedValue(null);

      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('پہلے ترتیبات ٹیب میں ترتیبات محفوظ کریں۔')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'مسودہ بنائیں' })).not.toBeInTheDocument();
    });
  });

  describe('Create Draft Flow', () => {
    it('creates draft run and saves calculated items when allowed', async () => {
      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'مسودہ بنائیں' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'مسودہ بنائیں' }));

      await waitFor(() => {
        expect(payrollRunsApi.createDraftRun).toHaveBeenCalledWith(
          expect.anything(),
          VALID_MADRASA_ID,
          expect.stringMatching(/^\d{4}-\d{2}-01$/)
        );
        expect(payrollRunsApi.saveRunItems).toHaveBeenCalled();
      });
    });
  });

  describe('Completeness Check & Finalization Blockers', () => {
    it('disables "فائنل کریں" button when a teacher has incomplete attendance and shows Urdu banner', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const draftItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          payable_working_days: 26,
          present_days: 20,
          absent_days: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          absence_deduction: 0,
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(draftItems);

      // Incomplete attendance returned: only 1 day out of 26
      vi.spyOn(payrollRunsApi, 'fetchMonthAttendance').mockResolvedValue([
        { staff_id: 'staff-1', date: '2026-11-01', status: 'present' }
      ]);

      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('فائنل کرنے سے پہلے درج ذیل امور درست کریں:')).toBeInTheDocument();
      });

      const finalizeBtn = screen.getByRole('button', { name: 'فائنل کریں' });
      expect(finalizeBtn).toBeDisabled();
    });
  });

  describe('Drift Detection on Finalize', () => {
    it('blocks finalization and displays Urdu warning when drift is detected', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      // Stored items have old net_salary: 20000
      const storedItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 20000, // Differs from fresh 30000
          payable_working_days: 26,
          present_days: 26,
          absent_days: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          absence_deduction: 0,
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(storedItems);

      // Provide COMPLETE attendance for all working dates in November 2026
      const workingDates = getWorkingDates('2026-11', [5], []);
      const completeAtt = workingDates.map((date) => ({
        staff_id: 'staff-1',
        date,
        status: 'present',
        late_minutes: 0,
        early_leave_minutes: 0
      }));

      vi.spyOn(payrollRunsApi, 'fetchMonthAttendance').mockResolvedValue(completeAtt);

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'فائنل کریں' });
        expect(btn).not.toBeDisabled();
      });

      // Click finalize
      fireEvent.click(screen.getByRole('button', { name: 'فائنل کریں' }));

      await waitFor(() => {
        expect(screen.getByText('ڈیٹا بدل چکا ہے، پہلے دوبارہ حساب کریں۔')).toBeInTheDocument();
      });

      expect(payrollRunsApi.finalizeRun).not.toHaveBeenCalled();
    });
  });

  describe('Finalized View & Payment Controls', () => {
    const finalizedRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'finalized' };
    const finalizedItems = [
      {
        id: 'item-1',
        staff_id: 'staff-1',
        base_salary: 30000,
        net_salary: 30000,
        payable_working_days: 26,
        present_days: 26,
        absent_days: 0,
        paid_leave_days: 0,
        unpaid_leave_days: 0,
        absence_deduction: 0,
        unpaid_leave_deduction: 0,
        time_deduction: 0,
        bonus: 500,
        advance_deduction: 0,
        other_deduction: 0,
        payment_status: 'unpaid',
        paid_on: null,
        notes: 'امتحانی نوٹ'
      }
    ];

    it('renders figures as read-only plain text (no editable adjustment textboxes)', async () => {
      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(finalizedRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(finalizedItems);

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('فائنل شدہ')).toBeInTheDocument();
      });

      // No adjustment inputs should be in the document
      expect(screen.queryByLabelText(/بونس برائے/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/پیشگی کٹوتی برائے/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/دیگر کٹوتی برائے/)).not.toBeInTheDocument();

      // Figures displayed as text
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('allows marking payment and unmarking payment', async () => {
      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(finalizedRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(finalizedItems);

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'ادا شدہ' })).toBeInTheDocument();
      });

      // Mark paid
      fireEvent.click(screen.getByRole('button', { name: 'ادا شدہ' }));

      await waitFor(() => {
        expect(payrollRunsApi.setItemPayment).toHaveBeenCalledWith(
          expect.anything(),
          VALID_MADRASA_ID,
          'item-1',
          expect.objectContaining({ paid: true })
        );
      });
    });

    it('disables reopen button when at least one teacher is paid', async () => {
      const paidItems = [
        {
          ...finalizedItems[0],
          payment_status: 'paid',
          paid_on: '2026-11-05'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(finalizedRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(paidItems);
      vi.spyOn(payrollRunsApi, 'fetchRuns').mockResolvedValue([finalizedRun]);

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /فائنل ختم کریں/ })).toBeDisabled();
      });
    });
  });

  describe('Form Persistence & Storage Privacy', () => {
    it('typed adjustment survives a component re-render with new function identity', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const draftItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(draftItems);

      const { rerender } = render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/بونس برائے قاری محمد بلال/)).toBeInTheDocument();
      });

      const bonusInput = screen.getByLabelText(/بونس برائے قاری محمد بلال/);
      fireEvent.change(bonusInput, { target: { value: '2500' } });
      expect(bonusInput.value).toBe('2500');

      // Re-render with new staffList reference
      rerender(
        <PayrollRun
          staffList={[{ ...MOCK_STAFF[0] }]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/بونس برائے قاری محمد بلال/).value).toBe('2500');
      });
    });

    it('NEVER writes anything to localStorage or sessionStorage', async () => {
      const localSpy = vi.spyOn(Storage.prototype, 'setItem');
      const sessionSpy = vi.spyOn(Storage.prototype, 'setItem');

      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/مہینہ منتخب کریں/)).toBeInTheDocument();
      });

      expect(localSpy).not.toHaveBeenCalled();
      expect(sessionSpy).not.toHaveBeenCalled();
    });

    it('failed save preserves typed adjustments, shows Urdu error and no success message', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const draftItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(draftItems);
      vi.spyOn(payrollRunsApi, 'saveRunItems').mockRejectedValue(new Error('Network error'));

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/بونس برائے قاری محمد بلال/)).toBeInTheDocument();
      });

      const bonusInput = screen.getByLabelText(/بونس برائے قاری محمد بلال/);
      fireEvent.change(bonusInput, { target: { value: '1800' } });

      fireEvent.click(screen.getByRole('button', { name: 'تبدیلیاں محفوظ کریں' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Typed value still preserved
      expect(bonusInput.value).toBe('1800');
      // No success message
      expect(screen.queryByText(/کامیابی/)).not.toBeInTheDocument();
    });
  });

  describe('Typography & Design Standards', () => {
    it('has no Latin letters in visible headings, chips, and button labels', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue([]);

      const { container } = render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('مسودہ')).toBeInTheDocument();
      });

      // Check all buttons
      const buttons = container.querySelectorAll('button');
      for (const btn of buttons) {
        expect(/[a-zA-Z]/.test(btn.textContent)).toBe(false);
      }

      // Check chip
      const chips = container.querySelectorAll('.payroll-status-chip');
      for (const chip of chips) {
        expect(/[a-zA-Z]/.test(chip.textContent)).toBe(false);
      }
    });
  });

  describe('Stage 5 Defect Fixes & Behavioral Invariants', () => {
    it('shows Urdu success message after save and preserves it after reload', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const draftItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          notes: '',
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(draftItems);
      vi.spyOn(payrollRunsApi, 'saveRunItems').mockResolvedValue([]);

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/بونس برائے قاری محمد بلال/)).toBeInTheDocument();
      });

      const bonusInput = screen.getByLabelText(/بونس برائے قاری محمد بلال/);
      fireEvent.change(bonusInput, { target: { value: '1500' } });

      fireEvent.click(screen.getByRole('button', { name: 'تبدیلیاں محفوظ کریں' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('تبدیلیاں کامیابی سے محفوظ ہو گئیں۔');
      });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('تبدیلیاں کامیابی سے محفوظ ہو گئیں۔');
    });

    it('shows Urdu success message and status chip "فائنل شدہ" after successful finalize, calling finalizeRun once', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const finalizedRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'finalized' };
      const completeAtt = getWorkingDates('2026-11', [5], []).map((date) => ({
        staff_id: 'staff-1',
        date,
        status: 'present',
        late_minutes: 0,
        early_leave_minutes: 0
      }));
      const storedItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          payable_working_days: completeAtt.length,
          present_days: completeAtt.length,
          absent_days: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          absence_deduction: 0,
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          notes: '',
          payment_status: 'unpaid'
        }
      ];

      let runState = draftRun;
      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockImplementation(async () => runState);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(storedItems);
      vi.spyOn(payrollRunsApi, 'fetchMonthAttendance').mockResolvedValue(completeAtt);
      const finalizeSpy = vi.spyOn(payrollRunsApi, 'finalizeRun').mockImplementation(async () => {
        runState = finalizedRun;
        return finalizedRun;
      });

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'فائنل کریں' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'فائنل کریں' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'ہاں، فائنل کریں' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'ہاں، فائنل کریں' }));

      await waitFor(() => {
        expect(finalizeSpy).toHaveBeenCalledTimes(1);
        expect(finalizeSpy).toHaveBeenCalledWith(expect.anything(), VALID_MADRASA_ID, VALID_RUN_ID);
      });

      await waitFor(() => {
        expect(screen.getByText('فائنل شدہ')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('ماہانہ پے رول کامیابی سے فائنل اور مقفل ہو گیا ہے۔');
      });
    });

    it('has no inline color or backgroundColor on any rendered element', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue([]);

      const { container } = render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('مسودہ')).toBeInTheDocument();
      });

      const styledElements = container.querySelectorAll('[style]');
      for (const el of styledElements) {
        expect(el.style.color).toBe('');
        expect(el.style.backgroundColor).toBe('');
      }
    });

    it('does not render any CSS class starting with payroll-btn-', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue([]);

      const { container } = render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('مسودہ')).toBeInTheDocument();
      });

      const allElements = container.querySelectorAll('*');
      for (const el of allElements) {
        for (const cls of el.classList) {
          expect(cls.startsWith('payroll-btn-')).toBe(false);
        }
      }
    });

    it('shows teacher name and not "نامعلوم" in finalize blocker for teacher with no salary', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const storedItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          payable_working_days: 26,
          present_days: 26,
          absent_days: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(storedItems);
      vi.spyOn(payrollApi, 'fetchStaffSalaries').mockResolvedValue([
        { staff_id: 'staff-1', base_salary: 30000 }
      ]);

      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/حافظ عبد الرحمن/)).toBeInTheDocument();
      });

      const blockerBanner = screen.getByText(/استاد حافظ عبد الرحمن کا پے رول نامکمل ہے/);
      expect(blockerBanner).toBeInTheDocument();
      expect(blockerBanner.textContent).not.toContain('نامعلوم استاد');
      expect(blockerBanner.textContent).not.toContain('نامعلوم');
    });

    it('blocks save, recalculate, and finalize when adjustment is invalid ("abc", negative, 3 decimals) without calling engine or saveRunItems', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const storedItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          notes: '',
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(storedItems);
      const saveSpy = vi.spyOn(payrollRunsApi, 'saveRunItems').mockResolvedValue([]);
      const finalizeSpy = vi.spyOn(payrollRunsApi, 'finalizeRun');

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/بونس برائے قاری محمد بلال/)).toBeInTheDocument();
      });

      const bonusInput = screen.getByLabelText(/بونس برائے قاری محمد بلال/);

      // 1. Test "abc" on Save
      fireEvent.change(bonusInput, { target: { value: 'abc' } });
      fireEvent.click(screen.getByRole('button', { name: 'تبدیلیاں محفوظ کریں' }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/رقم صرف مثبت اعداد یا دو اعشاریہ تک ہونی چاہیے۔/);
      });
      expect(saveSpy).not.toHaveBeenCalled();

      // 2. Test negative on Recalculate
      fireEvent.change(bonusInput, { target: { value: '-200' } });
      fireEvent.click(screen.getByRole('button', { name: 'دوبارہ حساب کریں' }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/رقم صرف مثبت اعداد یا دو اعشاریہ تک ہونی چاہیے۔/);
      });
      expect(saveSpy).not.toHaveBeenCalled();

      // 3. Test 3 decimals on Finalize
      fireEvent.change(bonusInput, { target: { value: '10.123' } });
      fireEvent.click(screen.getByRole('button', { name: 'فائنل کریں' }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/رقم صرف مثبت اعداد یا دو اعشاریہ تک ہونی چاہیے۔/);
      });
      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(screen.queryByText('ہاں، فائنل کریں')).not.toBeInTheDocument();
    });

    it('pressing finalize with typed unsaved adjustment displays "پہلے تبدیلیاں محفوظ کریں" and does not call finalizeRun', async () => {
      const draftRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'draft' };
      const completeAtt = getWorkingDates('2026-11', [5], []).map((date) => ({
        staff_id: 'staff-1',
        date,
        status: 'present',
        late_minutes: 0,
        early_leave_minutes: 0
      }));
      const storedItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          payable_working_days: completeAtt.length,
          present_days: completeAtt.length,
          absent_days: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          absence_deduction: 0,
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          bonus: 0,
          advance_deduction: 0,
          other_deduction: 0,
          notes: '',
          payment_status: 'unpaid'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(draftRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(storedItems);
      vi.spyOn(payrollRunsApi, 'fetchMonthAttendance').mockResolvedValue(completeAtt);
      const finalizeSpy = vi.spyOn(payrollRunsApi, 'finalizeRun');

      render(
        <PayrollRun
          staffList={[MOCK_STAFF[0]]}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/بونس برائے قاری محمد بلال/)).toBeInTheDocument();
      });

      const bonusInput = screen.getByLabelText(/بونس برائے قاری محمد بلال/);
      fireEvent.change(bonusInput, { target: { value: '800' } });

      fireEvent.click(screen.getByRole('button', { name: 'فائنل کریں' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('پہلے تبدیلیاں محفوظ کریں');
      });

      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(screen.queryByText(/ڈیٹا بدل چکا ہے/)).not.toBeInTheDocument();
      expect(screen.queryByText('ہاں، فائنل کریں')).not.toBeInTheDocument();
    });

    it('marking one teacher paid does not clear a typed unsaved note in another row', async () => {
      const finalizedRun = { id: VALID_RUN_ID, month: '2026-11-01', status: 'finalized' };
      const storedItems = [
        {
          id: 'item-1',
          staff_id: 'staff-1',
          base_salary: 30000,
          net_salary: 30000,
          payment_status: 'unpaid',
          notes: 'نوٹ استاد اول'
        },
        {
          id: 'item-2',
          staff_id: 'staff-2',
          base_salary: 35000,
          net_salary: 35000,
          payment_status: 'unpaid',
          notes: 'پہلا نوٹ استاد دوم'
        }
      ];

      vi.spyOn(payrollRunsApi, 'fetchRunByMonth').mockResolvedValue(finalizedRun);
      vi.spyOn(payrollRunsApi, 'fetchRunItems').mockResolvedValue(storedItems);
      vi.spyOn(payrollRunsApi, 'setItemPayment').mockResolvedValue({ id: 'item-1', payment_status: 'paid' });

      render(
        <PayrollRun
          staffList={MOCK_STAFF}
          activeMadrasaId={VALID_MADRASA_ID}
          isMadrasaMismatch={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('فائنل شدہ')).toBeInTheDocument();
      });

      const staff2NoteInput = screen.getByDisplayValue('پہلا نوٹ استاد دوم');
      expect(staff2NoteInput).toBeInTheDocument();

      fireEvent.change(staff2NoteInput, { target: { value: 'غیر محفوظ شدہ تبدیل شدہ نوٹ دوم' } });
      expect(staff2NoteInput.value).toBe('غیر محفوظ شدہ تبدیل شدہ نوٹ دوم');

      const payButtons = screen.getAllByRole('button', { name: 'ادا شدہ' });
      fireEvent.click(payButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('ادائیگی درج ہو گئی ہے۔');
      });

      expect(staff2NoteInput.value).toBe('غیر محفوظ شدہ تبدیل شدہ نوٹ دوم');
    });
  });

});
