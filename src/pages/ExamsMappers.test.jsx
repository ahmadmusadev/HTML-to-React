import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  calculateTargetRuku,
  calculatePct,
  getExamGrade,
  getPctColor,
  mapExamMiqdarToUi,
  mapUiToExamMiqdarPayload,
  mapExamResultToUi,
  mapUiToExamResultPayload
} from '../utils/ExamsMappers';

describe('Exams Mappers & Calculation Utilities', () => {
  describe('isValidUUID', () => {
    it('returns true for standard UUID v4 strings (case-insensitive)', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('A58F2618-91FA-4E25-A226-6E57C36340B0')).toBe(true);
    });

    it('returns false for non-UUID strings, null, or undefined', () => {
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID('not-a-valid-uuid-format-here-1234567890')).toBe(false);
    });
  });

  describe('calculateTargetRuku', () => {
    it('calculates target ruku across multiple paras and rukus accurately', () => {
      // (5 - 1) * 8 + (1 - 1) = 32
      expect(calculateTargetRuku(1, 1, 5, 1)).toBe(32);
      // (2 - 1) * 8 + (3 - 1) = 10
      expect(calculateTargetRuku(1, 1, 2, 3)).toBe(10);
      // Within same para: (1 - 1) * 8 + (7 - 2) = 5
      expect(calculateTargetRuku(1, 2, 1, 7)).toBe(5);
    });

    it('parses string inputs cleanly', () => {
      expect(calculateTargetRuku('1', '1', '5', '1')).toBe(32);
      expect(calculateTargetRuku('1', '2', '1', '7')).toBe(5);
    });

    it('clamps negative values to 0 when end is before start', () => {
      expect(calculateTargetRuku(5, 1, 1, 1)).toBe(0);
      expect(calculateTargetRuku(2, 5, 2, 2)).toBe(0);
    });

    it('handles missing, null, or non-numeric inputs gracefully', () => {
      expect(calculateTargetRuku(null, undefined, '', '')).toBe(0);
      expect(calculateTargetRuku('abc', 'xyz', 'foo', 'bar')).toBe(0);
    });
  });

  describe('calculatePct', () => {
    it('calculates percentage accurately with rounding', () => {
      expect(calculatePct(32, 32)).toBe(100);
      expect(calculatePct(16, 32)).toBe(50);
      expect(calculatePct(10, 30)).toBe(33);
      expect(calculatePct(20, 30)).toBe(67);
      expect(calculatePct(40, 32)).toBe(125);
    });

    it('returns 0 when target ruku is 0 or negative', () => {
      expect(calculatePct(10, 0)).toBe(0);
      expect(calculatePct(0, 0)).toBe(0);
      expect(calculatePct(10, -5)).toBe(0);
    });

    it('handles string inputs cleanly', () => {
      expect(calculatePct('15', '20')).toBe(75);
      expect(calculatePct('0', '50')).toBe(0);
    });
  });

  describe('getExamGrade', () => {
    it('returns ممتاز for percentages >= 80', () => {
      expect(getExamGrade(100)).toBe('ممتاز');
      expect(getExamGrade(85)).toBe('ممتاز');
      expect(getExamGrade(80)).toBe('ممتاز');
      expect(getExamGrade('80')).toBe('ممتاز');
    });

    it('returns اچھا for percentages >= 60 and < 80', () => {
      expect(getExamGrade(79)).toBe('اچھا');
      expect(getExamGrade(65)).toBe('اچھا');
      expect(getExamGrade(60)).toBe('اچھا');
      expect(getExamGrade('60')).toBe('اچھا');
    });

    it('returns اوسط for percentages >= 40 and < 60', () => {
      expect(getExamGrade(59)).toBe('اوسط');
      expect(getExamGrade(45)).toBe('اوسط');
      expect(getExamGrade(40)).toBe('اوسط');
      expect(getExamGrade('40')).toBe('اوسط');
    });

    it('returns ضعیف for percentages < 40', () => {
      expect(getExamGrade(39)).toBe('ضعیف');
      expect(getExamGrade(10)).toBe('ضعیف');
      expect(getExamGrade(0)).toBe('ضعیف');
      expect(getExamGrade(-5)).toBe('ضعیف');
      expect(getExamGrade(null)).toBe('ضعیف');
    });
  });

  describe('getPctColor', () => {
    it('returns green #15803d for pct >= 80', () => {
      expect(getPctColor(80)).toBe('#15803d');
      expect(getPctColor(95)).toBe('#15803d');
    });

    it('returns amber #b45309 for pct >= 60 and < 80', () => {
      expect(getPctColor(60)).toBe('#b45309');
      expect(getPctColor(79)).toBe('#b45309');
    });

    it('returns red #dc2626 for pct < 60', () => {
      expect(getPctColor(59)).toBe('#dc2626');
      expect(getPctColor(30)).toBe('#dc2626');
      expect(getPctColor(0)).toBe('#dc2626');
    });
  });

  describe('mapExamMiqdarToUi', () => {
    it('correctly maps a Supabase exam_miqdar row with joined students and classes data', () => {
      const row = {
        id: 'miqdar-uuid-1',
        madrasa_id: 'madrasa-uuid-1',
        student_id: 'student-uuid-101',
        class_id: 'class-uuid-201',
        term: 'first',
        year: 2025,
        start_para: 1,
        start_ruku: 1,
        end_para: 5,
        end_ruku: 1,
        target_ruku: 32,
        students: {
          id: 'student-uuid-101',
          name: 'عبد اللہ',
          roll_number: '101',
          father_name: 'محمد علی'
        },
        classes: {
          id: 'class-uuid-201',
          class_name: 'حفظ اول'
        }
      };

      const ui = mapExamMiqdarToUi(row);
      expect(ui).toEqual({
        id: 'miqdar-uuid-1',
        studentId: 'student-uuid-101',
        regNo: '101',
        studentName: 'عبد اللہ',
        fatherName: 'محمد علی',
        classId: 'class-uuid-201',
        className: 'حفظ اول',
        term: 'first',
        year: 2025,
        startPara: 1,
        startRuku: 1,
        endPara: 5,
        endRuku: 1,
        targetRuku: 32
      });
    });

    it('handles rows with missing students or classes joins gracefully', () => {
      const row = {
        id: 'miqdar-uuid-2',
        student_id: 'student-uuid-102',
        class_id: 'class-uuid-202',
        term: 'second',
        year: '2026',
        start_para: 10,
        start_ruku: 2,
        end_para: 12,
        end_ruku: 2,
        target_ruku: 16
      };

      const ui = mapExamMiqdarToUi(row);
      expect(ui.studentId).toBe('student-uuid-102');
      expect(ui.regNo).toBe('');
      expect(ui.studentName).toBe('');
      expect(ui.year).toBe(2026);
      expect(ui.targetRuku).toBe(16);
    });

    it('returns null for falsy row input', () => {
      expect(mapExamMiqdarToUi(null)).toBeNull();
      expect(mapExamMiqdarToUi(undefined)).toBeNull();
    });
  });

  describe('mapUiToExamMiqdarPayload', () => {
    it('maps UI item with student object to Supabase payload', () => {
      const item = {
        student: {
          id: '11111111-1111-4111-a111-111111111101',
          admRegNo: '101',
          name: 'عبد اللہ',
          admClass: '22222222-2222-4222-a222-222222222201'
        },
        term: 'first',
        year: '2025',
        startPara: '1',
        startRuku: '1',
        endPara: '5',
        endRuku: '1'
      };

      const payload = mapUiToExamMiqdarPayload(item, '33333333-3333-4333-a333-333333333301');
      expect(payload).toMatchObject({
        madrasa_id: '33333333-3333-4333-a333-333333333301',
        student_id: '11111111-1111-4111-a111-111111111101',
        class_id: '22222222-2222-4222-a222-222222222201',
        term: 'first',
        year: 2025,
        start_para: 1,
        start_ruku: 1,
        end_para: 5,
        end_ruku: 1,
        target_ruku: 32
      });
      expect(payload.updated_at).toBeDefined();
    });

    it('handles flat UI objects and non-UUID class IDs gracefully', () => {
      const item = {
        studentId: 'student-uuid-102',
        classId: 'not-a-uuid',
        term: 'second',
        year: 2025,
        start_para: 2,
        start_ruku: 1,
        end_para: 3,
        end_ruku: 1
      };

      const payload = mapUiToExamMiqdarPayload(item, 'madrasa-uuid-1');
      expect(payload.student_id).toBe('student-uuid-102');
      expect(payload.class_id).toBeNull();
      expect(payload.target_ruku).toBe(8);
    });

    it('returns null for falsy item', () => {
      expect(mapUiToExamMiqdarPayload(null, 'madrasa-uuid-1')).toBeNull();
    });
  });

  describe('mapExamResultToUi', () => {
    it('correctly maps a Supabase exam_results row with joined students and classes data', () => {
      const row = {
        id: 'result-uuid-1',
        madrasa_id: 'madrasa-uuid-1',
        student_id: 'student-uuid-101',
        class_id: 'class-uuid-201',
        term: 'first',
        year: 2025,
        target_ruku: 32,
        achieved_ruku: 30,
        pct: 94,
        students: {
          id: 'student-uuid-101',
          name: 'عبد اللہ',
          roll_number: '101',
          father_name: 'محمد علی'
        },
        classes: {
          id: 'class-uuid-201',
          class_name: 'حفظ اول'
        }
      };

      const ui = mapExamResultToUi(row);
      expect(ui).toEqual({
        id: 'result-uuid-1',
        studentId: 'student-uuid-101',
        regNo: '101',
        studentName: 'عبد اللہ',
        fatherName: 'محمد علی',
        classId: 'class-uuid-201',
        classNm: 'حفظ اول',
        term: 'first',
        year: 2025,
        targetRuku: 32,
        achievedRuku: 30,
        pct: 94
      });
    });

    it('returns null for falsy row input', () => {
      expect(mapExamResultToUi(null)).toBeNull();
    });
  });

  describe('mapUiToExamResultPayload', () => {
    it('maps UI item to Supabase payload and calculates pct if omitted', () => {
      const item = {
        student: {
          id: '11111111-1111-4111-a111-111111111101',
          admClass: '22222222-2222-4222-a222-222222222201'
        },
        term: 'first',
        year: '2025',
        targetRuku: 40,
        achievedRuku: 32
      };

      const payload = mapUiToExamResultPayload(item, '33333333-3333-4333-a333-333333333301');
      expect(payload).toMatchObject({
        madrasa_id: '33333333-3333-4333-a333-333333333301',
        student_id: '11111111-1111-4111-a111-111111111101',
        class_id: '22222222-2222-4222-a222-222222222201',
        term: 'first',
        year: 2025,
        target_ruku: 40,
        achieved_ruku: 32,
        pct: 80
      });
      expect(payload.updated_at).toBeDefined();
    });

    it('preserves existing pct if explicitly provided', () => {
      const item = {
        studentId: 'student-uuid-102',
        classId: 'class-uuid-202',
        term: 'second',
        year: 2025,
        targetRuku: 50,
        achievedRuku: 25,
        pct: 50
      };

      const payload = mapUiToExamResultPayload(item, 'madrasa-uuid-1');
      expect(payload.pct).toBe(50);
    });

    it('returns null for falsy item', () => {
      expect(mapUiToExamResultPayload(null, 'madrasa-uuid-1')).toBeNull();
    });
  });

  describe('Class name fallback resolution chain', () => {
    const resolveClassName = (c) => c.name || c.className || c.class_name || c.id;

    it('resolves c.name first when present', () => {
      expect(resolveClassName({ id: 'cls-1', name: 'کلاس اول', class_name: 'کلاس دوم' })).toBe('کلاس اول');
    });

    it('falls back to c.className when c.name is missing', () => {
      expect(resolveClassName({ id: 'cls-2', className: 'کلاس دوم', class_name: 'کلاس سوم' })).toBe('کلاس دوم');
    });

    it('falls back to raw Supabase c.class_name when name and className are absent', () => {
      expect(resolveClassName({ id: 'cls-3', class_name: 'حفظ اول' })).toBe('حفظ اول');
    });

    it('falls back to c.id when all name fields are undefined or empty', () => {
      expect(resolveClassName({ id: 'class-uuid-99' })).toBe('class-uuid-99');
    });
  });
});

