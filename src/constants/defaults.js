/**
 * Shared default constants used across multiple components.
 * Centralizing these prevents duplication and drift.
 */

export const DEFAULT_CLASSES = [
  { id: 'cls-1', name: 'حفظِ قرآن — ناظرہ', teacher: 'مولانا عبدالرحمن' },
  { id: 'cls-2', name: 'حفظِ قرآن — سال اول', teacher: 'مولانا محمد اسحاق' },
  { id: 'cls-3', name: 'حفظِ قرآن — سال دوم', teacher: 'مولانا یوسف' },
  { id: 'cls-4', name: 'حفظِ قرآن — سال سوم', teacher: 'مولانا ابراہیم' },
  { id: 'cls-5', name: 'حفظِ قرآن — سال چہارم', teacher: 'مولانا عبداللہ' }
];

export const MADRASA_PLANS = [
  {
    id: 'free_maktab',
    name: 'ابتدائی / مکتب پلان (مفت)',
    maxStudents: 50,
    badgeText: 'مکتب (50 طلباء)'
  },
  {
    id: 'standard_madrasa',
    name: 'معیاری مدرسہ پلان',
    maxStudents: 150,
    badgeText: 'معیاری (150 طلباء)'
  },
  {
    id: 'large_jamia',
    name: 'بڑا جامعہ پلان',
    maxStudents: 300,
    badgeText: 'جامعہ (300 طلباء)'
  },
  {
    id: 'custom_unlimited',
    name: 'ملٹی برانچ یا حسبِ ضرورت کوٹہ',
    maxStudents: 500,
    badgeText: 'حسبِ ضرورت'
  }
];

export const getPlanDetails = (planName, customMax) => {
  const matched = MADRASA_PLANS.find(p => p.id === planName);
  const effectiveMax = Number(customMax) > 0 ? Number(customMax) : (matched?.maxStudents || 50);
  if (matched) {
    return {
      ...matched,
      maxStudents: effectiveMax,
      badgeText: matched.id === 'custom_unlimited' 
        ? `حسبِ ضرورت (${effectiveMax} طلباء)` 
        : matched.badgeText
    };
  }
  return {
    id: planName || 'free_maktab',
    name: 'ابتدائی / مکتب پلان (مفت)',
    maxStudents: effectiveMax,
    badgeText: `کوٹہ: ${effectiveMax} طلباء`
  };
};
