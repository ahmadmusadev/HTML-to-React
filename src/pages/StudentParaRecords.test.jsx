import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  REVERSE_PARAS_LIST,
  FIVE_PARA_REVIEW_SLOTS,
  calculateDaysTaken,
  createInitialParasArray,
  createInitialReviewsArray
} from '../utils/paraRecordsConstants';
import StudentParaRecords from '../components/StudentParaRecords';
import Records from './Records';

// Mock Madrasa Context
const mockMadrasaContext = {
  activeMadrasa: { id: 'm-123', name: 'جامعہ حفظ القرآن' },
  activeMadrasaId: 'm-123',
  loadMadrasaData: () => ({ records: [] }),
  saveMadrasaData: () => {},
  fetchClassesFromSupabase: async () => [
    { id: 'c-1', name: 'کلاس حفظ اول' },
    { id: 'c-2', name: 'کلاس حفظ دوم' }
  ],
  fetchStudentsFromSupabase: async () => [
    { id: 's-1', name: 'محمد عبد اللہ', roll_number: '101', class_id: 'c-1', class_name: 'کلاس حفظ اول' },
    { id: 's-2', name: 'احمد رضا', roll_number: '102', class_id: 'c-2', class_name: 'کلاس حفظ دوم' }
  ],
  fetchHifzHalfYearRecordsFromSupabase: async () => [],
  deleteHifzHalfYearRecordFromSupabase: async () => {},
  fetchStudentParaRecordFromSupabase: async () => null,
  saveStudentParaRecordToSupabase: async () => ({ success: true })
};

vi.mock('../context/MadrasaContext', () => ({
  useMadrasa: () => mockMadrasaContext
}));

describe('StudentParaRecords Unit & Architecture Tests', () => {
  it('REVERSE_PARAS_LIST strictly orders 30 paras in reverse starting from عم (30) to الم (1)', () => {
    expect(REVERSE_PARAS_LIST).toHaveLength(30);

    // First para must be Para 30: عم
    expect(REVERSE_PARAS_LIST[0]).toEqual({
      paraNumber: 30,
      serialNo: 1,
      name: 'عم'
    });

    // Last para must be Para 1: الم
    expect(REVERSE_PARAS_LIST[29]).toEqual({
      paraNumber: 1,
      serialNo: 30,
      name: 'الم'
    });

    // Verify reverse progression
    for (let i = 0; i < 30; i++) {
      expect(REVERSE_PARAS_LIST[i].serialNo).toBe(i + 1);
      expect(REVERSE_PARAS_LIST[i].paraNumber).toBe(30 - i);
    }
  });

  it('FIVE_PARA_REVIEW_SLOTS has 6 evaluation blocks situated after serials 5, 10, 15, 20, 25, 30', () => {
    expect(FIVE_PARA_REVIEW_SLOTS).toHaveLength(6);

    expect(FIVE_PARA_REVIEW_SLOTS[0].afterSerial).toBe(5);
    expect(FIVE_PARA_REVIEW_SLOTS[0].parasRange).toBe('30 تا 26');

    expect(FIVE_PARA_REVIEW_SLOTS[1].afterSerial).toBe(10);
    expect(FIVE_PARA_REVIEW_SLOTS[1].parasRange).toBe('25 تا 21');

    expect(FIVE_PARA_REVIEW_SLOTS[2].afterSerial).toBe(15);
    expect(FIVE_PARA_REVIEW_SLOTS[2].parasRange).toBe('20 تا 16');

    expect(FIVE_PARA_REVIEW_SLOTS[3].afterSerial).toBe(20);
    expect(FIVE_PARA_REVIEW_SLOTS[3].parasRange).toBe('15 تا 11');

    expect(FIVE_PARA_REVIEW_SLOTS[4].afterSerial).toBe(25);
    expect(FIVE_PARA_REVIEW_SLOTS[4].parasRange).toBe('10 تا 6');

    expect(FIVE_PARA_REVIEW_SLOTS[5].afterSerial).toBe(30);
    expect(FIVE_PARA_REVIEW_SLOTS[5].parasRange).toBe('5 تا 1');
  });

  it('calculateDaysTaken accurately calculates inclusive calendar days and handles empty/invalid cases', () => {
    // 1 day (same start and end date)
    expect(calculateDaysTaken('2026-05-01', '2026-05-01')).toBe(1);

    // 10 days
    expect(calculateDaysTaken('2026-05-01', '2026-05-10')).toBe(10);

    // 31 days (full month of May)
    expect(calculateDaysTaken('2026-05-01', '2026-05-31')).toBe(31);

    // End date before start date
    expect(calculateDaysTaken('2026-05-10', '2026-05-01')).toBe(0);

    // Missing dates
    expect(calculateDaysTaken('', '2026-05-10')).toBe('');
    expect(calculateDaysTaken('2026-05-01', '')).toBe('');
    expect(calculateDaysTaken('', '')).toBe('');
  });

  it('createInitialParasArray and createInitialReviewsArray generate complete clean data structures', () => {
    const initialParas = createInitialParasArray();
    expect(initialParas).toHaveLength(30);
    expect(initialParas[0].paraName).toBe('عم');
    expect(initialParas[0].serialNo).toBe(1);
    expect(initialParas[0].daysTaken).toBe('');
    expect(initialParas[0].isPriorMadrasa).toBe(false);

    const initialReviews = createInitialReviewsArray();
    expect(initialReviews).toHaveLength(6);
    expect(initialReviews[0].slot).toBe(1);
    expect(initialReviews[0].detailedNotes).toBe('');
    expect(initialReviews[5].slot).toBe(6);
  });
});

