import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Entry from './Entry';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const CLASS_ID = '251aecd8-1990-4907-a02a-4651bb35a6d4';

const SAMPLE_CLASSES = [
  { id: CLASS_ID, name: 'کلاس نمبر: 1-شعبہ حفظ', teacher: 'حافظ احمد' }
];

const SAMPLE_STUDENTS = [
  {
    id: 'std-uuid-101',
    name: 'محمد حذیفہ',
    roll_number: '101',
    admRegNo: '101',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  }
];

describe('Monthly Evaluations (ماہانہ جائزہ) - Local & Supabase Persistence', () => {
  let mockFetchClasses;
  let mockFetchStudents;
  let mockFetchMonthlyEvaluations;
  let mockSaveMonthlyEvaluation;
  let mockDeleteMonthlyEvaluation;
  let mockSaveMadrasaData;
  let mockLoadMadrasaData;

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    mockFetchClasses = vi.fn().mockResolvedValue([...SAMPLE_CLASSES]);
    mockFetchStudents = vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]);
    mockFetchMonthlyEvaluations = vi.fn().mockResolvedValue([]);
    mockSaveMonthlyEvaluation = vi.fn().mockImplementation((payload) => Promise.resolve({
      id: 'monthly-eval-uuid-1',
      ...payload
    }));
    mockDeleteMonthlyEvaluation = vi.fn().mockResolvedValue(true);
    mockSaveMadrasaData = vi.fn();
    mockLoadMadrasaData = vi.fn().mockReturnValue({});

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      loadMadrasaData: mockLoadMadrasaData,
      saveMadrasaData: mockSaveMadrasaData,
      fetchStudentsFromSupabase: mockFetchStudents,
      fetchClassesFromSupabase: mockFetchClasses,
      fetchMonthlyEvaluationsFromSupabase: mockFetchMonthlyEvaluations,
      saveMonthlyEvaluationToSupabase: mockSaveMonthlyEvaluation,
      deleteMonthlyEvaluationFromSupabase: mockDeleteMonthlyEvaluation,
      classesList: [...SAMPLE_CLASSES],
      setClassesList: vi.fn(),
      saveHifzHalfYearRecordToSupabase: vi.fn(),
      updateStudentHifzStartDate: vi.fn(),
      isMadrasaDisabled: false
    });
  });

  it('fetches existing monthly evaluations from Supabase on mount', async () => {
    const existingExam = {
      id: 'monthly-eval-uuid-1',
      classId: CLASS_ID,
      className: 'کلاس نمبر: 1-شعبہ حفظ',
      month: 'اپریل',
      year: '2025',
      students: [
        {
          student_id: 'std-uuid-101',
          regNo: '101',
          name: 'محمد حذیفہ',
          attendance: 10,
          manzil: 60,
          tajweed: 10,
          islamic: 10,
          confidence: 10,
          total: 100,
          pct: 100,
          grade: 'A+'
        }
      ],
      savedAt: '2025-04-15T10:00:00.000Z'
    };

    mockFetchMonthlyEvaluations.mockResolvedValueOnce([existingExam]);

    render(<Entry />);

    // Check that fetchMonthlyEvaluationsFromSupabase was called on mount
    await waitFor(() => {
      expect(mockFetchMonthlyEvaluations).toHaveBeenCalledWith({}, MADRASA_ID);
    });

    // Verify existing exam is rendered in the history section
    await waitFor(() => {
      const historyArea = document.getElementById('meHistoryArea');
      expect(historyArea).toBeInTheDocument();
      expect(within(historyArea).getByText(/کلاس نمبر: 1-شعبہ حفظ/i)).toBeInTheDocument();
      expect(within(historyArea).getByText(/اپریل 2025/i)).toBeInTheDocument();
    });
  });

  it('loads students, enters marks, saves to Supabase and LocalStorage, and keeps input values populated', async () => {
    render(<Entry />);

    // Wait for students and classes to be loaded
    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalled();
    });

    // Select class
    const classSelect = screen.getByRole('combobox', { name: /کلاس منتخب کریں/i });
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });

    // Select month
    const monthSelect = screen.getByRole('combobox', { name: /^ماہ$/i });
    fireEvent.change(monthSelect, { target: { value: 'اپریل' } });

    // Click "طلباء لوڈ کریں"
    const loadBtn = screen.getByText('طلباء لوڈ کریں');
    fireEvent.click(loadBtn);

    // Verify student name is visible in the marks entry table
    await waitFor(() => {
      expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
    });

    // Find input spinbuttons for student row
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(5);

    // Enter marks:
    // 0: attendance (max 10) -> 9
    // 1: manzil (max 60) -> 55
    // 2: tajweed (max 10) -> 8
    // 3: islamic (max 10) -> 9
    // 4: confidence (max 10) -> 8
    fireEvent.change(inputs[0], { target: { value: '9' } });
    fireEvent.change(inputs[1], { target: { value: '55' } });
    fireEvent.change(inputs[2], { target: { value: '8' } });
    fireEvent.change(inputs[3], { target: { value: '9' } });
    fireEvent.change(inputs[4], { target: { value: '8' } });

    // Total should be 9 + 55 + 8 + 9 + 8 = 89
    expect(screen.getAllByText('89').length).toBeGreaterThanOrEqual(1);

    // Click Save Button
    const saveBtn = screen.getByRole('button', { name: /محفوظ کریں/i });
    fireEvent.click(saveBtn);

    // Verify saveMonthlyEvaluationToSupabase was called with exact payload
    await waitFor(() => {
      expect(mockSaveMonthlyEvaluation).toHaveBeenCalledTimes(1);
    });

    const passedPayload = mockSaveMonthlyEvaluation.mock.calls[0][0];
    expect(passedPayload.classId).toBe(CLASS_ID);
    expect(passedPayload.month).toBe('اپریل');
    expect(passedPayload.students).toHaveLength(1);
    expect(passedPayload.students[0].regNo).toBe('101');
    expect(passedPayload.students[0].name).toBe('محمد حذیفہ');
    expect(passedPayload.students[0].attendance).toBe(9);
    expect(passedPayload.students[0].manzil).toBe(55);
    expect(passedPayload.students[0].total).toBe(89);

    // Verify alert message was shown after saving completed
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('محفوظ ہو گیا!')
      );
    });

    // Verify saveMadrasaData was called for local storage persistence
    expect(mockSaveMadrasaData).toHaveBeenCalledWith(
      'hf_monthly_exams_v1',
      expect.any(Array),
      MADRASA_ID
    );

    // Verify input fields DID NOT get wiped out! They retain the saved values!
    await waitFor(() => {
      const updatedInputs = screen.getAllByRole('spinbutton');
      expect(updatedInputs[0].value).toBe('9');
      expect(updatedInputs[1].value).toBe('55');
    });
    expect(screen.getAllByText('89').length).toBeGreaterThanOrEqual(1);
  });

  it('allows deleting a monthly evaluation and calls delete on Supabase and LocalStorage', async () => {
    const existingExam = {
      id: 'monthly-eval-uuid-99',
      classId: CLASS_ID,
      className: 'کلاس نمبر: 1-شعبہ حفظ',
      month: 'اپریل',
      year: '2025',
      students: [
        {
          student_id: 'std-uuid-101',
          regNo: '101',
          name: 'محمد حذیفہ',
          total: 95,
          pct: 95,
          grade: 'A+'
        }
      ],
      savedAt: '2025-04-10T12:00:00.000Z'
    };

    mockFetchMonthlyEvaluations.mockResolvedValueOnce([existingExam]);

    render(<Entry />);

    // Verify record exists in history
    await waitFor(() => {
      const historyArea = document.getElementById('meHistoryArea');
      expect(historyArea).toBeInTheDocument();
      expect(within(historyArea).getByText(/کلاس نمبر: 1-شعبہ حفظ/i)).toBeInTheDocument();
    });

    // Find Delete button
    const deleteBtn = screen.getByRole('button', { name: 'حذف' });
    fireEvent.click(deleteBtn);

    // Verify confirmation was asked
    expect(window.confirm).toHaveBeenCalledWith('کیا آپ یہ ریکارڈ حذف کرنا چاہتے ہیں؟');

    // Verify deleteMonthlyEvaluationFromSupabase was called
    await waitFor(() => {
      expect(mockDeleteMonthlyEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'monthly-eval-uuid-99' }),
        MADRASA_ID
      );
    });

    // Verify local storage was updated
    expect(mockSaveMadrasaData).toHaveBeenCalledWith(
      'hf_monthly_exams_v1',
      [],
      MADRASA_ID
    );

    // Verify card is removed from history
    await waitFor(() => {
      expect(screen.getByText('کوئی ریکارڈ موجود نہیں۔')).toBeInTheDocument();
    });
  });
});
