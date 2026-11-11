/**
 * Constants and utility helpers for Para Completion Records (پارہ بہ پارہ تکمیلِ حفظ)
 */

export const REVERSE_PARAS_LIST = [
  { paraNumber: 30, serialNo: 1, name: 'عم' },
  { paraNumber: 29, serialNo: 2, name: 'تبارک الذی' },
  { paraNumber: 28, serialNo: 3, name: 'قد سمع اللہ' },
  { paraNumber: 27, serialNo: 4, name: 'قال فما خطبکم' },
  { paraNumber: 26, serialNo: 5, name: 'حـم' },
  { paraNumber: 25, serialNo: 6, name: 'الیہ یرد' },
  { paraNumber: 24, serialNo: 7, name: 'فمن اظلم' },
  { paraNumber: 23, serialNo: 8, name: 'وما لی' },
  { paraNumber: 22, serialNo: 9, name: 'ومن یقنت' },
  { paraNumber: 21, serialNo: 10, name: 'اتل ما اوحی' },
  { paraNumber: 20, serialNo: 11, name: 'امن خلق' },
  { paraNumber: 19, serialNo: 12, name: 'وقال الذین' },
  { paraNumber: 18, serialNo: 13, name: 'قد افلح' },
  { paraNumber: 17, serialNo: 14, name: 'اقترب للناس' },
  { paraNumber: 16, serialNo: 15, name: 'قال الم' },
  { paraNumber: 15, serialNo: 16, name: 'سبحن الذی' },
  { paraNumber: 14, serialNo: 17, name: 'ربما' },
  { paraNumber: 13, serialNo: 18, name: 'وما ابری' },
  { paraNumber: 12, serialNo: 19, name: 'وما من دابة' },
  { paraNumber: 11, serialNo: 20, name: 'یعتذرون' },
  { paraNumber: 10, serialNo: 21, name: 'واعلموا' },
  { paraNumber: 9, serialNo: 22, name: 'قال الملا' },
  { paraNumber: 8, serialNo: 23, name: 'ولو اننا' },
  { paraNumber: 7, serialNo: 24, name: 'واذا سمعوا' },
  { paraNumber: 6, serialNo: 25, name: 'لا یحب اللہ' },
  { paraNumber: 5, serialNo: 26, name: 'والمحصنت' },
  { paraNumber: 4, serialNo: 27, name: 'لن تنالوا' },
  { paraNumber: 3, serialNo: 28, name: 'تلک الرسل' },
  { paraNumber: 2, serialNo: 29, name: 'سیقول' },
  { paraNumber: 1, serialNo: 30, name: 'الم' }
];

export const FIVE_PARA_REVIEW_SLOTS = [
  { slot: 1, afterSerial: 5, title: 'تفصیلی جائزہ (پارہ 30 تا 26 — 5 پارے مکمل ہونے پر)', parasRange: '30 تا 26' },
  { slot: 2, afterSerial: 10, title: 'تفصیلی جائزہ (پارہ 25 تا 21 — 10 پارے مکمل ہونے پر)', parasRange: '25 تا 21' },
  { slot: 3, afterSerial: 15, title: 'تفصیلی جائزہ (پارہ 20 تا 16 — 15 پارے / نصف قرآن مکمل ہونے پر)', parasRange: '20 تا 16' },
  { slot: 4, afterSerial: 20, title: 'تفصیلی جائزہ (پارہ 15 تا 11 — 20 پارے مکمل ہونے پر)', parasRange: '15 تا 11' },
  { slot: 5, afterSerial: 25, title: 'تفصیلی جائزہ (پارہ 10 تا 6 — 25 پارے مکمل ہونے پر)', parasRange: '10 تا 6' },
  { slot: 6, afterSerial: 30, title: 'تفصیلی جائزہ (پارہ 5 تا 1 — تکمیلِ حفظِ قرآنِ کریم تفصیلی جائزہ)', parasRange: '5 تا 1' }
];

/**
 * Calculates days taken between start date and end date inclusive.
 */
export const calculateDaysTaken = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  if (e < s) return 0;
  const diffMs = e.getTime() - s.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return days;
};

/**
 * Generates initial 30 paras array.
 */
export const createInitialParasArray = () => {
  return REVERSE_PARAS_LIST.map(p => ({
    serialNo: p.serialNo,
    paraNumber: p.paraNumber,
    paraName: p.name,
    startDate: '',
    endDate: '',
    daysTaken: '',
    examDate: '',
    examinerName: '',
    shortReport: '',
    isPriorMadrasa: false
  }));
};

/**
 * Generates initial 6 review slots array.
 */
export const createInitialReviewsArray = () => {
  return FIVE_PARA_REVIEW_SLOTS.map(r => ({
    slot: r.slot,
    title: r.title,
    parasRange: r.parasRange,
    reviewDate: '',
    examinerName: '',
    detailedNotes: ''
  }));
};
