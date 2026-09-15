import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Admissions from './Admissions';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';

const INITIAL_CLASSES = [
  { id: 'cls-1', name: 'حفظِ قرآن — ناظرہ', class_name: 'حفظِ قرآن — ناظرہ', teacher: 'مولانا عبدالرحمن', teacher_name: 'مولانا عبدالرحمن' },
  { id: 'cls-2', name: 'حفظِ قرآن — سال اول', class_name: 'حفظِ قرآن — سال اول', teacher: 'مولانا محمد اسحاق', teacher_name: 'مولانا محمد اسحاق' },
  { id: 'cls-3', name: 'حفظِ قرآن — سال دوم', class_name: 'حفظِ قرآن — سال دوم', teacher: 'مولانا یوسف', teacher_name: 'مولانا یوسف' },
  { id: 'cls-4', name: 'حفظِ قرآن — سال سوم', class_name: 'حفظِ قرآن — سال سوم', teacher: 'مولانا ابراہیم', teacher_name: 'مولانا ابراہیم' },
  { id: 'cls-5', name: 'حفظِ قرآن — سال چہارم', class_name: 'حفظِ قرآن — سال چہارم', teacher: 'مولانا عبداللہ', teacher_name: 'مولانا عبداللہ' }
];

const INITIAL_STUDENTS = [
  {
    id: 'std-1',
    name: 'محمد عثمان',
    roll_number: '01',
    admRegNo: '01',
    father_name: 'فاروق احمد',
    admFatherName: 'فاروق احمد',
    class_id: 'cls-1',
    admClass: 'cls-1',
    status: 'active',
    isAdmissionProfile: true
  }
];