describe('StudentParaRecords Component UI Integration Tests', () => {
  it('renders student selection and 30-para table when a student is picked', async () => {
    render(<StudentParaRecords />);

    expect(screen.getByText('طالب علم کا انتخاب')).toBeInTheDocument();

    // Wait for students to load into select
    await waitFor(() => {
      expect(screen.getByText('محمد عبد اللہ (101)')).toBeInTheDocument();
    });

    const studentSelect = screen.getByLabelText('طالب علم منتخب کریں');
    fireEvent.change(studentSelect, { target: { value: 's-1' } });

    // Table should now be rendered with all 8 headers
    await waitFor(() => {
      expect(screen.getByText('نمبر شمار')).toBeInTheDocument();
      expect(screen.getByText('نام پارہ')).toBeInTheDocument();
      expect(screen.getByText('آغاز پارہ')).toBeInTheDocument();
      expect(screen.getByText('اختتام پارہ')).toBeInTheDocument();
      expect(screen.getByText('ایام لگے')).toBeInTheDocument();
      expect(screen.getByText('تاریخ جائزہ')).toBeInTheDocument();
      expect(screen.getByText('نام ممتحن')).toBeInTheDocument();
      expect(screen.getByText('مختصر رپورٹ')).toBeInTheDocument();
    });

    // Check first para (عم) and last para (الم)
    expect(screen.getByText('عم')).toBeInTheDocument();
    expect(screen.getByText('الم')).toBeInTheDocument();

    // Check presence of detailed review blocks
    expect(screen.getByText('تفصیلی جائزہ (پارہ 30 تا 26 — 5 پارے مکمل ہونے پر)')).toBeInTheDocument();
    expect(screen.getByText('تفصیلی جائزہ (پارہ 5 تا 1 — تکمیلِ حفظِ قرآنِ کریم تفصیلی جائزہ)')).toBeInTheDocument();
  });

  it('supports mid-hifz admission toggle and automarks prior paras', async () => {
    render(<StudentParaRecords />);

    await waitFor(() => {
      expect(screen.getByLabelText('طالب علم منتخب کریں')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('طالب علم منتخب کریں'), { target: { value: 's-1' } });

    await waitFor(() => {
      expect(screen.getByLabelText('طالب علم کا داخلہ درمیانِ حفظ میں ہوا ہے (سابقہ مدرسے سے منتقلی)')).toBeInTheDocument();
    });

    const midHifzCheckbox = screen.getByLabelText('طالب علم کا داخلہ درمیانِ حفظ میں ہوا ہے (سابقہ مدرسے سے منتقلی)');
    fireEvent.click(midHifzCheckbox);

    // Prior madrasa fields appear
    expect(screen.getByLabelText('سابقہ مدرسے کا نام')).toBeInTheDocument();
    expect(screen.getByLabelText('سابقہ مدرسے میں مکمل شدہ پارے')).toBeInTheDocument();
    expect(screen.getByLabelText('اس مدرسے میں آغاز پارہ')).toBeInTheDocument();

    // Fill in prior madrasa details
    fireEvent.change(screen.getByLabelText('سابقہ مدرسے کا نام'), { target: { value: 'جامعہ دارالعلوم کراچی' } });
    fireEvent.change(screen.getByLabelText('سابقہ مدرسے میں مکمل شدہ پارے'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('اس مدرسے میں آغاز پارہ'), { target: { value: '25' } });

    // Click auto-mark prior paras
    const autoMarkBtn = screen.getByText('سابقہ پارے خودکار نشان زد کریں');
    fireEvent.click(autoMarkBtn);

    // Expect alert indicating prior paras marked
    expect(screen.getByText(/کو سابقہ مدرسے کے مکمل شدہ پارے کے طور پر نشان زد کر دیا گیا ہے/)).toBeInTheDocument();
  });

  it('Records.jsx integrates both subtabs and defaults to 30-para records view', async () => {
    render(<Records />);

    // Check subtab buttons
    expect(screen.getByText('پارہ بہ پارہ تکمیلِ حفظ (30 پارے ریکارڈ)')).toBeInTheDocument();
    expect(screen.getByText('ششماہی تعلیمی ریکارڈز و خلاصہ')).toBeInTheDocument();

    // Default active subtab is paraRecords
    expect(screen.getByText('طالب علم کا انتخاب')).toBeInTheDocument();

    // Click second subtab
    fireEvent.click(screen.getByText('ششماہی تعلیمی ریکارڈز و خلاصہ'));

    // Existing academic records search should be visible
    expect(screen.getByText('اکیڈمک ریکارڈ تلاش کریں')).toBeInTheDocument();
  });
});
