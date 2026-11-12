import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PayrollPrint from './PayrollPrint';
import PayrollRun from './PayrollRun';

// Mock AuthContext
let mockRole = 'admin';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ role: mockRole })
}));

// Mock MadrasaContext for PayrollRun integration
vi.mock('../context/MadrasaContext', () => ({
  useMadrasa: () => ({
    activeMadrasa: { id: 'm-1', name: 'جامعہ دارالعلوم' },
    activeMadrasaId: 'm-1'
  })
}));

// Mock Supabase client
vi.mock('../lib/supabaseClient', () => ({
  supabase: {},
  isValidUUID: (id) => typeof id === 'string' && id.length > 0
}));

// Mock payroll APIs for PayrollRun draft test
vi.mock('../lib/payrollApi', () => ({
  fetchPayrollSettings: vi.fn().mockResolvedValue({
    weekly_off_days: [5],
    shift_start: '08:00',
    shift_end: '14:00'
  }),
  fetchHolidays: vi.fn().mockResolvedValue([]),
  fetchLeaveOpening: vi.fn().mockResolvedValue([]),
  fetchStaffSalaries: vi.fn().mockResolvedValue([])
}));

vi.mock('../lib/payrollRunsApi', () => ({
  fetchRuns: vi.fn().mockResolvedValue([]),
  fetchRunByMonth: vi.fn(),
  fetchRunItems: vi.fn().mockResolvedValue([]),
  saveRunItems: vi.fn(),
  deleteRunItemsForStaff: vi.fn(),
  fetchMonthAttendance: vi.fn().mockResolvedValue([]),
  fetchPriorPaidLeave: vi.fn().mockResolvedValue([]),
  finalizeRun: vi.fn(),
  reopenRun: vi.fn(),
  deleteDraftRun: vi.fn(),
  setItemPayment: vi.fn(),
  updateItemNotes: vi.fn()
}));

