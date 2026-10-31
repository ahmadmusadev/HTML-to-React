import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Staff from './Staff';
import * as MadrasaContextModule from '../context/MadrasaContext';
import * as AuthContextModule from '../context/AuthContext';
import * as payrollApi from '../lib/payrollApi';

const VALID_MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const VALID_STAFF_ID_1 = '22222222-2222-2222-2222-222222222222';
const VALID_NEW_STAFF_ID = '33333333-3333-3333-3333-333333333333';
const VALID_CLASS_ID = '44444444-4444-4444-4444-444444444444';

describe('Staff Page - Salary and Payroll Integration', () => {
  const mockStaff = [
    {
      id: VALID_STAFF_ID_1,
      madrasa_id: VALID_MADRASA_ID,
      staff_code: 1001,
      name: 'قاری محمد بلال',
      father_name: 'محمد انور',
      phone: '0300-1234567',
      assigned_class_id: VALID_CLASS_ID,
      shift_start: '06:50:00',
      shift_end: '14:45:00'
    }
  ];

  const mockClasses = [
    {
      id: VALID_CLASS_ID,
      name: 'حفظ اول',
      class_name: 'حفظ اول'
    }
  ];

  const mockSalaries = [
    {
      staff_id: VALID_STAFF_ID_1,
      madrasa_id: VALID_MADRASA_ID,
      base_salary: 35000
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      role: 'admin',
      user: { id: 'admin-user-1' },
      profile: { madrasa_id: VALID_MADRASA_ID }
    });

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: VALID_MADRASA_ID,
      classesList: mockClasses,
      setClassesList: vi.fn(),
      fetchStaffFromSupabase: vi.fn().mockResolvedValue(mockStaff),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue(mockClasses),
      addStaffToSupabase: vi.fn().mockResolvedValue({
        id: VALID_NEW_STAFF_ID,
        staff_code: 1002,
        name: 'مولانا احمد',
        father_name: 'عبد الرحمان',
        phone: '0301-7654321',
        madrasa_id: VALID_MADRASA_ID
      }),
      updateStaffInSupabase: vi.fn().mockResolvedValue({
        id: VALID_STAFF_ID_1,
        staff_code: 1001,
        name: 'قاری محمد بلال',
        father_name: 'محمد انور',
        phone: '0300-1234567',
        madrasa_id: VALID_MADRASA_ID
      }),
      deleteStaffFromSupabase: vi.fn().mockResolvedValue(true)
    });

    vi.spyOn(payrollApi, 'fetchStaffSalaries').mockResolvedValue(mockSalaries);
    vi.spyOn(payrollApi, 'fetchPayrollSettings').mockResolvedValue({
      madrasa_id: VALID_MADRASA_ID,
      fiscal_year_start_month: 4
    });
    vi.spyOn(payrollApi, 'fetchLeaveOpening').mockResolvedValue([
      { staff_id: VALID_STAFF_ID_1, used_days: 1.5 }
    ]);
    vi.spyOn(payrollApi, 'upsertStaffSalaries').mockResolvedValue([]);
    vi.spyOn(payrollApi, 'upsertLeaveOpening').mockResolvedValue([]);
  });

  it('renders salary and opening leave inputs in the staff form when user is admin', async () => {
    render(<Staff />);

    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    // Open form
    const toggleBtn = screen.getByText('نیا استاد شامل کریں');
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/تنخواہ اور رخصت کی تفصیلات/)).toBeInTheDocument();
    expect(screen.getByLabelText('ماہانہ بنیادی تنخواہ (روپے)')).toBeInTheDocument();
    expect(screen.getByLabelText('رواں سال کی سابقہ رخصتیں (دن)')).toBeInTheDocument();
  });

  it('does NOT render salary section when user role is teacher', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      role: 'teacher',
      user: { id: 'teacher-user-1' },
      profile: { madrasa_id: VALID_MADRASA_ID }
    });

    render(<Staff />);

    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByText('نیا استاد شامل کریں');
    fireEvent.click(toggleBtn);

    expect(screen.queryByText(/تنخواہ اور رخصت کی تفصیلات/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('ماہانہ بنیادی تنخواہ (روپے)')).not.toBeInTheDocument();
  });

  it('displays existing teacher salary on the card for admin, and hides for teacher', async () => {
    // 1. Admin view
    const { unmount } = render(<Staff />);
    await waitFor(() => {
      expect(screen.getByText('ماہانہ بنیادی تنخواہ')).toBeInTheDocument();
      expect(screen.getByText(/35,000/)).toBeInTheDocument();
    });
    unmount();

    // 2. Teacher view
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      role: 'teacher',
      user: { id: 'teacher-user-1' },
      profile: { madrasa_id: VALID_MADRASA_ID }
    });
    render(<Staff />);
    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });
    expect(screen.queryByText('ماہانہ بنیادی تنخواہ')).not.toBeInTheDocument();
  });

  it('saves new staff and calls upsertStaffSalaries with valid salary', async () => {
    render(<Staff />);

    await waitFor(() => {
      expect(screen.getByText('نیا استاد شامل کریں')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('نیا استاد شامل کریں'));

    fireEvent.change(screen.getByLabelText('نام'), { target: { value: 'مولانا احمد' } });
    fireEvent.change(screen.getByLabelText('والد کا نام'), { target: { value: 'عبد الرحمان' } });
    fireEvent.change(screen.getByLabelText('فون نمبر'), { target: { value: '0301-7654321' } });
    fireEvent.change(screen.getByLabelText('ماہانہ بنیادی تنخواہ (روپے)'), { target: { value: '45000' } });
    fireEvent.change(screen.getByLabelText('رواں سال کی سابقہ رخصتیں (دن)'), { target: { value: '2' } });

    const saveBtn = screen.getByText('پروفائل محفوظ کریں');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(payrollApi.upsertStaffSalaries).toHaveBeenCalledWith(
        expect.anything(),
        VALID_MADRASA_ID,
        [expect.objectContaining({ staff_id: VALID_NEW_STAFF_ID, base_salary: 45000 })]
      );
      expect(payrollApi.upsertLeaveOpening).toHaveBeenCalledWith(
        expect.anything(),
        VALID_MADRASA_ID,
        [expect.objectContaining({ staff_id: VALID_NEW_STAFF_ID, used_days: 2 })]
      );
    });
  });

  it('rejects invalid base salary and prevents staff submission', async () => {
    render(<Staff />);

    await waitFor(() => {
      expect(screen.getByText('نیا استاد شامل کریں')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('نیا استاد شامل کریں'));

    fireEvent.change(screen.getByLabelText('نام'), { target: { value: 'مولانا احمد' } });
    fireEvent.change(screen.getByLabelText('والد کا نام'), { target: { value: 'عبد الرحمان' } });
    fireEvent.change(screen.getByLabelText('فون نمبر'), { target: { value: '0301-7654321' } });
    fireEvent.change(screen.getByLabelText('ماہانہ بنیادی تنخواہ (روپے)'), { target: { value: '-500' } });

    const saveBtn = screen.getByText('پروفائل محفوظ کریں');
    fireEvent.click(saveBtn);

    expect(window.alert).toHaveBeenCalledWith('تنخواہ ایک درست عدد ہونی چاہیے');
    expect(payrollApi.upsertStaffSalaries).not.toHaveBeenCalled();
  });

  it('loads existing salary into the form when editing a teacher and saves updated salary', async () => {
    render(<Staff />);

    await waitFor(() => {
      expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    });

    // Click edit button
    const editBtn = screen.getByTitle('ترمیم');
    fireEvent.click(editBtn);

    const salaryInput = screen.getByLabelText('ماہانہ بنیادی تنخواہ (روپے)');
    expect(salaryInput.value).toBe('35000');
    expect(screen.getByLabelText('رواں سال کی سابقہ رخصتیں (دن)').value).toBe('1.5');

    // Change salary to 40000
    fireEvent.change(salaryInput, { target: { value: '40000' } });

    const saveBtn = screen.getByText('پروفائل محفوظ کریں');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(payrollApi.upsertStaffSalaries).toHaveBeenCalledWith(
        expect.anything(),
        VALID_MADRASA_ID,
        [expect.objectContaining({ staff_id: VALID_STAFF_ID_1, base_salary: 40000 })]
      );
    });
  });
});
