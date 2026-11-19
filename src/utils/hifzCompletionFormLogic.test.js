import { describe, it, expect } from 'vitest';
import {
  calculateDuration,
  calculateAgeAtBenchmark,
  toHijriDateString,
  getGradeFromScore,
  initializeDepartmentStartDates,
  mapCompletionFormSupabaseToUi,
  mapCompletionFormUiToSupabase
} from './hifzCompletionFormLogic';

describe('hifzCompletionFormLogic', () => {
  describe('calculateDuration', () => {
    it('returns empty text for missing or invalid dates', () => {
      expect(calculateDuration('', '').text).toBe('');
      expect(calculateDuration(null, '2026-05-20').text).toBe('');
      expect(calculateDuration('invalid', '2026-05-20').text).toBe('');
    });

    it('returns error text if end date is earlier than start date', () => {
      expect(calculateDuration('2026-05-20', '2020-11-01').text).toBe('غلط تاریخ');
    });

    it('calculates duration accurately matching reference case (2020-11-01 to 2026-05-20)', () => {
      const res = calculateDuration('2020-11-01', '2026-05-20');
      expect(res.years).toBe(5);
      expect(res.months).toBe(6);
      expect(res.days).toBe(19);
      expect(res.text).toBe('5 سال، 6 ماہ، 19 دن');
    });

    it('calculates daur revision duration accurately (e.g. 1 month 19 days)', () => {
      const res = calculateDuration('2026-04-01', '2026-05-20');
      expect(res.years).toBe(0);
      expect(res.months).toBe(1);
      expect(res.days).toBe(19);
      expect(res.text).toBe('0 سال، 1 ماہ، 19 دن');
    });
  });

  describe('calculateAgeAtBenchmark', () => {
    it('calculates age at benchmark date accurately', () => {
      // 2015-08-06 to 2026-04-01
      const ageStr = calculateAgeAtBenchmark('2015-08-06', '2026-04-01');
      expect(ageStr).toBe('10 سال، 7 ماہ، 26 دن');
    });
  });

  describe('toHijriDateString', () => {
    it('formats a valid gregorian date into hijri format or fallback', () => {
      const hijri = toHijriDateString('2026-05-20');
      expect(typeof hijri).toBe('string');
      if (hijri) {
        expect(hijri).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('returns empty string for invalid inputs', () => {
      expect(toHijriDateString('')).toBe('');
      expect(toHijriDateString(null)).toBe('');
    });
  });

  describe('getGradeFromScore', () => {
    it('maps scores to correct Urdu grades with default 100 total marks', () => {
      expect(getGradeFromScore(95)).toBe('ممتاز');
      expect(getGradeFromScore(80)).toBe('ممتاز');
      expect(getGradeFromScore(75)).toBe('جید جدا');
      expect(getGradeFromScore(63)).toBe('جید');
      expect(getGradeFromScore(55)).toBe('مقبول');
      expect(getGradeFromScore(40)).toBe('راسب');
      expect(getGradeFromScore(0)).toBe('—');
      expect(getGradeFromScore('')).toBe('—');
    });

    it('calculates grades correctly when custom total marks are provided', () => {
      // Out of 50: 40/50 is 80% (ممتاز), 35/50 is 70% (جید جدا), 25/50 is 50% (مقبول), 20/50 is 40% (راسب)
      expect(getGradeFromScore(40, 50)).toBe('ممتاز');
      expect(getGradeFromScore(35, 50)).toBe('جید جدا');
      expect(getGradeFromScore(25, 50)).toBe('مقبول');
      expect(getGradeFromScore(20, 50)).toBe('راسب');
    });
  });

  describe('initializeDepartmentStartDates', () => {
    it('initializes qaida start date and initial department when enrolling into Qaida', () => {
      const res = initializeDepartmentStartDates('2019-04-04', 'قاعدہ');
      expect(res.initial_department).toBe('قاعدہ');
      expect(res.qaida_start_date).toBe('2019-04-04');
      expect(res.nazira_start_date).toBeNull();
      expect(res.hifz_start_date).toBeNull();
    });

    it('initializes nazira start date when enrolling into Nazira', () => {
      const res = initializeDepartmentStartDates('2019-04-03', 'ناظرہ');
      expect(res.initial_department).toBe('ناظرہ');
      expect(res.nazira_start_date).toBe('2019-04-03');
    });

    it('initializes hifz start date when enrolling into Hifz', () => {
      const res = initializeDepartmentStartDates('2020-11-01', 'حفظ');
      expect(res.initial_department).toBe('حفظ');
      expect(res.hifz_start_date).toBe('2020-11-01');
    });

    it('preserves existing milestones if already set', () => {
      const existing = {
        initial_department: 'قاعدہ',
        qaida_start_date: '2019-04-04',
        nazira_start_date: '2020-01-01'
      };
      const res = initializeDepartmentStartDates('2021-01-01', 'حفظ', existing);
      expect(res.initial_department).toBe('قاعدہ');
      expect(res.qaida_start_date).toBe('2019-04-04');
      expect(res.nazira_start_date).toBe('2020-01-01');
      expect(res.hifz_start_date).toBe('2021-01-01');
    });
  });

  describe('mapping functions', () => {
    const mockDbRow = {
      id: 'a0000000-0000-0000-0000-000000000001',
      madrasa_id: 'b0000000-0000-0000-0000-000000000002',
      student_id: 'c0000000-0000-0000-0000-000000000003',
      computer_id: '100723',
      initial_department: 'قاعدہ',
      admission_date: '2019-04-04',
      qaida_start_date: '2019-04-04',
      qaida_completion_date: null,
      nazira_start_date: '2019-04-03',
      nazira_completion_date: '2020-09-23',
      hifz_start_date: '2020-11-01',
      hifz_completion_date: '2026-05-20',
      hifz_completion_hijri: '1447-11-20',
      hifz_duration_text: '5 سال، 6 ماہ، 19 دن',
      daur_duration_text: '0 سال، 1 ماہ، 19 دن',
      branch_name: 'شاخ سیدنا حمزہ',
      area_name: 'بیدیاں لاہور',
      teacher_name: 'قاری عبد اللطیف صاحب',
      overall_quality: 'اوسط',
      shishmahi_marks: 83,
      shishmahi_grade: 'جید',
      salana_marks: 0,
      salana_grade: '',
      wifaq_marks: 0,
      wifaq_grade: '',
      attendance_quality: 'بہترین',
      parents_conduct: 'مناسب',
      monthly_fee: 4400,
      fee_concession: 0,
      concession_type: '',
      special_notes: 'ماشاءاللہ باصلاحیت طالب علم ہے',
      form_date: '2026-05-20',
      preparer_name: 'ایڈمن'
    };

    it('maps Supabase row to UI object correctly', () => {
      const ui = mapCompletionFormSupabaseToUi(mockDbRow);
      expect(ui.id).toBe('a0000000-0000-0000-0000-000000000001');
      expect(ui.computerId).toBe('100723');
      expect(ui.initialDepartment).toBe('قاعدہ');
      expect(ui.shishmahiTotalMarks).toBe(100);
      expect(ui.shishmahiMarks).toBe(83);
      expect(ui.monthlyFee).toBe(4400);
      expect(ui.specialNotes).toBe('ماشاءاللہ باصلاحیت طالب علم ہے');
    });

    it('maps UI object to Supabase payload correctly', () => {
      const uiData = {
        id: 'a0000000-0000-0000-0000-000000000001',
        computerId: '100723',
        initialDepartment: 'قاعدہ',
        admissionDate: '2019-04-04',
        hifzStartDate: '2020-11-01',
        hifzCompletionDate: '2026-05-20',
        hifzDurationText: '5 سال، 6 ماہ، 19 دن',
        shishmahiTotalMarks: '100',
        shishmahiMarks: '83',
        shishmahiGrade: 'جید',
        monthlyFee: '4400',
        feeConcession: '0',
        specialNotes: 'نوٹ'
      };
      const payload = mapCompletionFormUiToSupabase(
        uiData,
        'b0000000-0000-0000-0000-000000000002',
        'c0000000-0000-0000-0000-000000000003'
      );
      expect(payload.madrasa_id).toBe('b0000000-0000-0000-0000-000000000002');
      expect(payload.student_id).toBe('c0000000-0000-0000-0000-000000000003');
      expect(payload.shishmahi_total_marks).toBe(100);
      expect(payload.shishmahi_marks).toBe(83);
      expect(payload.monthly_fee).toBe(4400);
      expect(payload.special_notes).toBe('نوٹ');
    });
  });
});
