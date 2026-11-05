import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Entry, {
  getPreviousMonthInfo,
  calculateAttendanceMarks,
  getStudentMonthlyAbsents
} from './Entry';
import { getCurrentAcademicYearStart } from '../utils/academicYear';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const CLASS_ID = 'class-uuid-101';
const CUR_YEAR = getCurrentAcademicYearStart();

const SAMPLE_CLASSES = [
  { id: CLASS_ID, name: 'شعبہ حفظ کلاس 1', teacher: 'استاد محترم' }
];

const SAMPLE_STUDENTS = [
  {
    id: 'std-1',
    name: 'طالب علم 1 (صفر غیر حاضری)',
    roll_number: '1',
    admRegNo: '1',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-2',
    name: 'طالب علم 2 (چار غیر حاضریاں)',
    roll_number: '2',
    admRegNo: '2',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-3',
    name: 'طالب علم 3 (آٹھ غیر حاضریاں)',
    roll_number: '3',
    admRegNo: '3',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-4',
    name: 'طالب علم 4 (رخصت اور ایک غیر حاضری)',
    roll_number: '4',
    admRegNo: '4',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  }
];

// Attendance in April:
// std-1: 0 absences (all present)
// std-2: 4 absences
// std-3: 8 absences
// std-4: 3 leaves and 1 absence
const SAMPLE_DAILY_ATTENDANCE = [
  // std-2
  { student_id: 'std-2', date: `${CUR_YEAR}-04-01`, status: 'absent' },
  { student_id: 'std-2', date: `${CUR_YEAR}-04-02`, status: 'absent' },
  { student_id: 'std-2', date: `${CUR_YEAR}-04-03`, status: 'غائب' },
  { student_id: 'std-2', date: `${CUR_YEAR}-04-04`, status: 'A' },
  // std-3
  { student_id: 'std-3', date: `${CUR_YEAR}-04-01`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-02`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-03`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-04`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-05`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-06`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-07`, status: 'absent' },
  { student_id: 'std-3', date: `${CUR_YEAR}-04-08`, status: 'absent' },
  // std-4 (leaves should NOT be counted as absences)
  { student_id: 'std-4', date: `${CUR_YEAR}-04-01`, status: 'leave' },
  { student_id: 'std-4', date: `${CUR_YEAR}-04-02`, status: 'رخصت' },
  { student_id: 'std-4', date: `${CUR_YEAR}-04-03`, status: 'L' },
  { student_id: 'std-4', date: `${CUR_YEAR}-04-04`, status: 'absent' }
];

