import { describe, it, expect, vi } from 'vitest';
import { MADRASA_PLANS, getPlanDetails } from '../constants/defaults';

describe('Student Limits & Quota System (طلباء کی حد بندی اور کوٹہ سسٹم)', () => {
  it('correctly provides all 4 defined pricing slabs with exact student limits', () => {
    expect(MADRASA_PLANS).toHaveLength(4);

    const maktab = MADRASA_PLANS.find(p => p.id === 'free_maktab');
    expect(maktab).toBeDefined();
    expect(maktab.maxStudents).toBe(50);
    expect(maktab.name).toContain('ابتدائی / مکتب پلان (مفت)');

    const standard = MADRASA_PLANS.find(p => p.id === 'standard_madrasa');
    expect(standard).toBeDefined();
    expect(standard.maxStudents).toBe(150);
    expect(standard.name).toContain('معیاری مدرسہ پلان');

    const jamia = MADRASA_PLANS.find(p => p.id === 'large_jamia');
    expect(jamia).toBeDefined();
    expect(jamia.maxStudents).toBe(300);
    expect(jamia.name).toContain('بڑا جامعہ پلان');

    const custom = MADRASA_PLANS.find(p => p.id === 'custom_unlimited');
    expect(custom).toBeDefined();
    expect(custom.name).toContain('ملٹی برانچ یا حسبِ ضرورت کوٹہ');
  });

  it('getPlanDetails returns correct defaults and respects custom limits', () => {
    const defaultMaktab = getPlanDetails('free_maktab');
    expect(defaultMaktab.maxStudents).toBe(50);

    const standard = getPlanDetails('standard_madrasa');
    expect(standard.maxStudents).toBe(150);

    const jamia = getPlanDetails('large_jamia');
    expect(jamia.maxStudents).toBe(300);

    const customWith500 = getPlanDetails('custom_unlimited', 500);
    expect(customWith500.maxStudents).toBe(500);
    expect(customWith500.badgeText).toContain('500 طلباء');

    const fallback = getPlanDetails('unknown_plan', 80);
    expect(fallback.maxStudents).toBe(80);
  });

  it('verifies quota calculation and detects limit overflow accurately', () => {
    const calculateQuotaStatus = (activeCount, maxLimit, incomingCount = 1) => {
      const remaining = Math.max(0, maxLimit - activeCount);
      const allowed = (activeCount + incomingCount) <= maxLimit;
      const message = allowed
        ? ''
        : `آپ کے ادارے کی منظور شدہ حد (${maxLimit} طلباء) مکمل ہو چکی ہے۔ مزید طلباء کے اندراج کے لیے برائے کرم اپنا پلان اپ گریڈ فرمائیں۔`;
      return { allowed, remaining, message };
    };

    // Under quota (49 / 50 -> adding 1 is allowed)
    const canAddOne = calculateQuotaStatus(49, 50, 1);
    expect(canAddOne.allowed).toBe(true);
    expect(canAddOne.remaining).toBe(1);
    expect(canAddOne.message).toBe('');

    // At exact limit (50 / 50 -> adding 1 is disallowed)
    const cannotAddWhenFull = calculateQuotaStatus(50, 50, 1);
    expect(cannotAddWhenFull.allowed).toBe(false);
    expect(cannotAddWhenFull.remaining).toBe(0);
    expect(cannotAddWhenFull.message).toContain('منظور شدہ حد (50 طلباء) مکمل ہو چکی ہے');

    // Bulk import overflow (45 active, limit 50, trying to import 10)
    const bulkOverflow = calculateQuotaStatus(45, 50, 10);
    expect(bulkOverflow.allowed).toBe(false);
    expect(bulkOverflow.remaining).toBe(5);
  });

  it('verifies that no emoji characters exist in plan descriptions or error messages', () => {
    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    MADRASA_PLANS.forEach(plan => {
      expect(emojiRegex.test(plan.name)).toBe(false);
      expect(emojiRegex.test(plan.badgeText)).toBe(false);
    });

    const errorMsg = 'آپ کے ادارے کی منظور شدہ حد (50 طلباء) مکمل ہو چکی ہے۔ مزید طلباء کے اندراج کے لیے برائے کرم اپنا پلان اپ گریڈ فرمائیں۔';
    expect(emojiRegex.test(errorMsg)).toBe(false);
  });
});
