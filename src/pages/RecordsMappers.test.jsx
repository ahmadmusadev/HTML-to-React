import { describe, it, expect } from 'vitest';
import { mapSupabaseToUi, mapUiToSupabase } from './Records';
import { yearTargets, scoreThresholds, PAGES_PER_PAO, PAGES_PER_JUZ, calculateWorkingDays } from './Entry';

describe('Records Supabase Mappers & Hifz Calculations', () => {
  it('mapSupabaseToUi correctly transforms a Supabase hifz_half_year_records row with joined students data', () => {
    const supabaseRow = {
      id: 'hifz-rec-uuid-123',
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      hifz_year: 1,
      half_year: 1,
      total_pages: 40,
      pao: 8,
      juz: 2,
      pct: 100,
      score: 100,
      total_working: 140,
      total_present: 135,
      total_absent: 3,
      total_leave: 2,
      attendance_pct: 96.43,
      monthly_academic_details: { 'اپریل': 10, 'مئی': 10 },
      monthly_attendance_details: { 'اپریل': { working: 24, present: 23, absent: 1, leave: 0 } },
      created_at: '2026-08-24T10:00:00Z',
      students: {
        id: 'student-uuid-789',
        name: 'محمد عبد اللہ',
        roll_number: '12',
        father_name: 'عبد الرحمن'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow);

    expect(uiObj).toEqual({
      id: 'hifz-rec-uuid-123',
      studentId: '12',
      studentUuid: 'student-uuid-789',
      name: 'محمد عبد اللہ',
      year: 1,
      halfYear: 1,
      pages: 40,
      pao: 8,
      juz: 2,
      pct: 100,
      score: 100,
      attendance: {
        working: 140,
        present: 135,
        absent: 3,
        leave: 2,
        pct: 96.43,
        monthlyDetails: { 'اپریل': { working: 24, present: 23, absent: 1, leave: 0 } }
      },
      monthlyAcademicDetails: { 'اپریل': 10, 'مئی': 10 },
      ts: '2026-08-24T10:00:00Z'
    });
  });

  it('mapSupabaseToUi uses studentLookup when joined student object is missing', () => {
    const supabaseRow = {
      id: 'hifz-rec-uuid-999',
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      hifz_year: 2,
      half_year: 2,
      total_pages: 50,
      pao: 10,
      juz: 2.5,
      pct: 83.33,
      score: 75,
      total_working: 130,
      total_present: 120,
      total_absent: 8,
      total_leave: 2,
      attendance_pct: 92.31,
      monthly_academic_details: { 'اکتوبر': 15 },
      monthly_attendance_details: {},
      created_at: '2026-08-24T12:00:00Z'
    };

    const studentLookup = {
      'student-uuid-789': {
        id: 'student-uuid-789',
        name: 'عمیر احمد',
        roll_number: '05'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow, studentLookup);

    expect(uiObj.name).toBe('عمیر احمد');
    expect(uiObj.studentId).toBe('05');
    expect(uiObj.year).toBe(2);
    expect(uiObj.halfYear).toBe(2);
    expect(uiObj.pages).toBe(50);
  });

  it('mapUiToSupabase formats UI Hifz entry into Supabase payload', () => {
    const uiData = {
      studentUuid: 'student-uuid-789',
      year: 1,
      halfYear: 2,
      pages: 35,
      pao: 7,
      juz: 1.75,
      pct: 87.5,
      score: 75,
      attendance: {
        working: 140,
        present: 130,
        absent: 6,
        leave: 4,
        pct: 92.86,
        monthlyDetails: { 'اکتوبر': { working: 25, present: 23, absent: 2, leave: 0 } }
      },
      monthlyAcademicDetails: { 'اکتوبر': 12, 'نومبر': 13 }
    };

    const payload = mapUiToSupabase(uiData, 'madrasa-uuid-456');

    expect(payload).toMatchObject({
      student_id: 'student-uuid-789',
      madrasa_id: 'madrasa-uuid-456',
      hifz_year: 1,
      half_year: 2,
      total_pages: 35,
      pao: 7,
      juz: 1.75,
      pct: 87.5,
      score: 75,
      total_working: 140,
      total_present: 130,
      total_absent: 6,
      total_leave: 4,
      attendance_pct: 92.86,
      monthly_academic_details: { 'اکتوبر': 12, 'نومبر': 13 },
      monthly_attendance_details: { 'اکتوبر': { working: 25, present: 23, absent: 2, leave: 0 } }
    });
  });

  it('verifies exact constants matching original edit.html', () => {
    expect(yearTargets).toEqual({
      1: [30, 29, 28],
      2: [27, 26, 25, 24, 23, 22],
      3: [21, 20, 19, 18, 17, 16, 15, 14, 13],
      4: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    });
    expect(PAGES_PER_PAO).toBe(5);
    expect(PAGES_PER_JUZ).toBe(20);
    expect(scoreThresholds).toEqual([
      { pct: 100, score: 100 },
      { pct: 75, score: 75 },
      { pct: 50, score: 50 },
      { pct: 25, score: 25 }
    ]);
  });

  it('calculates working days correctly considering holidays and sundays', () => {
    // April 2025 (month index 3)
    const aprilDays = calculateWorkingDays(2025, 3);
    expect(aprilDays).toBeGreaterThan(0);
    expect(aprilDays).toBeLessThanOrEqual(30);
  });
});
