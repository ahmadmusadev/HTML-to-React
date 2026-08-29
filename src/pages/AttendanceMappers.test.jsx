import { describe, it, expect } from 'vitest';
import {
  normalizeAttendanceStatus,
  getStatusLabelUrdu,
  getStatusShortCode,
  mapSupabaseToUi,
  mapUiToSupabase
} from './Attendance';

describe('Attendance Supabase Mappers & Status Normalization', () => {
  it('normalizeAttendanceStatus correctly maps various input formats to the 4 canonical values', () => {
    // Present
    expect(normalizeAttendanceStatus('present')).toBe('present');
    expect(normalizeAttendanceStatus('PRESENT')).toBe('present');
    expect(normalizeAttendanceStatus('P')).toBe('present');
    expect(normalizeAttendanceStatus('p')).toBe('present');
    expect(normalizeAttendanceStatus('حاضر')).toBe('present');

    // Absent
    expect(normalizeAttendanceStatus('absent')).toBe('absent');
    expect(normalizeAttendanceStatus('A')).toBe('absent');
    expect(normalizeAttendanceStatus('a')).toBe('absent');
    expect(normalizeAttendanceStatus('غیر حاضر')).toBe('absent');

    // Leave
    expect(normalizeAttendanceStatus('leave')).toBe('leave');
    expect(normalizeAttendanceStatus('L')).toBe('leave');
    expect(normalizeAttendanceStatus('l')).toBe('leave');
    expect(normalizeAttendanceStatus('E')).toBe('leave');
    expect(normalizeAttendanceStatus('رخصت')).toBe('leave');
    expect(normalizeAttendanceStatus('معذور')).toBe('leave');

    // Late
    expect(normalizeAttendanceStatus('late')).toBe('late');
    expect(normalizeAttendanceStatus('LT')).toBe('late');
    expect(normalizeAttendanceStatus('lt')).toBe('late');
    expect(normalizeAttendanceStatus('لیٹ')).toBe('late');

    // Default / fallback
    expect(normalizeAttendanceStatus('')).toBe('present');
    expect(normalizeAttendanceStatus(null)).toBe('present');
    expect(normalizeAttendanceStatus('unknown')).toBe('present');
  });

  it('getStatusLabelUrdu and getStatusShortCode return correct Urdu labels and short codes', () => {
    expect(getStatusLabelUrdu('present')).toBe('حاضر');
    expect(getStatusLabelUrdu('absent')).toBe('غیر حاضر');
    expect(getStatusLabelUrdu('leave')).toBe('رخصت');
    expect(getStatusLabelUrdu('late')).toBe('لیٹ');

    expect(getStatusShortCode('present')).toBe('P');
    expect(getStatusShortCode('absent')).toBe('A');
    expect(getStatusShortCode('leave')).toBe('L');
    expect(getStatusShortCode('late')).toBe('LT');
  });

  it('mapSupabaseToUi correctly transforms a Supabase student_attendance row with joined students data', () => {
    const supabaseRow = {
      id: 'att-uuid-101',
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      date: '2026-08-28',
      status: 'present',
      remarks: 'وقت پر حاضر',
      created_at: '2026-08-28T08:00:00Z',
      updated_at: '2026-08-28T08:00:00Z',
      students: {
        id: 'student-uuid-789',
        name: 'محمد حامد',
        roll_number: '15',
        father_name: 'حامد محمود',
        class_id: 'class-uuid-001'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow);

    expect(uiObj).toEqual({
      id: 'att-uuid-101',
      studentId: '15',
      studentUuid: 'student-uuid-789',
      studentName: 'محمد حامد',
      studentFather: 'حامد محمود',
      classId: 'class-uuid-001',
      date: '2026-08-28',
      status: 'present',
      statusUrdu: 'حاضر',
      shortCode: 'P',
      remarks: 'وقت پر حاضر',
      created_at: '2026-08-28T08:00:00Z',
      updated_at: '2026-08-28T08:00:00Z'
    });
  });

  it('mapSupabaseToUi uses studentLookup fallback when joined student object is missing', () => {
    const supabaseRow = {
      id: 'att-uuid-102',
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      date: '2026-08-28',
      status: 'late',
      remarks: '15 منٹ تاخیر',
      created_at: '2026-08-28T08:15:00Z'
    };

    const studentLookup = {
      'student-uuid-789': {
        id: 'student-uuid-789',
        name: 'عبد اللہ بن مسعود',
        admRegNo: '22',
        admFatherName: 'مسعود احمد',
        admClass: 'class-uuid-002'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow, studentLookup);

    expect(uiObj.studentName).toBe('عبد اللہ بن مسعود');
    expect(uiObj.studentId).toBe('22');
    expect(uiObj.studentFather).toBe('مسعود احمد');
    expect(uiObj.classId).toBe('class-uuid-002');
    expect(uiObj.status).toBe('late');
    expect(uiObj.statusUrdu).toBe('لیٹ');
    expect(uiObj.shortCode).toBe('LT');
    expect(uiObj.remarks).toBe('15 منٹ تاخیر');
  });

  it('mapUiToSupabase formats UI attendance entry into Supabase payload', () => {
    const uiData = {
      studentUuid: 'student-uuid-789',
      date: '2026-08-28',
      status: 'leave',
      remarks: 'بیماری کی رخصت'
    };

    const payload = mapUiToSupabase(uiData, 'madrasa-uuid-456');

    expect(payload).toEqual({
      madrasa_id: 'madrasa-uuid-456',
      student_id: 'student-uuid-789',
      date: '2026-08-28',
      status: 'leave',
      remarks: 'بیماری کی رخصت'
    });
  });
});
