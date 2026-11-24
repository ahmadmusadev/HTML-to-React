import { describe, it, expect } from 'vitest';
import {
  getDaysDifference,
  formatDateISO,
  evaluateTaskTiming,
  generateAutomatedTasks,
  URDU_MONTH_NAMES
} from './tasksEngine';

describe('tasksEngine Tests', () => {
  it('correctly calculates difference in days between two dates', () => {
    expect(getDaysDifference('2026-11-26', '2026-11-24')).toBe(2);
    expect(getDaysDifference('2026-11-24', '2026-11-24')).toBe(0);
    expect(getDaysDifference('2026-11-21', '2026-11-24')).toBe(-3);
  });

  it('correctly formats date to YYYY-MM-DD', () => {
    const d = new Date(2026, 10, 24); // Month is 0-indexed: 10 is November
    expect(formatDateISO(d)).toBe('2026-11-24');
  });

  describe('evaluateTaskTiming according to user rules', () => {
    const refDate = new Date('2026-11-24T00:00:00Z');

    it('identifies completed tasks', () => {
      const res = evaluateTaskTiming('2026-11-20', true, refDate);
      expect(res.statusKey).toBe('completed');
      expect(res.statusLabel).toBe('مکمل شدہ');
      expect(res.badgeClass).toBe('badge-completed');
    });

    it('identifies tasks due today (0 days difference)', () => {
      const res = evaluateTaskTiming('2026-11-24', false, refDate);
      expect(res.statusKey).toBe('due_today');
      expect(res.statusLabel).toBe('آج کی مقررہ میعاد');
      expect(res.isDueToday).toBe(true);
      expect(res.isInNotificationWindow).toBe(true);
    });

    it('identifies advance notice tasks (exactly 1 or 2 days before due date)', () => {
      const res1 = evaluateTaskTiming('2026-11-25', false, refDate); // 1 day ahead
      expect(res1.statusKey).toBe('advance_notice');
      expect(res1.isAdvanceNotice).toBe(true);
      expect(res1.isInNotificationWindow).toBe(true);
      expect(res1.statusLabel).toContain('پیشگی اطلاع');

      const res2 = evaluateTaskTiming('2026-11-26', false, refDate); // 2 days ahead
      expect(res2.statusKey).toBe('advance_notice');
      expect(res2.isAdvanceNotice).toBe(true);
      expect(res2.isInNotificationWindow).toBe(true);
    });

    it('identifies overdue tasks within the 3-day notification window (1 to 3 days past due)', () => {
      const res1 = evaluateTaskTiming('2026-11-23', false, refDate); // 1 day overdue
      expect(res1.statusKey).toBe('overdue');
      expect(res1.isOverdue).toBe(true);
      expect(res1.isInNotificationWindow).toBe(true);
      expect(res1.statusLabel).toContain('1 دن تاخیر');

      const res2 = evaluateTaskTiming('2026-11-22', false, refDate); // 2 days overdue
      expect(res2.statusKey).toBe('overdue');
      expect(res2.isOverdue).toBe(true);
      expect(res2.isInNotificationWindow).toBe(true);
      expect(res2.statusLabel).toContain('2 دن تاخیر');

      const res3 = evaluateTaskTiming('2026-11-21', false, refDate); // 3 days overdue
      expect(res3.statusKey).toBe('overdue');
      expect(res3.isOverdue).toBe(true);
      expect(res3.isInNotificationWindow).toBe(true);
      expect(res3.statusLabel).toContain('3 دن تاخیر');
    });

    it('identifies tasks overdue beyond the 3-day window as past_due', () => {
      const res = evaluateTaskTiming('2026-11-20', false, refDate); // 4 days overdue
      expect(res.statusKey).toBe('past_due');
      expect(res.isInNotificationWindow).toBe(false);
    });

    it('identifies future tasks beyond the 2-day advance notice', () => {
      const res = evaluateTaskTiming('2026-11-28', false, refDate); // 4 days ahead
      expect(res.statusKey).toBe('future');
      expect(res.isInNotificationWindow).toBe(false);
    });
  });

  describe('generateAutomatedTasks', () => {
    it('generates the 8 core automated tasks for madrasa', async () => {
      const tasks = await generateAutomatedTasks({
        madrasaId: '123e4567-e89b-12d3-a456-426614174000',
        classesList: [{ id: 'c1', name: 'درجہ اول' }, { id: 'c2', name: 'درجہ دوم' }],
        currentDate: new Date('2026-11-24')
      });

      expect(tasks).toHaveLength(8);

      const titles = tasks.map(t => t.title);
      expect(titles.some(t => t.includes('طلبہ کی یومیہ حاضری'))).toBe(true);
      expect(titles.some(t => t.includes('اساتذہ و ملازمین کی حاضری'))).toBe(true);
      expect(titles.some(t => t.includes('ماہانہ خواندگی کا ابتدائی اندراج'))).toBe(true);
      expect(titles.some(t => t.includes('ماہانہ خواندگی کی مکمل رپورٹ'))).toBe(true);
      expect(titles.some(t => t.includes('ماہانہ تعلیمی جائزہ'))).toBe(true);
      expect(titles.some(t => t.includes('ماہانہ فیس کا اجراء'))).toBe(true);
      expect(titles.some(t => t.includes('اساتذہ و ملازمین کا مشاہرہ'))).toBe(true);
      expect(titles.some(t => t.includes('امتحانی نتائج کا اندراج'))).toBe(true);
    });

    it('returns empty array when madrasaId is missing', async () => {
      const tasks = await generateAutomatedTasks({
        madrasaId: null
      });
      expect(tasks).toEqual([]);
    });
  });
});
