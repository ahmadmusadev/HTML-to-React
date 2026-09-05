import { describe, it, expect } from 'vitest';
import {
  normalizeStudentStatus,
  calculateStudentCounts,
  resolveClassName,
  calculateStudentsByClass,
  calculateRecentAdmissions,
  calculateStaffCount,
  calculateTodayAttendanceRate,
  calculateMonthFeesRate,
  calculateLatestExamAverage,
  getTodayDateIso,
  getCurrentMonthIso
} from '../utils/DashboardMappers';

describe('Dashboard Mappers & Calculation Utilities', () => {
  describe('normalizeStudentStatus', () => {
    it('normalizes standard enum values accurately', () => {
      expect(normalizeStudentStatus('active')).toBe('active');
      expect(normalizeStudentStatus('graduated')).toBe('graduated');
      expect(normalizeStudentStatus('left')).toBe('left');
      expect(normalizeStudentStatus('inactive')).toBe('inactive');
      expect(normalizeStudentStatus(' ACTIVE ')).toBe('active');
      expect(normalizeStudentStatus('Graduated')).toBe('graduated');
    });

    it('maps legacy/Urdu terms to corresponding enum values', () => {
      expect(normalizeStudentStatus('حافظ')).toBe('graduated');
      expect(normalizeStudentStatus('مکمل')).toBe('graduated');
      expect(normalizeStudentStatus('فارغ')).toBe('graduated');
      expect(normalizeStudentStatus('خارج')).toBe('left');
      expect(normalizeStudentStatus('withdrawn')).toBe('left');
      expect(normalizeStudentStatus('داخل')).toBe('active');
    });

    it('falls back to inactive for undefined/null/empty', () => {
      expect(normalizeStudentStatus(null)).toBe('inactive');
      expect(normalizeStudentStatus(undefined)).toBe('inactive');
      expect(normalizeStudentStatus('')).toBe('inactive');
      expect(normalizeStudentStatus('unknown_status')).toBe('inactive');
    });
  });

  describe('calculateStudentCounts', () => {
    it('accurately counts active, graduated, left, and total students', () => {
      const students = [
        { id: '1', status: 'active' },
        { id: '2', status: 'active' },
        { id: '3', status: 'graduated' },
        { id: '4', status: 'left' },
        { id: '5', status: 'inactive' }
      ];

      const counts = calculateStudentCounts(students);
      expect(counts).toEqual({
        totalStudents: 2,
        completedStudents: 1,
        withdrawnStudents: 1,
        totalAdmitted: 5,
        activeRate: '40.0',
        completionRate: '20.0'
      });
    });

    it('handles empty students array gracefully', () => {
      const counts = calculateStudentCounts([]);
      expect(counts).toEqual({
        totalStudents: 0,
        completedStudents: 0,
        withdrawnStudents: 0,
        totalAdmitted: 0,
        activeRate: '0.0',
        completionRate: '0.0'
      });
    });
  });

  describe('resolveClassName fallback chain', () => {
    it('prioritizes class_name from Supabase', () => {
      expect(resolveClassName({ class_name: 'حفظ اول', name: 'اول', className: 'کلاس اول' })).toBe('حفظ اول');
    });

    it('falls back to name then className', () => {
      expect(resolveClassName({ name: 'ناظرہ', className: 'کلاس ناظرہ' })).toBe('ناظرہ');
      expect(resolveClassName({ className: 'کلاس ناظرہ' })).toBe('کلاس ناظرہ');
    });

    it('falls back to "بلا نام کلاس" when all are absent or object is null', () => {
      expect(resolveClassName({})).toBe('بلا نام کلاس');
      expect(resolveClassName(null)).toBe('بلا نام کلاس');
    });
  });

  describe('calculateStudentsByClass', () => {
    const classes = [
      { id: 'c1', class_name: 'حفظ اول', teacher_name: 'قاری احمد' },
      { id: 'c2', name: 'حفظ دوم', teacher: 'قاری بلال' },
      { id: 'c3', className: 'قاعدہ' }
    ];

    it('matches students via class_id, admClass, and classId', () => {
      const students = [
        { id: 's1', class_id: 'c1', status: 'active' },
        { id: 's2', admClass: 'c1', status: 'active' },
        { id: 's3', classId: 'c2', status: 'active' },
        { id: 's4', class_id: 'c2', status: 'left' }, // non-active should not be counted
        { id: 's5', class_id: 'c2', status: 'graduated' } // non-active should not be counted
      ];

      const result = calculateStudentsByClass(classes, students);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'c1',
        name: 'حفظ اول',
        teacher: 'قاری احمد',
        count: 2
      });
      expect(result[1]).toEqual({
        id: 'c2',
        name: 'حفظ دوم',
        teacher: 'قاری بلال',
        count: 1
      });
      expect(result[2]).toEqual({
        id: 'c3',
        name: 'قاعدہ',
        teacher: 'استاد درج نہیں',
        count: 0
      });
    });
  });

  describe('calculateRecentAdmissions', () => {
    it('sorts by admission_date descending and tie-breaks by roll_number numerically', () => {
      const students = [
        { id: '1', name: 'عمر', admission_date: '2026-08-01', roll_number: '10' },
        { id: '2', name: 'زید', admission_date: '2026-08-15', roll_number: '5' },
        { id: '3', name: 'بکر', admission_date: '2026-08-15', roll_number: '12' },
        { id: '4', name: 'احمد', admDate: '2026-07-01', admRegNo: '1' }
      ];

      const recent = calculateRecentAdmissions(students, 3);
      expect(recent).toHaveLength(3);
      expect(recent[0].name).toBe('بکر'); // 2026-08-15, roll 12
      expect(recent[1].name).toBe('زید'); // 2026-08-15, roll 5
      expect(recent[2].name).toBe('عمر'); // 2026-08-01, roll 10
    });
  });

  describe('calculateStaffCount', () => {
    it('unions unique teachers from staff and classes list', () => {
      const staff = [
        { name: 'مولانا عثمان' },
        { name: 'قاری احمد' }
      ];
      const classes = [
        { teacher: 'قاری احمد' }, // duplicate
        { teacher_name: 'قاری بلال' }
      ];

      expect(calculateStaffCount(staff, classes)).toBe(3);
    });
  });

  describe('Today Snapshot Calculations', () => {
    it('calculateTodayAttendanceRate computes percentage or returns "—" if empty', () => {
      expect(calculateTodayAttendanceRate([])).toBe('—');
      expect(calculateTodayAttendanceRate(null)).toBe('—');

      const attendance = [
        { status: 'present' },
        { status: 'حاضر' },
        { status: 'P' },
        { status: 'absent' },
        { status: 'leave' }
      ];
      // 3 present out of 5 = 60.0%
      expect(calculateTodayAttendanceRate(attendance)).toBe('60.0%');
    });

    it('calculateMonthFeesRate computes paid percentage or returns "—" if empty', () => {
      expect(calculateMonthFeesRate([])).toBe('—');

      const fees = [
        { month_year: '2026-09', status: 'paid' },
        { month_year: '2026-09', status: 'paid' },
        { month_year: '2026-09', status: 'unpaid' },
        { month_year: '2026-08', status: 'paid' }
      ];
      // For month 2026-09: 2 paid out of 3 = 66.7%
      expect(calculateMonthFeesRate(fees, '2026-09')).toBe('66.7%');
      expect(calculateMonthFeesRate(fees, '2026-10')).toBe('—');
    });

    it('calculateLatestExamAverage computes average of latest (year, term) pair', () => {
      expect(calculateLatestExamAverage([])).toBe('—');

      const examResults = [
        // Year 2025
        { year: 2025, term: 'first', pct: 90 },
        // Year 2026 first term
        { year: 2026, term: 'first', pct: 70 },
        { year: 2026, term: 'first', pct: 80 },
        // Year 2026 second term (latest)
        { year: 2026, term: 'second', pct: 85 },
        { year: 2026, term: 'second', pct: 95 }
      ];

      // Latest pair is 2026 second term, average of 85 and 95 is 90.0%
      expect(calculateLatestExamAverage(examResults)).toBe('90.0%');
    });
  });

  describe('Date and Month ISO Helpers', () => {
    it('getTodayDateIso and getCurrentMonthIso return proper format', () => {
      const fixedDate = new Date(2026, 8, 5); // September 5, 2026
      expect(getTodayDateIso(fixedDate)).toBe('2026-09-05');
      expect(getCurrentMonthIso(fixedDate)).toBe('2026-09');
    });
  });
});
