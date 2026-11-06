import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Entry, {
  formatMiqdarJuzPages,
  calculateSuggestedPages
} from './Entry';
import { getCurrentAcademicYearStart } from '../utils/academicYear';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const CLASS_ID = 'class-uuid-101';
const CUR_YEAR = getCurrentAcademicYearStart();
const STUDENT_ID = 'student-uuid-456';

const SAMPLE_CLASSES = [
  { id: CLASS_ID, name: 'شعبہ حفظ کلاس 1', teacher: 'استاد محترم' }
];

const SAMPLE_STUDENTS = [
  {
    id: STUDENT_ID,
    name: 'محمد حذیفہ',
    roll_number: '101',
    admRegNo: '101',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    hifz_start_date: `${CUR_YEAR}-04-01`,
    status: 'active',
    isAdmissionProfile: true
  }
];

describe('Monthly Literacy Progress Entry (اندراج ماہانہ خواندگی)', () => {
  describe('Formatting & Calculation Helpers', () => {
    it('formatMiqdarJuzPages converts pages to Juz and pages accurately', () => {
      expect(formatMiqdarJuzPages(20)).toBe('1 پارہ');
      expect(formatMiqdarJuzPages(22)).toBe('1 پارہ / 2 صفحات');
      expect(formatMiqdarJuzPages(40)).toBe('2 پارے');
      expect(formatMiqdarJuzPages(45)).toBe('2 پارے / 5 صفحات');
      expect(formatMiqdarJuzPages(15)).toBe('15 صفحات');
      expect(formatMiqdarJuzPages(0)).toBe('0 صفحات');
    });

    it('calculateSuggestedPages suggests pages from start to end', () => {
      // Para 1, Page 1 to Para 1, Page 20 -> 20 pages
      expect(calculateSuggestedPages(1, 1, 1, 20)).toBe(20);
      // Para 1, Page 1 to Para 2, Page 2 -> 22 pages
      expect(calculateSuggestedPages(1, 1, 2, 2)).toBe(22);
      // Incomplete start or end returns empty string
      expect(calculateSuggestedPages(1, 1, '', '')).toBe('');
    });
  });

  describe('Component Integration in Entry.jsx', () => {
    let mockFetchClasses;
    let mockFetchStudents;
    let mockFetchMonthlyLiteracy;
    let mockSaveMonthlyLiteracy;
    let mockSaveHifzHalfYearRecord;
    let mockSaveMadrasaData;
    let mockLoadMadrasaData;

    beforeEach(() => {
      vi.clearAllMocks();
      window.alert = vi.fn();
      window.confirm = vi.fn().mockReturnValue(true);

      mockFetchClasses = vi.fn().mockResolvedValue([...SAMPLE_CLASSES]);
      mockFetchStudents = vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]);
      mockFetchMonthlyLiteracy = vi.fn().mockResolvedValue([]);
      mockSaveMonthlyLiteracy = vi.fn().mockImplementation((payload) => Promise.resolve({
        id: 'monthly-lit-uuid-1',
        ...payload
      }));
      mockSaveHifzHalfYearRecord = vi.fn().mockImplementation((payload) => Promise.resolve({
        id: 'hifz-half-uuid-1',
        ...payload
      }));
      mockSaveMadrasaData = vi.fn();
      mockLoadMadrasaData = vi.fn().mockImplementation((key) => {
        if (key === 'hf_monthly_literacy_v1') return [];
        if (key === 'monthlyLiteracy') return [];
        return { records: [...SAMPLE_STUDENTS] };
      });

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: MADRASA_ID,
        loadMadrasaData: mockLoadMadrasaData,
        saveMadrasaData: mockSaveMadrasaData,
        fetchStudentsFromSupabase: mockFetchStudents,
        fetchClassesFromSupabase: mockFetchClasses,
        fetchMonthlyEvaluationsFromSupabase: vi.fn().mockResolvedValue([]),
        saveMonthlyEvaluationToSupabase: vi.fn(),
        deleteMonthlyEvaluationFromSupabase: vi.fn(),
        fetchMonthlyLiteracyFromSupabase: mockFetchMonthlyLiteracy,
        saveMonthlyLiteracyToSupabase: mockSaveMonthlyLiteracy,
        deleteMonthlyLiteracyFromSupabase: vi.fn(),
        fetchStudentAttendanceFromSupabase: vi.fn().mockResolvedValue([]),
        classesList: [...SAMPLE_CLASSES],
        setClassesList: vi.fn(),
        saveHifzHalfYearRecordToSupabase: mockSaveHifzHalfYearRecord,
        updateStudentHifzStartDate: vi.fn(),
        isMadrasaDisabled: false
      });
    });

    it('allows entering start of month sabaq and saving, then entering end of month with auto-formatting to Juz and pages', async () => {
      render(<Entry />);

      // Switch to "اندراج ماہانہ خواندگی" tab
      const litTabBtn = screen.getByRole('button', { name: 'اندراج ماہانہ خواندگی' });
      fireEvent.click(litTabBtn);

      // Verify header and subtitle
      expect(screen.getByText('ماہانہ آغاز و اختتام اور مقدارِ خواندگی درج کریں', { exact: false })).toBeInTheDocument();

      // Select class
      const classSelect = screen.getByLabelText(/کلاس منتخب کریں/i);
      fireEvent.change(classSelect, { target: { value: CLASS_ID } });

      // Click "طلباء لوڈ کریں"
      const loadBtn = screen.getByText('طلباء لوڈ کریں');
      fireEvent.click(loadBtn);

      // Verify student row is rendered
      await waitFor(() => {
        expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
      });

      // Find inputs:
      // Column 1: Start Sabaq (Para & Page)
      const startParaInput = document.querySelector('.ml-start-para');
      const startPageInput = document.querySelector('.ml-start-page');
      // Column 2: End Sabaq (Para & Page)
      const endParaInput = document.querySelector('.ml-end-para');
      const endPageInput = document.querySelector('.ml-end-page');
      // Column 3: Month Pages
      const pagesInput = document.querySelector('.ml-pages');
      // Column 4: Juz Text
      const juzBadge = document.querySelector('.ml-juz-text');

      expect(startParaInput).toBeInTheDocument();
      expect(startPageInput).toBeInTheDocument();
      expect(endParaInput).toBeInTheDocument();
      expect(endPageInput).toBeInTheDocument();
      expect(pagesInput).toBeInTheDocument();

      // 1. Start of Month: Teacher enters only Column 1 (سبق آغاز ماہ)
      fireEvent.change(startParaInput, { target: { value: '1' } });
      fireEvent.change(startPageInput, { target: { value: '1' } });

      // Click save button at start of month
      const saveBtn = screen.getByRole('button', { name: /محفوظ کریں/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockSaveMonthlyLiteracy).toHaveBeenCalledTimes(1);
      });

      let savedPayload = mockSaveMonthlyLiteracy.mock.calls[0][0];
      expect(savedPayload.students[0].start_para).toBe(1);
      expect(savedPayload.students[0].start_page).toBe(1);
      expect(savedPayload.students[0].end_para).toBe('');
      expect(savedPayload.students[0].pages).toBe('');

      // 2. End of Month: Teacher fills Column 2 (سبق اختتام ماہ) and Column 3 (صفحات)
      fireEvent.change(endParaInput, { target: { value: '2' } });
      fireEvent.change(endPageInput, { target: { value: '2' } });
      fireEvent.change(pagesInput, { target: { value: '22' } });

      // Column 4 should immediately show "1 پارہ / 2 صفحات"
      expect(juzBadge.textContent).toContain('1 پارہ / 2 صفحات');

      // Click save button again at end of month
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockSaveMonthlyLiteracy).toHaveBeenCalledTimes(2);
      });

      savedPayload = mockSaveMonthlyLiteracy.mock.calls[1][0];
      expect(savedPayload.students[0].start_para).toBe(1);
      expect(savedPayload.students[0].start_page).toBe(1);
      expect(savedPayload.students[0].end_para).toBe(2);
      expect(savedPayload.students[0].end_page).toBe(2);
      expect(savedPayload.students[0].pages).toBe(22);
      expect(savedPayload.students[0].juz_text).toBe('1 پارہ / 2 صفحات');
    });

    it('automatically populates pages in six-monthly literacy view from monthly literacy records', async () => {
      // Mock saved monthly literacy record for April
      const existingLiteracy = {
        id: 'monthly-lit-1',
        classId: CLASS_ID,
        className: 'شعبہ حفظ کلاس 1',
        month: 'اپریل',
        year: String(CUR_YEAR),
        students: [
          {
            student_id: STUDENT_ID,
            regNo: '101',
            name: 'محمد حذیفہ',
            start_para: 1,
            start_page: 1,
            end_para: 2,
            end_page: 2,
            pages: 22,
            juz_text: '1 پارہ / 2 صفحات'
          }
        ]
      };

      mockFetchMonthlyLiteracy.mockResolvedValueOnce([existingLiteracy]);
      mockLoadMadrasaData.mockImplementation((key) => {
        if (key === 'hf_monthly_literacy_v1') return [existingLiteracy];
        return { records: [...SAMPLE_STUDENTS] };
      });

      render(<Entry />);

      // Switch to "ششماہی و سالانہ خواندگی" tab
      const hifzTabBtn = screen.getByRole('button', { name: 'ششماہی و سالانہ خواندگی' });
      fireEvent.click(hifzTabBtn);

      // Select student
      const studentSelect = screen.getByLabelText(/طالب علم منتخب کریں/i);
      fireEvent.change(studentSelect, { target: { value: STUDENT_ID } });

      // Verify that April's page input has 22 automatically populated
      await waitFor(() => {
        const pageInputs = document.querySelectorAll('.month-pages');
        expect(pageInputs.length).toBeGreaterThan(0);
        expect(pageInputs[0].value).toBe('22');
      });

      // Verify sync badge "ماہانہ خواندگی سے خودکار ہم آہنگ" is shown
      await waitFor(() => {
        expect(screen.getByText('ماہانہ خواندگی سے خودکار ہم آہنگ')).toBeInTheDocument();
      });
    });
  });
});
