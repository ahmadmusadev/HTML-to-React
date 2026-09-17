import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Entry from './Entry';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';

const SEVEN_CLASSES = [
  { id: '251aecd8-1990-4907-a02a-4651bb35a6d4', name: 'کلاس نمبر: 1-شعبہ حفظ', teacher: 'قاری احمد' },
  { id: '3b70d810-7714-437d-94ee-447b12d67396', name: 'کلاس نمبر: 2-شعبہ حفظ', teacher: 'قاری بلال' },
  { id: 'a20850ec-9a7a-4da5-995e-45ab03b2ee6a', name: 'کلاس نمبر: 3/شعبہ ناظرہ', teacher: 'قاری طارق' },
  { id: '3c4cc99a-5a55-4e58-a0d1-46b675bfe6ef', name: 'کلاس نمبر: 4/شعبہ ناظرہ', teacher: 'قاری حمزہ' },
  { id: '43cffd84-d141-4b0e-a095-945926bd30c5', name: 'کلاس نمبر: 5/شعبہ قاعدہ', teacher: 'قاری سعد' },
  { id: '51c759ea-750d-4688-bab8-c8ff2f06264d', name: 'کلاس نمبر: 6/شعبہ قاعدہ', teacher: 'قاری عمیر' },
  { id: '1716b8c4-cf3e-4952-a103-0b913cb4d25b', name: 'کلاس نمبر: 7/شعبہ قاعدہ', teacher: 'قاری زین' }
];

const STUDENTS = [
  {
    id: 'std-1',
    name: 'محمد حذیفہ',
    roll_number: '101',
    admRegNo: '101',
    class_id: '251aecd8-1990-4907-a02a-4651bb35a6d4',
    admClass: '251aecd8-1990-4907-a02a-4651bb35a6d4',
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-2',
    name: 'عبداللہ مسعود',
    roll_number: '102',
    admRegNo: '102',
    class_id: '3b70d810-7714-437d-94ee-447b12d67396',
    admClass: '3b70d810-7714-437d-94ee-447b12d67396',
    status: 'active',
    isAdmissionProfile: true
  }
];

describe('Entry.jsx Dynamic Classes and Student Loading', () => {
  let mockFetchClasses;
  let mockFetchStudents;

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();

    mockFetchClasses = vi.fn().mockResolvedValue([...SEVEN_CLASSES]);
    mockFetchStudents = vi.fn().mockResolvedValue([...STUDENTS]);

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      loadMadrasaData: vi.fn().mockReturnValue({}),
      saveMadrasaData: vi.fn(),
      fetchStudentsFromSupabase: mockFetchStudents,
      fetchClassesFromSupabase: mockFetchClasses,
      saveHifzHalfYearRecordToSupabase: vi.fn(),
      updateStudentHifzStartDate: vi.fn()
    });
  });

  it('fetches classes from Supabase and populates all 7 classes in Monthly Exam entry dropdown', async () => {
    render(<Entry />);

    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalledWith(MADRASA_ID);
    });

    await waitFor(() => {
      // Check that all 7 classes appear as options
      SEVEN_CLASSES.forEach(cls => {
        expect(screen.getAllByRole('option', { name: cls.name }).length).toBeGreaterThan(0);
      });
    });

    // Check that legacy default classes (e.g. حفظِ قرآن — سالِ چہارم) are NOT present
    expect(screen.queryByRole('option', { name: 'حفظِ قرآن — سالِ چہارم' })).not.toBeInTheDocument();
  });

  it('loads students correctly when one of the 7 classes is selected in Monthly Exam entry', async () => {
    render(<Entry />);

    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalledWith(MADRASA_ID);
    });

    // Find the monthly review class select dropdown (first select)
    const selects = screen.getAllByRole('combobox');
    const classSelect = selects[0]; // first select is meClassSelect

    fireEvent.change(classSelect, { target: { value: '251aecd8-1990-4907-a02a-4651bb35a6d4' } });

    // Click "طلباء لوڈ کریں"
    const loadBtn = screen.getByRole('button', { name: /طلباء لوڈ کریں/i });
    fireEvent.click(loadBtn);

    // Student 101 should appear in the table
    await waitFor(() => {
      expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
      expect(screen.getByText('101')).toBeInTheDocument();
    });

    // Student 102 belonging to class 2 should NOT appear
    expect(screen.queryByText('عبداللہ مسعود')).not.toBeInTheDocument();
  });

  it('displays the 7 classes in the Class Report tab as well', async () => {
    render(<Entry />);

    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalledWith(MADRASA_ID);
    });

    // Switch to Class Report tab
    const classReportTabBtn = screen.getByRole('button', { name: /کلاس کی انفرادی رپورٹ/i });
    fireEvent.click(classReportTabBtn);

    await waitFor(() => {
      SEVEN_CLASSES.forEach(cls => {
        expect(screen.getAllByRole('option', { name: cls.name }).length).toBeGreaterThan(0);
      });
    });
  });
});