describe('Classes Management in Admissions ("All Classes" tab)', () => {
  let mockFetchClasses;
  let mockSeedDefaultClasses;
  let mockAddClass;
  let mockUpdateClass;
  let mockDeleteClass;
  let mockDeleteStudent;
  let mockFetchStudents;
  let mockAddStudent;
  let mockUpdateStudent;

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    mockFetchClasses = vi.fn().mockResolvedValue([...INITIAL_CLASSES]);
    mockSeedDefaultClasses = vi.fn().mockResolvedValue([...INITIAL_CLASSES]);
    mockAddClass = vi.fn().mockImplementation(async (cls) => ({
      id: 'cls-new',
      name: cls.class_name,
      class_name: cls.class_name,
      teacher: cls.teacher_name,
      teacher_name: cls.teacher_name
    }));
    mockUpdateClass = vi.fn().mockImplementation(async (id, cls) => ({
      id,
      name: cls.class_name,
      class_name: cls.class_name,
      teacher: cls.teacher_name,
      teacher_name: cls.teacher_name
    }));
    mockDeleteClass = vi.fn().mockResolvedValue(true);
    mockDeleteStudent = vi.fn().mockResolvedValue(true);
    mockFetchStudents = vi.fn().mockResolvedValue([...INITIAL_STUDENTS]);
    mockAddStudent = vi.fn().mockImplementation(async (s) => ({
      id: 'std-new',
      name: s.name,
      roll_number: s.roll_number,
      admRegNo: s.roll_number,
      father_name: s.father_name,
      admFatherName: s.father_name,
      class_id: s.class_id,
      admClass: s.class_id,
      status: 'active'
    }));
    mockUpdateStudent = vi.fn().mockImplementation(async (id, s) => ({
      id,
      name: s.name,
      father_name: s.father_name,
      admFatherName: s.father_name,
      class_id: s.class_id,
      status: 'active'
    }));

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      fetchClassesFromSupabase: mockFetchClasses,
      seedDefaultClassesForMadrasa: mockSeedDefaultClasses,
      addClassToSupabase: mockAddClass,
      updateClassInSupabase: mockUpdateClass,
      deleteClassFromSupabase: mockDeleteClass,
      deleteStudentFromSupabase: mockDeleteStudent,
      fetchStudentsFromSupabase: mockFetchStudents,
      addStudentToSupabase: mockAddStudent,
      updateStudentInSupabase: mockUpdateStudent,
      withdrawStudentInSupabase: vi.fn()
    });
  });

  it('renders "All Classes" tab and displays all 5 default classes with their teachers', async () => {
    render(<Admissions />);

    // Click on "تمام کلاسز"
    const classesTabBtn = screen.getByRole('button', { name: 'تمام کلاسز' });
    fireEvent.click(classesTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/تمام کلاسز کا انتظام/)).toBeInTheDocument();
    });

    // Check that all 5 classes and their teachers are displayed
    expect(screen.getByText('حفظِ قرآن — ناظرہ')).toBeInTheDocument();
    expect(screen.getByText('حفظِ قرآن — سال اول')).toBeInTheDocument();
    expect(screen.getByText('حفظِ قرآن — سال دوم')).toBeInTheDocument();
    expect(screen.getByText('حفظِ قرآن — سال سوم')).toBeInTheDocument();
    expect(screen.getByText('حفظِ قرآن — سال چہارم')).toBeInTheDocument();

    expect(screen.getByText(/مولانا عبدالرحمن/)).toBeInTheDocument();
    expect(screen.getByText(/مولانا محمد اسحاق/)).toBeInTheDocument();
  });

  it('automatically seeds default classes if madrasa initially has 0 classes', async () => {
    mockFetchClasses.mockResolvedValueOnce([]);

    render(<Admissions />);

    await waitFor(() => {
      expect(mockSeedDefaultClasses).toHaveBeenCalledWith(MADRASA_ID);
    });
  });

  it('allows adding a new class independently', async () => {
    render(<Admissions />);

    fireEvent.click(screen.getByRole('button', { name: 'تمام کلاسز' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /نیا کلاس شامل کریں/ })).toBeInTheDocument();
    });

    // Click Add New Class
    fireEvent.click(screen.getByRole('button', { name: /نیا کلاس شامل کریں/ }));

    // Modal appears
    expect(screen.getByText(/نیا کلاس شامل کریں \(Add New Class\)/)).toBeInTheDocument();

    const classNameInput = screen.getByLabelText(/کلاس کا نام/);
    const teacherNameInput = screen.getByLabelText(/استاد کا نام/);

    fireEvent.change(classNameInput, { target: { value: 'حفظِ قرآن — سال پنجم' } });
    fireEvent.change(teacherNameInput, { target: { value: 'مولانا بلال' } });

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'محفوظ کریں' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockAddClass).toHaveBeenCalledWith(
        expect.objectContaining({
          class_name: 'حفظِ قرآن — سال پنجم',
          teacher_name: 'مولانا بلال'
        }),
        MADRASA_ID
      );
      expect(screen.getByText('حفظِ قرآن — سال پنجم')).toBeInTheDocument();
    });
  });

  it('allows editing class name and teacher name', async () => {
    render(<Admissions />);

    fireEvent.click(screen.getByRole('button', { name: 'تمام کلاسز' }));

    await waitFor(() => {
      expect(screen.getByText('حفظِ قرآن — سال اول')).toBeInTheDocument();
    });

    // Click Edit Class on the second class card
    const editBtns = screen.getAllByRole('button', { name: /کلاس میں ترمیم/ });
    fireEvent.click(editBtns[1]);

    // Modal appears in edit mode
    expect(screen.getByText(/کلاس اور استاد میں ترمیم/)).toBeInTheDocument();

    const classNameInput = screen.getByLabelText(/کلاس کا نام/);
    const teacherNameInput = screen.getByLabelText(/استاد کا نام/);

    fireEvent.change(classNameInput, { target: { value: 'حفظِ قرآن — سال اول (الف)' } });
    fireEvent.change(teacherNameInput, { target: { value: 'مولانا طارق' } });

    fireEvent.click(screen.getByRole('button', { name: 'محفوظ کریں' }));

    await waitFor(() => {
      expect(mockUpdateClass).toHaveBeenCalledWith(
        'cls-2',
        expect.objectContaining({
          class_name: 'حفظِ قرآن — سال اول (الف)',
          teacher_name: 'مولانا طارق'
        }),
        MADRASA_ID
      );
      expect(screen.getByText('حفظِ قرآن — سال اول (الف)')).toBeInTheDocument();
      expect(screen.getByText(/مولانا طارق/)).toBeInTheDocument();
    });
  });

  it('allows deleting a class', async () => {
    render(<Admissions />);

    fireEvent.click(screen.getByRole('button', { name: 'تمام کلاسز' }));

    await waitFor(() => {
      expect(screen.getByText('حفظِ قرآن — سال چہارم')).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByRole('button', { name: /حذف/ });
    fireEvent.click(deleteBtns[4]); // Delete 5th class

    await waitFor(() => {
      expect(mockDeleteClass).toHaveBeenCalledWith('cls-5', MADRASA_ID);
      expect(screen.queryByText('حفظِ قرآن — سال چہارم')).not.toBeInTheDocument();
    });
  });

  it('allows viewing students in a class and adding a student directly to that class', async () => {
    render(<Admissions />);

    fireEvent.click(screen.getByRole('button', { name: 'تمام کلاسز' }));

    await waitFor(() => {
      expect(screen.getByText('حفظِ قرآن — ناظرہ')).toBeInTheDocument();
    });

    // Open students drawer
    const viewStudentsBtn = screen.getByRole('button', { name: /طلباء فہرست دیکھیں \(1\)/ });
    fireEvent.click(viewStudentsBtn);

    // Verify existing student in class 1 is shown
    expect(screen.getByText('محمد عثمان')).toBeInTheDocument();

    // Click Add Student to this class
    const addStudentBtns = screen.getAllByRole('button', { name: /طالب علم شامل کریں/ });
    fireEvent.click(addStudentBtns[0]);

    // Modal appears
    expect(screen.getByText('کلاس میں نیا طالب علم داخل کریں')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/طالب علم کا نام \*/);
    fireEvent.change(nameInput, { target: { value: 'ابوبکر صدیق' } });

    fireEvent.click(screen.getByRole('button', { name: 'طالب علم داخل کریں' }));

    await waitFor(() => {
      expect(mockAddStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ابوبکر صدیق',
          class_id: 'cls-1'
        }),
        MADRASA_ID
      );
      expect(screen.getByText('ابوبکر صدیق')).toBeInTheDocument();
    });
  });

  it('allows editing a student name and deleting a student from the class', async () => {
    render(<Admissions />);

    fireEvent.click(screen.getByRole('button', { name: 'تمام کلاسز' }));

    await waitFor(() => {
      expect(screen.getByText('حفظِ قرآن — ناظرہ')).toBeInTheDocument();
    });

    // Open drawer
    fireEvent.click(screen.getByRole('button', { name: /طلباء فہرست دیکھیں \(1\)/ }));

    expect(screen.getByText('محمد عثمان')).toBeInTheDocument();

    // Edit student
    const editStdBtn = screen.getByRole('button', { name: /نام \/ کوائف/ });
    fireEvent.click(editStdBtn);

    expect(screen.getByText('طالب علم کے نام اور کوائف میں ترمیم')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/طالب علم کا نام \*/);
    fireEvent.change(nameInput, { target: { value: 'محمد عثمان غنی' } });

    fireEvent.click(screen.getByRole('button', { name: 'تبدیلیاں محفوظ کریں' }));

    await waitFor(() => {
      expect(mockUpdateStudent).toHaveBeenCalledWith(
        'std-1',
        expect.objectContaining({
          name: 'محمد عثمان غنی'
        })
      );
      expect(screen.getByText('محمد عثمان غنی')).toBeInTheDocument();
    });

    // Delete student
    const deleteStdBtn = screen.getByTitle('طالب علم کا ریکارڈ حذف کریں');
    fireEvent.click(deleteStdBtn);

    await waitFor(() => {
      expect(mockDeleteStudent).toHaveBeenCalledWith('std-1', MADRASA_ID);
      expect(screen.queryByText('محمد عثمان غنی')).not.toBeInTheDocument();
    });
  });
});
