import { describe, it, expect } from 'vitest';
import {
  getIndividualStudentGrade,
  getWifaqGrade,
  getStudentTier,
  calculateClassGrading
} from './classGrading';

describe('classGrading utility', () => {
  describe('getIndividualStudentGrade (انفرادی طلباء کے درجات)', () => {
    it('returns ممتاز for 90 to 100', () => {
      expect(getIndividualStudentGrade(100).grade).toBe('ممتاز');
      expect(getIndividualStudentGrade(90).grade).toBe('ممتاز');
      expect(getIndividualStudentGrade(95.5).grade).toBe('ممتاز');
    });

    it('returns جید جدا for 80 to 89', () => {
      expect(getIndividualStudentGrade(89).grade).toBe('جید جدا');
      expect(getIndividualStudentGrade(80).grade).toBe('جید جدا');
      expect(getIndividualStudentGrade(85).grade).toBe('جید جدا');
    });

    it('returns جید for 70 to 79', () => {
      expect(getIndividualStudentGrade(79).grade).toBe('جید');
      expect(getIndividualStudentGrade(70).grade).toBe('جید');
      expect(getIndividualStudentGrade(75).grade).toBe('جید');
    });

    it('returns مقبول for 60 to 69', () => {
      expect(getIndividualStudentGrade(69).grade).toBe('مقبول');
      expect(getIndividualStudentGrade(60).grade).toBe('مقبول');
      expect(getIndividualStudentGrade(62).grade).toBe('مقبول');
    });

    it('returns فیل for less than 60', () => {
      expect(getIndividualStudentGrade(59).grade).toBe('فیل');
      expect(getIndividualStudentGrade(40).grade).toBe('فیل');
      expect(getIndividualStudentGrade(0).grade).toBe('فیل');
    });

    it('handles edge cases gracefully', () => {
      expect(getIndividualStudentGrade('').grade).toBe('—');
      expect(getIndividualStudentGrade(null).grade).toBe('—');
      expect(getIndividualStudentGrade(105).grade).toBe('غلط');
    });
  });

  describe('getWifaqGrade (وفاق المدارس کے درجات)', () => {
    it('returns ممتاز for 80 to 100', () => {
      expect(getWifaqGrade(100).grade).toBe('ممتاز');
      expect(getWifaqGrade(80).grade).toBe('ممتاز');
    });

    it('returns جید جدا for 60 to 79', () => {
      expect(getWifaqGrade(79).grade).toBe('جید جدا');
      expect(getWifaqGrade(60).grade).toBe('جید جدا');
    });

    it('returns جید for 50 to 59', () => {
      expect(getWifaqGrade(59).grade).toBe('جید');
      expect(getWifaqGrade(50).grade).toBe('جید');
    });

    it('returns مقبول for 40 to 49', () => {
      expect(getWifaqGrade(49).grade).toBe('مقبول');
      expect(getWifaqGrade(40).grade).toBe('مقبول');
    });

    it('returns فیل for less than 40', () => {
      expect(getWifaqGrade(39).grade).toBe('فیل');
      expect(getWifaqGrade(0).grade).toBe('فیل');
    });
  });

  describe('getStudentTier (اعلیٰ، اوسط، کمزور)', () => {
    it('categorizes 80%+ as اعلیٰ', () => {
      expect(getStudentTier(80)).toBe('اعلیٰ');
      expect(getStudentTier(95)).toBe('اعلیٰ');
    });

    it('categorizes 60% to 79.9% as اوسط', () => {
      expect(getStudentTier(79)).toBe('اوسط');
      expect(getStudentTier(60)).toBe('اوسط');
    });

    it('categorizes <60% as کمزور', () => {
      expect(getStudentTier(59.9)).toBe('کمزور');
      expect(getStudentTier(30)).toBe('کمزور');
    });
  });

  describe('calculateClassGrading (کلاس کی درجہ بندی)', () => {
    it('classifies as اعلیٰ A when 65% اعلیٰ, 25% اوسط, 10% کمزور (Image row 1)', () => {
      // 20 students: 13 اعلیٰ (65%), 5 اوسط (25%), 2 کمزور (10%)
      const students = [
        ...Array(13).fill({ pct: 85 }),
        ...Array(5).fill({ pct: 70 }),
        ...Array(2).fill({ pct: 50 })
      ];
      const res = calculateClassGrading(students);
      expect(res.classGrade).toBe('اعلیٰ A');
      expect(res.aPct).toBe(65);
      expect(res.mPct).toBe(25);
      expect(res.wPct).toBe(10);
    });

    it('classifies as اعلیٰ B when 65% اعلیٰ, 15% اوسط, 20% کمزور (Image row 2)', () => {
      // 20 students: 13 اعلیٰ (65%), 3 اوسط (15%), 4 کمزور (20%)
      const students = [
        ...Array(13).fill({ pct: 85 }),
        ...Array(3).fill({ pct: 70 }),
        ...Array(4).fill({ pct: 50 })
      ];
      const res = calculateClassGrading(students);
      expect(res.classGrade).toBe('اعلیٰ B');
      expect(res.aPct).toBe(65);
      expect(res.mPct).toBe(15);
      expect(res.wPct).toBe(20);
    });

    it('classifies as اوسط when 50% اعلیٰ, 25% اوسط, 25% کمزور (Image row 3)', () => {
      // 20 students: 10 اعلیٰ (50%), 5 اوسط (25%), 5 کمزور (25%)
      const students = [
        ...Array(10).fill({ pct: 85 }),
        ...Array(5).fill({ pct: 70 }),
        ...Array(5).fill({ pct: 50 })
      ];
      const res = calculateClassGrading(students);
      expect(res.classGrade).toBe('اوسط');
      expect(res.aPct).toBe(50);
      expect(res.mPct).toBe(25);
      expect(res.wPct).toBe(25);
    });

    it('classifies as کمزور when اعلیٰ < 50% (Image row 4 rule: 49% اعلیٰ or weak > 25%)', () => {
      // 100 students: 49 اعلیٰ (49%), 25 اوسط (25%), 26 کمزور (26%)
      const students = [
        ...Array(49).fill({ pct: 85 }),
        ...Array(25).fill({ pct: 70 }),
        ...Array(26).fill({ pct: 50 })
      ];
      const res = calculateClassGrading(students);
      expect(res.classGrade).toBe('کمزور');
      expect(res.aPct).toBe(49);
      expect(res.wPct).toBe(26);
    });

    it('classifies as کمزور if weak > 25% even with high aPct', () => {
      // 10 students: 7 اعلیٰ (70%), 0 اوسط, 3 کمزور (30%)
      const students = [
        ...Array(7).fill({ pct: 85 }),
        ...Array(3).fill({ pct: 50 })
      ];
      const res = calculateClassGrading(students);
      expect(res.classGrade).toBe('کمزور');
      expect(res.wPct).toBe(30);
    });

    it('handles empty students array', () => {
      const res = calculateClassGrading([]);
      expect(res.classGrade).toBe('—');
      expect(res.total).toBe(0);
    });
  });
});
