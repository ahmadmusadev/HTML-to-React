import { describe, it, expect } from 'vitest';
import {
  parseSubjectMark,
  classifyMizanCategory,
  allocateCategoryPercentages,
  calculateSubjectAnalysis,
  MIZAN_CATEGORIES,
  SUBJECT_CONFIGS
} from './mizanAnalysis';

describe('Mizan Analysis Utility - Pure Logic Tests', () => {
  describe('parseSubjectMark', () => {
    it('correctly handles genuine score of 0 as valid', () => {
      expect(parseSubjectMark(0, 60)).toEqual({ isPresent: true, mark: 0 });
      expect(parseSubjectMark('0', 60)).toEqual({ isPresent: true, mark: 0 });
      expect(parseSubjectMark(0, 10)).toEqual({ isPresent: true, mark: 0 });
      expect(parseSubjectMark('0', 10)).toEqual({ isPresent: true, mark: 0 });
    });

    it('correctly parses valid positive numbers and numeric strings', () => {
      expect(parseSubjectMark(56, 60)).toEqual({ isPresent: true, mark: 56 });
      expect(parseSubjectMark('54', 60)).toEqual({ isPresent: true, mark: 54 });
      expect(parseSubjectMark(8.5, 10)).toEqual({ isPresent: true, mark: 8.5 });
      expect(parseSubjectMark('9', 10)).toEqual({ isPresent: true, mark: 9 });
    });

    it('caps marks exceeding maxMarks at maxMarks', () => {
      expect(parseSubjectMark(65, 60)).toEqual({ isPresent: true, mark: 60 });
      expect(parseSubjectMark('12', 10)).toEqual({ isPresent: true, mark: 10 });
    });

    it('correctly identifies empty, null, undefined, or absent indicators', () => {
      expect(parseSubjectMark('', 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('   ', 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark(null, 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark(undefined, 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('-', 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('—', 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('غ', 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('A', 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('a', 60)).toEqual({ isPresent: false, mark: null });
    });

    it('rejects invalid or negative values as absent', () => {
      expect(parseSubjectMark(-5, 60)).toEqual({ isPresent: false, mark: null });
      expect(parseSubjectMark('abc', 60)).toEqual({ isPresent: false, mark: null });
    });
  });

  describe('classifyMizanCategory - Exact Thresholds', () => {
    it('classifies Manzil test cases accurately', () => {
      // 60/60 = 100% -> Category 1
      expect(classifyMizanCategory((60 / 60) * 100)).toBe(0);

      // 56/60 = 93.33% -> Category 1
      expect(classifyMizanCategory((56 / 60) * 100)).toBe(0);

      // 54/60 = 90% -> Category 1
      expect(classifyMizanCategory((54 / 60) * 100)).toBe(0);

      // 51/60 = 85% -> Category 2
      expect(classifyMizanCategory((51 / 60) * 100)).toBe(1);

      // 53.9 / 60 = 89.833% -> Category 2 (strictly below 90%)
      expect(classifyMizanCategory((53.9 / 60) * 100)).toBe(1);

      // 45/60 = 75% -> Category 3
      expect(classifyMizanCategory((45 / 60) * 100)).toBe(2);

      // 50.9 / 60 = 84.833% -> Category 3 (strictly below 85%)
      expect(classifyMizanCategory((50.9 / 60) * 100)).toBe(2);

      // 44/60 = 73.33% -> Category 4
      expect(classifyMizanCategory((44 / 60) * 100)).toBe(3);

      // 0/60 = 0% -> Category 4
      expect(classifyMizanCategory((0 / 60) * 100)).toBe(3);
    });

    it('classifies Tajweed test cases accurately', () => {
      // 10/10 = 100% -> Category 1
      expect(classifyMizanCategory((10 / 10) * 100)).toBe(0);

      // 9/10 = 90% -> Category 1
      expect(classifyMizanCategory((9 / 10) * 100)).toBe(0);

      // 8.5/10 = 85% -> Category 2
      expect(classifyMizanCategory((8.5 / 10) * 100)).toBe(1);

      // 8.9/10 = 89% -> Category 2
      expect(classifyMizanCategory((8.9 / 10) * 100)).toBe(1);

      // 8/10 = 80% -> Category 3
      expect(classifyMizanCategory((8 / 10) * 100)).toBe(2);

      // 7.5/10 = 75% -> Category 3
      expect(classifyMizanCategory((7.5 / 10) * 100)).toBe(2);

      // 7/10 = 70% -> Category 4
      expect(classifyMizanCategory((7 / 10) * 100)).toBe(3);

      // 0/10 = 0% -> Category 4
      expect(classifyMizanCategory((0 / 10) * 100)).toBe(3);
    });
  });

  describe('allocateCategoryPercentages - Largest Remainder Method', () => {
    it('ensures percentage sum is always 100% when participating students exist', () => {
      // Case 1: 3 students, 1 in each of Cat 1, 2, 3 (each raw 33.333%)
      // Floored: 33, 33, 33, 0 -> sum = 99 -> remainder 1 goes to index 0
      const pct1 = allocateCategoryPercentages([1, 1, 1, 0], 3);
      expect(pct1).toEqual([34, 33, 33, 0]);
      expect(pct1.reduce((a, b) => a + b, 0)).toBe(100);

      // Case 2: 7 students: 2 in Cat 1, 2 in Cat 2, 2 in Cat 3, 1 in Cat 4
      // 2/7 = 28.571%, 1/7 = 14.285%
      // Floored: 28, 28, 28, 14 -> sum = 98 -> rem = 2 -> indices with highest fraction (28.571%) get +1
      const pct2 = allocateCategoryPercentages([2, 2, 2, 1], 7);
      expect(pct2).toEqual([29, 29, 28, 14]);
      expect(pct2.reduce((a, b) => a + b, 0)).toBe(100);

      // Case 3: 1 student in Cat 1
      const pct3 = allocateCategoryPercentages([1, 0, 0, 0], 1);
      expect(pct3).toEqual([100, 0, 0, 0]);
      expect(pct3.reduce((a, b) => a + b, 0)).toBe(100);

      // Case 4: 6 students: 1, 2, 2, 1
      // 1/6 = 16.666%, 2/6 = 33.333%
      // Floored: 16, 33, 33, 16 -> sum = 98 -> rem = 2 -> indices 0 and 3 have fraction 0.666%, indices 1 and 2 have 0.333%
      // So indices 0 and 3 get +1
      const pct4 = allocateCategoryPercentages([1, 2, 2, 1], 6);
      expect(pct4).toEqual([17, 33, 33, 17]);
      expect(pct4.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('returns [0, 0, 0, 0] when no participating students exist', () => {
      const pct = allocateCategoryPercentages([0, 0, 0, 0], 0);
      expect(pct).toEqual([0, 0, 0, 0]);
    });
  });

  describe('calculateSubjectAnalysis - Integration with Student Class Records', () => {
    const sampleClass = [
      { student: { id: 's1', admRegNo: '101', name: 'طالب 1' }, manzil: 60, tajweed: 10 },  // Cat 1 for both
      { student: { id: 's2', admRegNo: '102', name: 'طالب 2' }, manzil: 56, tajweed: 9 },   // Cat 1 for both
      { student: { id: 's3', admRegNo: '103', name: 'طالب 3' }, manzil: 51, tajweed: 8.5 }, // Cat 2 for both
      { student: { id: 's4', admRegNo: '104', name: 'طالب 4' }, manzil: 45, tajweed: 8 },   // Cat 3 for both
      { student: { id: 's5', admRegNo: '105', name: 'طالب 5' }, manzil: 44, tajweed: 7 },   // Cat 4 for both
      { student: { id: 's6', admRegNo: '106', name: 'طالب 6' }, manzil: 0, tajweed: 0 },    // Cat 4 for both (genuine 0)
      { student: { id: 's7', admRegNo: '107', name: 'طالب 7' }, manzil: '', tajweed: '-' },  // Absent for both
      { student: { id: 's8', admRegNo: '108', name: 'طالب 8' }, manzil: null, tajweed: 'غ' } // Absent for both
    ];

    it('produces independent and accurate Manzil analysis', () => {
      const result = calculateSubjectAnalysis(sampleClass, 'manzil');

      expect(result.subjectKey).toBe('manzil');
      expect(result.subjectName).toBe('منزل');
      expect(result.maxMarks).toBe(60);
      expect(result.totalEntries).toBe(8);
      expect(result.participating).toBe(6);
      expect(result.absent).toBe(2);

      // Counts:
      // Cat 1 (>=90%): 60 (100%), 56 (93.33%) => 2 students
      // Cat 2 (>=85% and <90%): 51 (85%) => 1 student
      // Cat 3 (>=75% and <85%): 45 (75%) => 1 student
      // Cat 4 (<75%): 44 (73.33%), 0 (0%) => 2 students
      expect(result.counts).toEqual([2, 1, 1, 2]);

      // Percentages out of 6 participating:
      // 2/6 = 33.33%, 1/6 = 16.66%
      // [33, 17, 17, 33] -> sum = 100%
      expect(result.pct).toEqual([33, 17, 17, 33]);
      expect(result.totalPct).toBe(100);

      // Student rows verification
      expect(result.students).toHaveLength(8);
      expect(result.students[0].name).toBe('طالب 1');
      expect(result.students[0].mark).toBe(60);
      expect(result.students[0].categoryIndex).toBe(0);
      expect(result.students[0].isAbsent).toBe(false);

      expect(result.students[5].name).toBe('طالب 6');
      expect(result.students[5].mark).toBe(0);
      expect(result.students[5].percentage).toBe(0);
      expect(result.students[5].categoryIndex).toBe(3);
      expect(result.students[5].isAbsent).toBe(false);

      expect(result.students[6].isAbsent).toBe(true);
      expect(result.students[6].mark).toBeNull();
      expect(result.students[7].isAbsent).toBe(true);
      expect(result.students[7].mark).toBeNull();
    });

    it('produces independent and accurate Tajweed analysis', () => {
      const result = calculateSubjectAnalysis(sampleClass, 'tajweed');

      expect(result.subjectKey).toBe('tajweed');
      expect(result.subjectName).toBe('تجوید');
      expect(result.maxMarks).toBe(10);
      expect(result.totalEntries).toBe(8);
      expect(result.participating).toBe(6);
      expect(result.absent).toBe(2);

      // Tajweed marks: 10, 9, 8.5, 8, 7, 0
      // 10/10 = 100% (Cat 1)
      // 9/10 = 90% (Cat 1)
      // 8.5/10 = 85% (Cat 2)
      // 8/10 = 80% (Cat 3)
      // 7/10 = 70% (Cat 4)
      // 0/10 = 0% (Cat 4)
      expect(result.counts).toEqual([2, 1, 1, 2]);
      expect(result.pct).toEqual([33, 17, 17, 33]);
      expect(result.totalPct).toBe(100);
    });

    it('correctly handles a subject where marks differ between Manzil and Tajweed', () => {
      const mixedClass = [
        { student: { id: 's1', name: 'طالب الف' }, manzil: 58, tajweed: 7 }, // Manzil: Cat 1, Tajweed: Cat 4
        { student: { id: 's2', name: 'طالب ب' }, manzil: 42, tajweed: 10 }  // Manzil: Cat 4, Tajweed: Cat 1
      ];

      const manzilRes = calculateSubjectAnalysis(mixedClass, 'manzil');
      expect(manzilRes.counts).toEqual([1, 0, 0, 1]);

      const tajweedRes = calculateSubjectAnalysis(mixedClass, 'tajweed');
      expect(tajweedRes.counts).toEqual([1, 0, 0, 1]);

      expect(manzilRes.students[0].categoryIndex).toBe(0);
      expect(tajweedRes.students[0].categoryIndex).toBe(3);

      expect(manzilRes.students[1].categoryIndex).toBe(3);
      expect(tajweedRes.students[1].categoryIndex).toBe(0);
    });

    it('gracefully handles a class with no participating students', () => {
      const allAbsent = [
        { student: { name: 'طالب 1' }, manzil: '', tajweed: '' },
        { student: { name: 'طالب 2' }, manzil: '-', tajweed: '-' }
      ];

      const res = calculateSubjectAnalysis(allAbsent, 'manzil');
      expect(res.totalEntries).toBe(2);
      expect(res.participating).toBe(0);
      expect(res.absent).toBe(2);
      expect(res.counts).toEqual([0, 0, 0, 0]);
      expect(res.pct).toEqual([0, 0, 0, 0]);
      expect(res.totalPct).toBe(0);
    });

    it('handles empty class array without error', () => {
      const res = calculateSubjectAnalysis([], 'tajweed');
      expect(res.totalEntries).toBe(0);
      expect(res.participating).toBe(0);
      expect(res.absent).toBe(0);
      expect(res.counts).toEqual([0, 0, 0, 0]);
      expect(res.pct).toEqual([0, 0, 0, 0]);
      expect(res.totalPct).toBe(0);
    });
  });
});