describe('Monthly Evaluation - Auto-Calculation of Attendance Marks from Previous Month', () => {
  describe('Helper Functions Unit Tests', () => {
    it('getPreviousMonthInfo returns the previous calendar month info correctly', () => {
      expect(getPreviousMonthInfo('مئی', 2025)).toEqual({
        prevName: 'اپریل',
        y: 2025,
        mNum: '04',
        prefix: '2025-04'
      });
      expect(getPreviousMonthInfo('جون', 2025)).toEqual({
        prevName: 'مئی',
        y: 2025,
        mNum: '05',
        prefix: '2025-05'
      });
      expect(getPreviousMonthInfo('جنوری', 2025)).toEqual({
        prevName: 'دسمبر',
        y: 2025,
        mNum: '12',
        prefix: '2025-12'
      });
      expect(getPreviousMonthInfo('فروری', 2025)).toEqual({
        prevName: 'جنوری',
        y: 2026,
        mNum: '01',
        prefix: '2026-01'
      });
      expect(getPreviousMonthInfo('اپریل', 2025)).toEqual({
        prevName: 'مارچ',
        y: 2025,
        mNum: '03',
        prefix: '2025-03'
      });
    });

    it('calculateAttendanceMarks implements 4 absences = 1 mark deduction correctly', () => {
      // 0 to 3 absences: 10 marks
      expect(calculateAttendanceMarks(0)).toBe(10);
      expect(calculateAttendanceMarks(1)).toBe(10);
      expect(calculateAttendanceMarks(2)).toBe(10);
      expect(calculateAttendanceMarks(3)).toBe(10);

      // 4 to 7 absences: 9 marks (1 cut)
      expect(calculateAttendanceMarks(4)).toBe(9);
      expect(calculateAttendanceMarks(5)).toBe(9);
      expect(calculateAttendanceMarks(6)).toBe(9);
      expect(calculateAttendanceMarks(7)).toBe(9);

      // 8 to 11 absences: 8 marks (2 cut)
      expect(calculateAttendanceMarks(8)).toBe(8);
      expect(calculateAttendanceMarks(9)).toBe(8);
      expect(calculateAttendanceMarks(10)).toBe(8);
      expect(calculateAttendanceMarks(11)).toBe(8);

      // 12 to 15 absences: 7 marks (3 cut)
      expect(calculateAttendanceMarks(12)).toBe(7);
      expect(calculateAttendanceMarks(15)).toBe(7);

      // 16 to 19 absences: 6 marks (4 cut)
      expect(calculateAttendanceMarks(16)).toBe(6);

      // Never goes below 0
      expect(calculateAttendanceMarks(44)).toBe(0);
      expect(calculateAttendanceMarks(100)).toBe(0);
    });

    it('getStudentMonthlyAbsents counts only absences and ignores leaves', () => {
      const std4 = SAMPLE_STUDENTS[3];
      const count = getStudentMonthlyAbsents(std4, `${CUR_YEAR}-04`, SAMPLE_DAILY_ATTENDANCE);
      expect(count).toBe(1); // 1 absence, 3 leaves ignored
    });
  });

  describe('Component Integration Tests in Entry.jsx', () => {
    let mockFetchClasses;
    let mockFetchStudents;
    let mockFetchMonthlyEvaluations;
    let mockSaveMonthlyEvaluation;
    let mockSaveMadrasaData;
    let mockLoadMadrasaData;
    let mockFetchStudentAttendance;

    beforeEach(() => {
      vi.clearAllMocks();
      window.alert = vi.fn();
      window.confirm = vi.fn().mockReturnValue(true);

      mockFetchClasses = vi.fn().mockResolvedValue([...SAMPLE_CLASSES]);
      mockFetchStudents = vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]);
      mockFetchMonthlyEvaluations = vi.fn().mockResolvedValue([]);
      mockSaveMonthlyEvaluation = vi.fn().mockImplementation((payload) => Promise.resolve({
        id: 'monthly-eval-uuid-test',
        ...payload
      }));
      mockSaveMadrasaData = vi.fn();
      mockLoadMadrasaData = vi.fn().mockImplementation((key) => {
        if (key === 'hf_student_attendance_v1') return [...SAMPLE_DAILY_ATTENDANCE];
        if (key === 'monthlyExams') return [];
        return { records: [...SAMPLE_STUDENTS] };
      });
      mockFetchStudentAttendance = vi.fn().mockResolvedValue([...SAMPLE_DAILY_ATTENDANCE]);

      vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
        activeMadrasaId: MADRASA_ID,
        loadMadrasaData: mockLoadMadrasaData,
        saveMadrasaData: mockSaveMadrasaData,
        fetchStudentsFromSupabase: mockFetchStudents,
        fetchClassesFromSupabase: mockFetchClasses,
        fetchMonthlyEvaluationsFromSupabase: mockFetchMonthlyEvaluations,
        saveMonthlyEvaluationToSupabase: mockSaveMonthlyEvaluation,
        deleteMonthlyEvaluationFromSupabase: vi.fn(),
        fetchStudentAttendanceFromSupabase: mockFetchStudentAttendance,
        classesList: [...SAMPLE_CLASSES],
        setClassesList: vi.fn(),
        saveHifzHalfYearRecordToSupabase: vi.fn(),
        updateStudentHifzStartDate: vi.fn(),
        isMadrasaDisabled: false
      });
    });

    it('automatically populates attendance marks based on previous month (April) when May exam is loaded', async () => {
      render(<Entry />);

      // Wait for classes
      await waitFor(() => {
        expect(mockFetchClasses).toHaveBeenCalled();
      });

      // Select class
      const classSelect = screen.getByRole('combobox', { name: /کلاس منتخب کریں/i });
      fireEvent.change(classSelect, { target: { value: CLASS_ID } });

      // Select May (مئی)
      const monthSelect = screen.getByRole('combobox', { name: /^ماہ$/i });
      fireEvent.change(monthSelect, { target: { value: 'مئی' } });

      // Click "طلباء لوڈ کریں"
      const loadBtn = screen.getByText('طلباء لوڈ کریں');
      fireEvent.click(loadBtn);

      // Verify instruction banner is shown with previous month name (اپریل)
      await waitFor(() => {
        expect(screen.getByText(/حاضری کے 10 نمبرات پچھلے ماہ \(اپریل\) کی روزانہ حاضری سے خودکار درج ہوئے ہیں/i)).toBeInTheDocument();
      });

      // Verify all 4 students are rendered
      expect(screen.getByText('طالب علم 1 (صفر غیر حاضری)')).toBeInTheDocument();
      expect(screen.getByText('طالب علم 2 (چار غیر حاضریاں)')).toBeInTheDocument();
      expect(screen.getByText('طالب علم 3 (آٹھ غیر حاضریاں)')).toBeInTheDocument();
      expect(screen.getByText('طالب علم 4 (رخصت اور ایک غیر حاضری)')).toBeInTheDocument();

      // Find all number inputs
      const allInputs = screen.getAllByRole('spinbutton');
      // Each row has 5 number inputs (attendance, manzil, tajweed, islamiat, itmaad)
      // std-1 attendance: index 0 -> 10 marks (0 absences)
      // std-2 attendance: index 5 -> 9 marks (4 absences = 1 deduction)
      // std-3 attendance: index 10 -> 8 marks (8 absences = 2 deduction)
      // std-4 attendance: index 15 -> 10 marks (1 absence, 3 leaves = 0 deduction)

      expect(allInputs[0].value).toBe('10');
      expect(allInputs[5].value).toBe('9');
      expect(allInputs[10].value).toBe('8');
      expect(allInputs[15].value).toBe('10');

      // Check "حاضری نمبرات ریفریش کریں" button exists and works
      const refreshBtn = screen.getByRole('button', { name: /حاضری نمبرات ریفریش کریں/i });
      expect(refreshBtn).toBeInTheDocument();

      // Manually edit std-2 attendance to 7 to verify manual change is allowed
      fireEvent.change(allInputs[5], { target: { value: '7' } });
      expect(allInputs[5].value).toBe('7');

      // Click refresh button to restore from attendance records
      fireEvent.click(refreshBtn);
      expect(allInputs[5].value).toBe('9');

      // Click Save Button
      const saveBtn = screen.getByRole('button', { name: /محفوظ کریں/i });
      fireEvent.click(saveBtn);

      // Verify saveMonthlyEvaluationToSupabase was called with auto-calculated marks
      await waitFor(() => {
        expect(mockSaveMonthlyEvaluation).toHaveBeenCalledTimes(1);
      });

      const passedPayload = mockSaveMonthlyEvaluation.mock.calls[0][0];
      expect(passedPayload.month).toBe('مئی');
      expect(passedPayload.students[0].attendance).toBe(10);
      expect(passedPayload.students[1].attendance).toBe(9);
      expect(passedPayload.students[2].attendance).toBe(8);
      expect(passedPayload.students[3].attendance).toBe(10);
    });
  });
});
