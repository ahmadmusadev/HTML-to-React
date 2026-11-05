import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Entry from './Entry';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const STUDENT_ID = 'student-uuid-456';

const SAMPLE_STUDENTS = [
  {
    id: STUDENT_ID,
    name: 'محمد حذیفہ',
    roll_number: '101',
    admRegNo: '101',
    hifz_start_date: '2025-04-10',
    status: 'active',
    isAdmissionProfile: true
  }
];

describe('Hifz Half-Year Attendance Auto-Sync from Daily Attendance', () => {
  let mockFetchStudents;
  let mockFetchClasses;
  let mockFetchStudentAttendance;
  let mockSaveHifzHalfYearRecord;
  let mockUpdateStudentHifzStartDate;
  let mockSaveMadrasaData;
  let mockLoadMadrasaData;

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    mockFetchStudents = vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]);
    mockFetchClasses = vi.fn().mockResolvedValue([]);
    mockSaveHifzHalfYearRecord = vi.fn().mockImplementation((payload) => Promise.resolve({
      id: 'hifz-record-uuid-1',
      ...payload
    }));
    mockUpdateStudentHifzStartDate = vi.fn().mockResolvedValue(true);
    mockSaveMadrasaData = vi.fn();
    mockLoadMadrasaData = vi.fn().mockReturnValue({ records: [...SAMPLE_STUDENTS] });

    // Mock daily attendance for the student:
    // In April 2025: 2 absent, 1 leave
    // In May 2025: 1 absent, 0 leave
    mockFetchStudentAttendance = vi.fn().mockResolvedValue([
      { student_id: STUDENT_ID, date: '2025-04-05', status: 'absent' },
      { student_id: STUDENT_ID, date: '2025-04-12', status: 'absent' },
      { student_id: STUDENT_ID, date: '2025-04-18', status: 'leave' },
      { student_id: STUDENT_ID, date: '2025-04-20', status: 'present' },
      { student_id: STUDENT_ID, date: '2025-05-10', status: 'absent' },
      { student_id: STUDENT_ID, date: '2025-05-15', status: 'present' }
    ]);

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      loadMadrasaData: mockLoadMadrasaData,
      saveMadrasaData: mockSaveMadrasaData,
      fetchStudentsFromSupabase: mockFetchStudents,
      fetchClassesFromSupabase: mockFetchClasses,
      fetchMonthlyEvaluationsFromSupabase: vi.fn().mockResolvedValue([]),
      saveMonthlyEvaluationToSupabase: vi.fn(),
      deleteMonthlyEvaluationFromSupabase: vi.fn(),
      fetchStudentAttendanceFromSupabase: mockFetchStudentAttendance,
      fetchHifzHalfYearRecordsFromSupabase: vi.fn().mockResolvedValue([]),
      saveHifzHalfYearRecordToSupabase: mockSaveHifzHalfYearRecord,
      updateStudentHifzStartDate: mockUpdateStudentHifzStartDate,
      classesList: [],
      setClassesList: vi.fn(),
      isMadrasaDisabled: false
    });
  });

  it('automatically calculates and populates monthly attendance from daily attendance records when student is selected', async () => {
    render(<Entry />);

    // Switch to Hifz literacy tab: "ششماہی و سالانہ خواندگی"
    const hifzTabBtn = screen.getByRole('button', { name: 'ششماہی و سالانہ خواندگی' });
    fireEvent.click(hifzTabBtn);

    // Select the student
    const studentSelect = screen.getByLabelText(/طالب علم منتخب کریں/i);
    fireEvent.change(studentSelect, { target: { value: STUDENT_ID } });

    // Verify daily attendance was fetched for the student
    await waitFor(() => {
      expect(mockFetchStudentAttendance).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: STUDENT_ID }),
        MADRASA_ID
      );
    });

    // Verify sync indicator is displayed
    await waitFor(() => {
      expect(screen.getByText('روزانہ حاضری سے خودکار ہم آہنگ')).toBeInTheDocument();
    });

    // Check attendance input fields:
    // April (0): absent = 2, leave = 1
    // May (1): absent = 1, leave = 0
    const absentInputs = document.querySelectorAll('.absent-days');
    const leaveInputs = document.querySelectorAll('.leave-days');

    expect(absentInputs.length).toBe(6);
    expect(leaveInputs.length).toBe(6);

    expect(absentInputs[0].value).toBe('2');
    expect(leaveInputs[0].value).toBe('1');
    expect(absentInputs[1].value).toBe('1');
    expect(leaveInputs[1].value).toBe('0');

    // Enter some pages read so record can be saved
    const pageInputs = document.querySelectorAll('.month-pages');
    if (pageInputs.length > 0) {
      fireEvent.change(pageInputs[0], { target: { value: '40' } });
    }

    // Click "محفوظ کریں" button
    const saveBtn = screen.getByRole('button', { name: /محفوظ کریں/i });
    fireEvent.click(saveBtn);

    // Verify saveHifzHalfYearRecordToSupabase was called with auto-calculated attendance
    await waitFor(() => {
      expect(mockSaveHifzHalfYearRecord).toHaveBeenCalledTimes(1);
    });

    const passedPayload = mockSaveHifzHalfYearRecord.mock.calls[0][0];
    expect(passedPayload.student_id).toBe(STUDENT_ID);
    expect(passedPayload.student_name).toBe('محمد حذیفہ');
    expect(passedPayload.total_absent).toBe(3); // 2 + 1 = 3
    expect(passedPayload.total_leave).toBe(1); // 1 + 0 = 1
    expect(passedPayload.monthly_attendance_details['اپریل'].absent).toBe(2);
    expect(passedPayload.monthly_attendance_details['اپریل'].leave).toBe(1);
    expect(passedPayload.monthly_attendance_details['مئی'].absent).toBe(1);
  });

  it('restores previously saved academic pages when a student with an existing record is selected', async () => {
    // Add existing hifz record with pages
    const existingHifzRecord = {
      id: 'hifz-existing-uuid',
      student_id: STUDENT_ID,
      hifz_year: 1,
      half_year: 1,
      total_pages: 90,
      monthly_academic_details: {
        'اپریل': 30,
        'مئی': 30,
        'جون': 30
      },
      monthly_attendance_details: {
        'اپریل': { working: 24, absent: 1, leave: 0, present: 23 }
      }
    };

    mockLoadMadrasaData.mockReturnValue({
      records: [...SAMPLE_STUDENTS, existingHifzRecord]
    });

    render(<Entry />);

    // Switch to Hifz literacy tab: "ششماہی و سالانہ خواندگی"
    const hifzTabBtn = screen.getByRole('button', { name: 'ششماہی و سالانہ خواندگی' });
    fireEvent.click(hifzTabBtn);

    // Select the student
    const studentSelect = screen.getByLabelText(/طالب علم منتخب کریں/i);
    fireEvent.change(studentSelect, { target: { value: STUDENT_ID } });

    // Verify existing pages read are populated into the inputs
    await waitFor(() => {
      const pageInputs = document.querySelectorAll('.month-pages');
      expect(pageInputs.length).toBeGreaterThan(0);
      expect(pageInputs[0].value).toBe('30');
    });
  });
});