describe('PayrollPrint Component - Stage 6b Printable Slips & Reports', () => {
  const runFixture = { id: 'run-1', month_date: '2026-07-01', status: 'finalized' };
  const staffListFixture = [
    { id: 'staff-1', staff_code: '1', name: 'قاری محمد احمد' },
    { id: 'staff-2', staff_code: '2', name: 'مولانا عبد اللہ' }
  ];

  const rowsFixture = [
    {
      id: 'item-1',
      staff_id: 'staff-1',
      base_salary: 30000,
      working_days_in_month: 30,
      payable_working_days: 30,
      day_rate: 1000,
      shift_minutes: 360,
      minute_rate: 2.78,
      present_days: 30,
      absent_days: 0,
      leave_days_taken: 0,
      paid_leave_days: 0,
      unpaid_leave_days: 0,
      leave_balance_after: 5,
      late_minutes_charged: 0,
      early_minutes_charged: 0,
      absence_deduction: 0,
      unpaid_leave_deduction: 0,
      time_deduction: 0,
      leave_encashment_days: 0,
      leave_encashment_amount: 0,
      bonus: 0,
      advance_deduction: 0,
      other_deduction: 0,
      net_salary: 30000,
      payment_status: 'unpaid',
      paid_on: null,
      notes: ''
    },
    {
      id: 'item-2',
      staff_id: 'staff-2',
      base_salary: 28000,
      working_days_in_month: 30,
      payable_working_days: 30,
      day_rate: 933.33,
      shift_minutes: 360,
      minute_rate: 2.59,
      present_days: 29,
      absent_days: 1,
      leave_days_taken: 0,
      paid_leave_days: 0,
      unpaid_leave_days: 0,
      leave_balance_after: 4,
      late_minutes_charged: 0,
      early_minutes_charged: 0,
      absence_deduction: 933.33,
      unpaid_leave_deduction: 0,
      time_deduction: 0,
      leave_encashment_days: 0,
      leave_encashment_amount: 0,
      bonus: 0,
      advance_deduction: 0,
      other_deduction: 0,
      net_salary: 27067,
      payment_status: 'paid',
      paid_on: '2026-08-02',
      notes: ''
    }
  ];

  let printSpy;
  let alertSpy;
  let consoleLogSpy;
  let consoleErrorSpy;
  let localStorageSetSpy;
  let sessionStorageSetSpy;

  beforeEach(() => {
    mockRole = 'admin';
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    sessionStorageSetSpy = vi.spyOn(sessionStorage, 'setItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const portalRoot = document.getElementById('print-portal-root');
    if (portalRoot && portalRoot.parentNode) {
      portalRoot.parentNode.removeChild(portalRoot);
    }
  });

  it('non-admin role renders nothing and does not open print dialog', () => {
    mockRole = 'teacher';
    const { container } = render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={vi.fn()}
      />
    );

    expect(container.innerHTML).toBe('');
    expect(printSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('admin slip renders through PrintPortal and triggers print when data is present', async () => {
    mockRole = 'admin';
    render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={vi.fn()}
      />
    );

    const portalRoot = document.getElementById('print-portal-root');
    expect(portalRoot).toBeTruthy();
    expect(portalRoot.textContent).toContain('تنخواہ کی سلپ');
    expect(portalRoot.textContent).toContain('قاری محمد احمد');
    expect(portalRoot.textContent).toContain('30,000');

    // Trigger frame
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(localStorageSetSpy).not.toHaveBeenCalled();
    expect(sessionStorageSetSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // Fix 3: Re-render with new onClose callback calls print at most once
  it('calls window.print at most once even when parent re-renders with a new onClose function', async () => {
    mockRole = 'admin';
    const onClose1 = vi.fn();
    const { rerender } = render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={onClose1}
      />
    );

    // Initial frame
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(printSpy).toHaveBeenCalledTimes(1);

    // Re-render with a new onClose reference
    const onClose2 = vi.fn();
    rerender(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={onClose2}
      />
    );

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Still exactly 1 call!
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('inconsistent data displays Urdu error banner and does NOT call window.print', async () => {
    mockRole = 'admin';
    const corruptedRows = [
      {
        ...rowsFixture[0],
        net_salary: 99999 // Corrupted net salary
      }
    ];

    render(
      <PayrollPrint
        run={runFixture}
        rows={corruptedRows}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('اعداد و شمار میں فرق ہے، پرنٹ روک دیا گیا')
    ).toBeInTheDocument();
    expect(screen.getByText(/قاری محمد احمد/)).toBeInTheDocument();

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(printSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // Fix 2: Report inconsistency with affected staff names in UI banner
  it('inconsistent report displays Urdu error banner with affected staff names and does not print', async () => {
    mockRole = 'admin';
    const corruptedRows = [
      rowsFixture[0],
      {
        ...rowsFixture[1],
        net_salary: 99999 // Corrupted net salary for مولانا عبد اللہ
      }
    ];

    render(
      <PayrollPrint
        run={runFixture}
        rows={corruptedRows}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'report' }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('اعداد و شمار میں فرق ہے، پرنٹ روک دیا گیا')
    ).toBeInTheDocument();
    expect(screen.getByText(/مولانا عبد اللہ/)).toBeInTheDocument();

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(printSpy).not.toHaveBeenCalled();
  });

  it('portal content is cleaned up after afterprint event', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={onClose}
      />
    );

    // Fire afterprint
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });

    expect(onClose).toHaveBeenCalled();

    // When parent unmounts component
    unmount();
    const portalRoot = document.getElementById('print-portal-root');
    expect(portalRoot ? portalRoot.children.length : 0).toBe(0);
  });

  it('contains no visible English words in rendered slip or report', () => {
    // 1. Slip
    const { unmount: unmountSlip } = render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={vi.fn()}
      />
    );

    const portalRoot = document.getElementById('print-portal-root');
    const slipText = portalRoot ? portalRoot.textContent : '';
    // Digits and punctuation allowed; no English words like "Salary", "Print", "Total"
    const englishWordsInSlip = slipText.match(/[a-zA-Z]{2,}/g) || [];
    expect(englishWordsInSlip).toEqual([]);
    unmountSlip();

    // 2. Report
    render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'report' }}
        onClose={vi.fn()}
      />
    );

    const reportText = portalRoot ? portalRoot.textContent : '';
    const englishWordsInReport = reportText.match(/[a-zA-Z]{2,}/g) || [];
    expect(englishWordsInReport).toEqual([]);
  });

  it('contains no inline style color or background attributes', () => {
    const { container } = render(
      <PayrollPrint
        run={runFixture}
        rows={rowsFixture}
        staffList={staffListFixture}
        madrasaName="جامعہ دارالعلوم"
        target={{ type: 'slip', staffId: 'staff-1' }}
        onClose={vi.fn()}
      />
    );

    const portalRoot = document.getElementById('print-portal-root');
    const allElements = [
      ...Array.from(container.querySelectorAll('*')),
      ...Array.from(portalRoot ? portalRoot.querySelectorAll('*') : [])
    ];

    for (const el of allElements) {
      const styleAttr = el.getAttribute('style') || '';
      expect(styleAttr).not.toMatch(/color/i);
      expect(styleAttr).not.toMatch(/background/i);
    }
  });

  it('shows no print buttons in draft run view of PayrollRun', async () => {
    const draftRun = { id: 'run-draft', month_date: '2026-07-01', status: 'draft' };
    const { fetchRunByMonth } = await import('../lib/payrollRunsApi');
    fetchRunByMonth.mockResolvedValue(draftRun);

    render(
      <PayrollRun
        staffList={staffListFixture}
        activeMadrasaId="m-1"
        isMadrasaMismatch={false}
      />
    );

    // Wait for render
    await screen.findByText('مسودہ');

    // Should NOT have "سلپ", "ماہانہ رپورٹ", or "تمام سلپس" buttons
    expect(screen.queryByText('ماہانہ رپورٹ')).not.toBeInTheDocument();
    expect(screen.queryByText('تمام سلپس')).not.toBeInTheDocument();
    expect(screen.queryByText('سلپ')).not.toBeInTheDocument();
  });
});
