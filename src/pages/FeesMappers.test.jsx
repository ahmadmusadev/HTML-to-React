import { describe, it, expect } from 'vitest';
import { mapSupabaseToUi, mapUiToSupabase } from './Fees';

describe('Fees Supabase Mappers', () => {
  it('mapSupabaseToUi correctly transforms a Supabase fee row with joined students data', () => {
    const supabaseRow = {
      id: 'fee-uuid-123',
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      invoice_id: '26082101-500',
      amount: '3500.00',
      arrears: '500.00',
      payment_method: 'Bank Transfer',
      month_year: '2026-08',
      status: 'paid',
      paid_at: '2026-08-21T10:00:00Z',
      students: {
        id: 'student-uuid-789',
        name: 'احمد علی',
        roll_number: '01',
        father_name: 'محمد علی'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow);

    expect(uiObj).toEqual({
      id: 'fee-uuid-123',
      isFeeRecord: true,
      invoiceId: '26082101-500',
      studentId: '01',
      studentUuid: 'student-uuid-789',
      studentName: 'احمد علی',
      studentFather: 'محمد علی',
      feeMonth: '2026-08',
      feeAmount: 3500,
      feeArrears: 500,
      totalPaid: 4000,
      feeMethod: 'Bank Transfer',
      status: 'paid',
      timestamp: '2026-08-21T10:00:00Z',
      paid_at: '2026-08-21T10:00:00Z'
    });
  });

  it('mapSupabaseToUi uses studentLookup when joined student object is missing', () => {
    const supabaseRow = {
      id: 'fee-uuid-999',
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      invoice_id: '26082102-123',
      amount: 2000,
      arrears: 0,
      payment_method: 'Cash',
      month_year: '2026-07',
      paid_at: '2026-07-15T12:00:00Z'
    };

    const studentLookup = {
      'student-uuid-789': {
        id: 'student-uuid-789',
        name: 'بلال فاروق',
        admRegNo: '02',
        admFatherName: 'فاروق اعظم'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow, studentLookup);

    expect(uiObj.studentName).toBe('بلال فاروق');
    expect(uiObj.studentId).toBe('02');
    expect(uiObj.studentFather).toBe('فاروق اعظم');
    expect(uiObj.totalPaid).toBe(2000);
  });

  it('mapUiToSupabase formats UI fee form data into Supabase fee payload', () => {
    const uiData = {
      studentUuid: 'student-uuid-789',
      studentId: '01',
      invoiceId: '26082101-789',
      feeAmount: 4000,
      feeArrears: 200,
      feeMethod: 'Online',
      feeMonth: '2026-09',
      status: 'paid',
      timestamp: '2026-09-01T08:30:00Z'
    };

    const payload = mapUiToSupabase(uiData, 'madrasa-uuid-456');

    expect(payload).toEqual({
      student_id: 'student-uuid-789',
      madrasa_id: 'madrasa-uuid-456',
      invoice_id: '26082101-789',
      amount: 4000,
      arrears: 200,
      payment_method: 'Online',
      month_year: '2026-09',
      status: 'paid',
      paid_at: '2026-09-01T08:30:00Z'
    });
  });
});
