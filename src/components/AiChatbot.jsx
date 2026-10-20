import React, { useState, useEffect, useRef } from 'react';
import './AiChatbot.css';

// Preset suggested questions for quick access
const SUGGESTED_PROMPTS = [
  { id: 'adm', text: 'نئے طالب علم کا نیا داخلہ کیسے کریں؟' },
  { id: 'entry', text: 'روزانہ کا سبق، سبقی اور منزل کیسے درج کریں؟' },
  { id: 'fee', text: 'طالب علم کی ماہانہ فیس کا ریکارڈ کیسے اپڈیٹ کریں؟' },
  { id: 'staff', text: 'کلاس یا مدرسے کے استاد کا نیا اکاؤنٹ کیسے بنائیں؟' },
  { id: 'att', text: 'روزانہ کی حاضری کا طریقہ کار کیا ہے؟' },
];

// Urdu Text Normalizer for Intent and Keyword Extraction
export function normalizeUrduText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[؟?!\.,،:؛\-_()[\]{}"'`~\\/]/g, ' ')
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ةۃۀ]/g, 'ہ')
    .replace(/[ؤ]/g, 'و')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/\s+/g, ' ')
    .trim();
}

// Structured Software Knowledge Base Engine (30+ Domain Workflows)
export const KNOWLEDGE_BASE = [
  {
    id: 'admissions',
    topic: 'داخلہ جات (Admissions)',
    primaryKeywords: ['داخلہ', 'نیا داخلہ', 'داخلہ جات', 'داخلہ فارم', 'داخلہ نمبر', 'نیا طالب علم', 'رجسٹریشن', 'داخل کرنا', 'admit', 'admission', 'register'],
    primaryPhrases: ['نئے طالب علم کا نیا داخلہ کیسے کریں', 'نئے طالب علم کا داخلہ', 'داخلہ کیسے کریں', 'نیا داخلہ فارم'],
    negativeKeywords: ['خارج', 'اخراج', 'منسوخ', 'منسوخی', 'کینسل', 'نکالنا', 'ٹرانسفر', 'منتقلی', 'تبدیل', 'شناختی کارڈ', 'فیس', 'حاضری', 'رزلٹ', 'کارڈ پرنٹ'],
    secondaryKeywords: ['رول نمبر', 'کلاس انتخاب', 'سرپرست', 'مقیم'],
    priority: 5,
    response: `**نئے طالب علم کے داخلہ کا طریقہ کار:**
1. مینو بار سے **'داخلہ جات'** (Admissions) ٹیب منتخب کریں۔
2. **'نیا داخلہ'** فارم میں طالب علم کا پورا نام، والد کا نام، اور فون نمبر درج کریں۔
3. رول نمبر، داخلہ نمبر اور متعلقہ کلاس منتخب کریں۔
4. رہائشی صورتحال (مقیم / غیر مقیم) منتخب کریں۔
5. **'داخلہ محفوظ کریں'** کا بٹن دبائیں۔ طالب علم کا ریکارڈ فوری شامل ہو جائے گا۔`
  },
  {
    id: 'student_withdrawal',
    topic: 'طالب علم کا اخراج و منسوخی داخلہ (Student Withdrawal)',
    primaryKeywords: ['اخراج', 'خارج', 'خارج کرنا', 'منسوخ', 'منسوخی', 'داخلہ منسوخ', 'داخلہ کینسل', 'طالب علم نکالنا', 'نام خارج', 'طالب علم خارج', 'طالب علم ڈیلیٹ', 'فارغ', 'فراغت', 'withdraw', 'cancellation'],
    primaryPhrases: ['طالب علم کا اخراج', 'داخلہ خارج کیسے کریں', 'طالب علم کو خارج کرنا', 'داخلہ منسوخ کرنا', 'نام خارج کرنا', 'اخراج کا طریقہ'],
    secondaryKeywords: ['وجہ اخراج', 'اخراج کی تاریخ', 'غیر فعال'],
    priority: 15,
    response: `**طالب علم کے اخراج (منسوخی داخلہ) کا طریقہ کار:**
1. مینو سے **'داخلہ جات'** (Admissions) ٹیب میں جائیں۔
2. نیچے موجود **'طالب علم کا اخراج'** (Student Withdrawal) سیکشن کھولیں۔
3. طالب علم کا داخلہ نمبر (Reg No) درج کر کے کوائف لوڈ کریں۔
4. اخراج کی تاریخ، سبب (مثلاً: نقل مکانی، فراغت، عدم دلچسپی) اور ضروری ریمارکس درج کریں۔
5. **'اخراج کی توثیق کریں'** پر کلک کریں۔ طالب علم کا داخلہ منسوخ ہو کر ریکارڈ غیر فعال لسٹ میں محفوظ ہو جائے گا۔`
  },
  {
    id: 'class_transfer',
    topic: 'طلباء کی کلاس منتقلی (Class Transfer)',
    primaryKeywords: ['کلاس منتقلی', 'کلاس ٹرانسفر', 'کلاس تبدیل', 'دوسری کلاس میں بھیجنا', 'کلاس بدلنا', 'ٹرانسفر', 'شعبہ تبدیل', 'transfer class'],
    primaryPhrases: ['کلاس منتقلی کا طریقہ', 'کلاس تبدیل کیسے کریں', 'طالب علم کو دوسری کلاس میں منتقل', 'کلاس ٹرانسفر'],
    secondaryKeywords: ['نئی کلاس', 'استاد تفویض'],
    priority: 15,
    response: `**طالب علم کو دوسری کلاس میں منتقل (Transfer) کرنے کا طریقہ:**
1. **'داخلہ جات'** یا **'کلاسز لسٹ'** والے حصے میں جائیں۔
2. مطلوبہ طالب علم کے نام کے آگے موجود **'کلاس منتقلی'** (Transfer) آپشن پر کلک کریں۔
3. موجودہ کلاس کے بجائے نئی مطلوبہ کلاس اور نئے استاد کا انتخاب کریں۔
4. **'منتقلی محفوظ کریں'** پر کلک کریں۔ طالب علم تمام پچھلے تعلیمی و فیس ریکارڈ سمیت نئی کلاس میں منتقل ہو جائے گا۔`
  },
  {
    id: 'classes_management',
    topic: 'کلاسز کا انتظام اور نئی کلاس (Classes Management)',
    primaryKeywords: ['نئی کلاس', 'کلاس شامل', 'کلاس بنائیں', 'کلاس کا نام', 'کلاس ایڈٹ', 'استاد تفویض', 'کلاس ڈیلیٹ', 'شعبہ جات', 'classes'],
    primaryPhrases: ['نئی کلاس کیسے بنائیں', 'کلاس شامل کرنے کا طریقہ', 'کلاس کا نام بدلنا'],
    negativeKeywords: ['منتقلی', 'ٹرانسفر'],
    secondaryKeywords: ['درجہ', 'شعبہ', 'کلاس لسٹ'],
    priority: 10,
    response: `**نئی کلاس بنانے اور کلاسز کے انتظام کا طریقہ:**
1. سیٹنگز یا کلاسز والے سیکشن میں جا کر **'تمام کلاسز'** کا منظر دیکھیں۔
2. **'نئی کلاس شامل کریں'** پر کلک کر کے کلاس کا نام (مثلاً: شعبہ حفظ اول، تجوید کلاس) درج کریں۔
3. متعلقہ نگران استاد کا انتخاب کریں تاکہ وہ اس کلاس کے نگران بن سکیں۔
4. **'کلاس محفوظ کریں'** کا بٹن دبائیں۔ آپ کسی بھی وقت کلاس کا نام اور استاد ایڈٹ کر سکتے ہیں۔`
  },
  {
    id: 'fees',
    topic: 'فیس ریکارڈ (Fees Management)',
    primaryKeywords: ['فیس', 'ماہانہ فیس', 'فیس ریکارڈ', 'فیس جمع', 'فیس وصولی', 'فیس ادائیگی', 'فیس اپڈیٹ', 'مالیات', 'fee', 'fees', 'payment'],
    primaryPhrases: ['طالب علم کی ماہانہ فیس کا ریکارڈ کیسے اپڈیٹ کریں', 'فیس کا ریکارڈ', 'فیس اپڈیٹ', 'ماہانہ فیس', 'فیس جمع کیسے کریں', 'فیس کیسے جمع کریں'],
    negativeKeywords: ['نادہندہ', 'نادہندگان', 'بقایا', 'بقایا جات', 'فیس رسید', 'رسید پرنٹ', 'a5 رسید', 'چالان پرنٹ'],
    secondaryKeywords: ['نقد', 'بینک', 'آن لائن'],
    priority: 5,
    response: `**فیس کا ریکارڈ اور رسید جاری کرنے کا طریقہ:**
1. مینو میں **'فیس ریکارڈ'** (Fees) ٹیب کھولیں۔
2. طالب علم کا نام یا رول نمبر تلاش کریں۔
3. وصول شدہ فیس کی رقم، متعلقہ مہینہ اور ادائیگی کی تاریخ درج کریں۔
4. ادائیگی کا طریقہ (نقد / بینک / آن لائن) منتخب کریں۔
5. **'فیس جمع کریں'** پر کلک کریں اور ضرورت پڑنے پر پرنٹ رسید پر کلک کر کے رسید ڈاؤن لوڈ کریں۔`
  },
  {
    id: 'fee_defaulters',
    topic: 'فیس نادہندگان اور بقایا جات (Fee Defaulters & Arrears)',
    primaryKeywords: ['نادہندہ', 'نادہندگان', 'بقایا جات', 'بقایا فیس', 'فیس نہیں دی', 'غیر ادا شدہ', 'کتنی فیس باقی ہے', 'فیس رپورٹ', 'unpaid', 'defaulters', 'arrears'],
    primaryPhrases: ['فیس نادہندگان کی رپورٹ', 'بقایا فیس کیسے دیکھیں', 'نادہندہ طلباء', 'فیس بقایا جات'],
    secondaryKeywords: ['لسٹ', 'رپورٹ'],
    priority: 15,
    response: `**فیس نادہندگان اور بقایا جات دیکھنے کا طریقہ:**
1. **'فیس ریکارڈ'** (Fees) ٹیب پر جائیں۔
2. اوپر دیے گئے بٹنز میں سے **'نادہندہ رپورٹ'** (Unpaid Report) منتخب کریں۔
3. متعلقہ مہینہ اور سال منتخب کریں۔
4. سسٹم ان تمام طلباء کی مکمل فہرست بقایا جات سمیت سامنے لے آئے گا جنہوں نے فیس جمع نہیں کروائی۔
5. آپ اس فہرست کو پرنٹ کر کے نوٹس بورڈ یا والدین کو یاد دہانی کے لیے استعمال کر سکتے ہیں۔`
  },
  {
    id: 'fee_receipt',
    topic: 'فیس رسید پرنٹنگ (Fee Receipt Printing)',
    primaryKeywords: ['فیس رسید', 'رسید پرنٹ', 'رسید دوبارہ', 'چالان پرنٹ', 'a5 رسید', 'رسید پرنٹنگ', 'receipt print', 'voucher'],
    primaryPhrases: ['فیس رسید پرنٹ کرنے کا طریقہ', 'رسید کیسے نکالیں', 'دوبارہ رسید پرنٹ', 'رسید پرنٹ'],
    secondaryKeywords: ['انوائس', 'پرنٹ واؤچر'],
    priority: 15,
    response: `**فیس رسید پرنٹ کرنے کا طریقہ:**
1. **'فیس ریکارڈ'** ٹیب میں فیس جمع ہوتے ہی پرنٹ ونڈو خودکار کھل جاتی ہے۔
2. اگر پرانی رسید دوبارہ نکالنی ہو تو **'رسید بنائیں / دوبارہ پرنٹ'** کے ٹیب پر جائیں۔
3. طالب علم کا شناختی نمبر یا انوائس نمبر درج کریں تاکہ رسید اسکرین پر آ جائے۔
4. **'پرنٹ رسید'** پر کلک کریں۔ سسٹم خودکار طور پر A5 لینڈ سکیپ فارمیٹ میں معیاری دو کالم رسید پیش کر دے گا۔`
  },
  {
    id: 'entry',
    topic: 'جائزہ جات (Daily Hifz Entry)',
    primaryKeywords: ['سبق', 'سبقی', 'منزل', 'جائزہ', 'جائزہ جات', 'تلاوت', 'پارہ', 'سطور', 'حفظ', 'sabaq', 'sabqi', 'manzil', 'entry'],
    primaryPhrases: ['روزانہ کا سبق، سبقی اور منزل کیسے درج کریں', 'سبق، سبقی اور منزل', 'سبق درج', 'روزانہ کا سبق'],
    negativeKeywords: ['ششماہی', 'ماہانہ جائزہ', 'پارہ تکمیل'],
    secondaryKeywords: ['دور', 'تجوید'],
    priority: 5,
    response: `**روزانہ کا سبق، سبقی اور منزل درج کرنے کا طریقہ:**
1. نیویگیشن بار سے **'جائزہ جات'** (Entry) ٹیب پر کلک کریں۔
2. مطلوبہ کلاس اور طالب علم کا نام منتخب کریں۔
3. **سبق (Sabaq):** موجودہ پڑھا گیا پارہ اور سطور درج کریں۔
4. **سبقی (Sabqi):** پچھلے یاد شدہ پارے کا نمبر درج کریں۔
5. **منزل (Manzil):** دور یا پچھلی منزل کا جائزہ منتخب کریں۔
6. **'ریکارڈ محفوظ کریں'** کا بٹن دبا کر اینٹری مکمل کریں۔`
  },
  {
    id: 'half_yearly_hifz',
    topic: 'ششماہی اور ماہانہ جائزہ ریکارڈ (Half-Yearly Hifz)',
    primaryKeywords: ['ششماہی', 'ماہانہ جائزہ', 'ششماہی ریکارڈ', 'کلاس رپورٹ جائزہ', 'پارہ مکمل', 'حفظ جائزہ'],
    primaryPhrases: ['ششماہی ریکارڈ کیسے درج کریں', 'ماہانہ جائزہ کا طریقہ', 'ششماہی جائزہ'],
    secondaryKeywords: ['سالانہ ریکارڈ', 'حفظ رپورٹ'],
    priority: 15,
    response: `**ششماہی اور ماہانہ تعلیمی جائزے کا طریقہ:**
1. مینو سے **'جائزہ جات'** (Entry) ٹیب کھولیں۔
2. اوپر موجود ٹیبز میں سے **'ششماہی ریکارڈ'** یا **'ماہانہ جائزہ'** منتخب کریں۔
3. کلاس، تعلیمی سال اور متعلقہ ششماہی کا انتخاب کریں۔
4. ہر طالب علم کے یاد کردہ پارے، صفحات کی تعداد اور استاد کے ریمارکس درج کریں۔
5. **'کلاس جائزہ رپورٹ'** پر کلک کر کے پوری کلاس کی ششماہی کارکردگی رپورٹ پرنٹ کریں۔`
  },
  {
    id: 'attendance',
    topic: 'حاضری ریکارڈ (Attendance System)',
    primaryKeywords: ['حاضری', 'حاضر', 'غیر حاضر', 'رخصت', 'حاضری ریکارڈ', 'حاضری شیٹ', 'حاضری مارک', 'attendance', 'present', 'absent', 'leave'],
    primaryPhrases: ['روزانہ کی حاضری کا طریقہ کار کیا ہے', 'روزانہ کی حاضری', 'حاضری کا طریقہ', 'حاضری کیسے لگائیں'],
    negativeKeywords: ['اسٹاف حاضری', 'استاد کی حاضری', 'اساتذہ حاضری', 'چیک ان', 'چیک آؤٹ', 'حاضری رپورٹ', 'حاضری خلاصہ'],
    secondaryKeywords: ['تاریخ', 'طالب علم حاضری'],
    priority: 5,
    response: `**روزانہ کی حاضری مارک کرنے کا طریقہ:**
1. مینو سے **'حاضری'** (Attendance) ٹیب پر جائیں۔
2. متعلقہ تاریخ اور کلاس منتخب کریں۔
3. تمام طلباء کے نام کے سامنے **حاضر (Present)**، **غیر حاضر (Absent)**، یا **رخصت (Leave)** پر نشان لگائیں۔
4. اساتذہ اور عملے کی حاضری کے لیے اوپر دیے گئے 'اسٹاف حاضری' سوئچ کا استعمال کریں۔
5. **'حاضری محفوظ کریں'** کا بٹن دبائیں۔`
  },
  {
    id: 'staff_attendance',
    topic: 'اساتذہ و عملے کی حاضری اور ٹائمنگ (Staff Attendance)',
    primaryKeywords: ['اسٹاف حاضری', 'استاد کی حاضری', 'اساتذہ حاضری', 'چیک ان', 'چیک آؤٹ', 'عملہ حاضری', 'استاد لیٹ', 'حاضری اسٹاف', 'staff attendance', 'check in', 'check out'],
    primaryPhrases: ['اسٹاف کی حاضری کا طریقہ', 'اساتذہ کی حاضری کیسے لگائیں', 'چیک ان چیک آؤٹ'],
    secondaryKeywords: ['شفٹ', 'ٹائمنگ', 'لیٹ'],
    priority: 15,
    response: `**اساتذہ اور اسٹاف کی حاضری لگانے کا طریقہ:**
1. **'حاضری'** (Attendance) ٹیب کھولیں اور اوپر **'اسٹاف حاضری'** کا بٹن دبائیں۔
2. تاریخ اور شفٹ (صبح / شام) منتخب کریں۔
3. ہر استاد کی حاضری کی صورتحال (حاضر / رخصت / غیر حاضر) کے ساتھ ان کا چیک ان اور چیک آؤٹ وقت درج کریں۔
4. تاخیر کی صورت میں سسٹم خودکار لیٹ منٹس کا حساب رکھتا ہے۔
5. **'اسٹاف حاضری محفوظ کریں'** پر کلک کریں۔`
  },
  {
    id: 'attendance_summary',
    topic: 'ماہانہ حاضری خلاصہ و رجسٹر (Attendance Summary & Reports)',
    primaryKeywords: ['حاضری خلاصہ', 'حاضری رپورٹ', 'ماہانہ حاضری', 'حاضری شیٹ', 'حاضری رجسٹر', 'حاضری پرنٹ'],
    primaryPhrases: ['حاضری کا خلاصہ کیسے دیکھیں', 'ماہانہ حاضری رپورٹ', 'حاضری رجسٹر پرنٹ'],
    secondaryKeywords: ['کل حاضری', 'فیصد'],
    priority: 15,
    response: `**ماہانہ حاضری رپورٹ اور خلاصہ دیکھنے کا طریقہ:**
1. **'حاضری'** (Attendance) ٹیب کھولیں۔
2. اوپر موجود **'خلاصہ رپورٹ'** (Summary) یا **'کلاس رپورٹ'** پر جائیں۔
3. کلاس اور مطلوبہ مہینہ منتخب کریں۔
4. کلاس کے تمام طلباء کی کل حاضریوں، غیر حاضریوں اور رخصتوں کا تفصیلی چارٹ ظاہر ہو جائے گا۔
5. **'پرنٹ رپورٹ'** کے ذریعے ماہانہ حاضری رجسٹر پرنٹ کریں۔`
  },
  {
    id: 'staff',
    topic: 'اسٹاف و اساتذہ (Staff Management)',
    primaryKeywords: ['استاد', 'اساتذہ', 'ٹیچر', 'اسٹاف', 'عملہ', 'استاد اکاؤنٹ', 'عہدہ', 'ناظم', 'قاری', 'staff', 'teacher', 'employee'],
    primaryPhrases: ['کلاس یا مدرسے کے استاد کا نیا اکاؤنٹ کیسے بنائیں', 'استاد کا نیا اکاؤنٹ', 'نیا استاد', 'نیا استاد شامل کریں'],
    negativeKeywords: ['اسٹاف حاضری', 'استاد کی حاضری', 'چیک ان', 'تنخواہ'],
    secondaryKeywords: ['موبائل نمبر', 'کلاس تفویض', 'شفٹ'],
    priority: 5,
    response: `**نئے استاد یا اسٹاف رکن کا اکاؤنٹ بنانے کا طریقہ:**
1. مینو میں **'اسٹاف'** (Staff) ٹیب پر جائیں۔
2. **'نیا استاد شامل کریں'** والے فارم میں استاد کا پورا نام، موبائل نمبر اور عہدہ (مثلاً: مدرسِ حفظ، ناظم، قاری) درج کریں۔
3. استاد کے سپرد کی جانے والی کلاس منتخب کریں۔
4. **'استاد کا ریکارڈ محفوظ کریں'** پر کلک کریں۔`
  },
  {
    id: 'exams',
    topic: 'امتحانات اور نتائج (Exams & Results)',
    primaryKeywords: ['امتحان', 'امتحانات', 'رزلٹ', 'نمبر', 'نتائج', 'گریڈ', 'امتحانی', 'امتحان نمبر', 'exam', 'exams', 'result', 'marks', 'test'],
    primaryPhrases: ['امتحانات اور نتائج کے اندراج کا طریقہ', 'امتحان کا طریقہ', 'امتحان کے نمبر درج'],
    negativeKeywords: ['رزلٹ کارڈ', 'نتیجہ پرنٹ', 'گزٹ پرنٹ', 'کارڈ پرنٹ'],
    secondaryKeywords: ['ششماہی', 'سالانہ', 'ماہانہ ٹیسٹ'],
    priority: 5,
    response: `**امتحانات اور نتائج کے اندراج کا طریقہ:**
1. مینو سے **'امتحانات'** (Exams) ٹیب کھولیں۔
2. امتحان کی قسم (مثلاً: ماہانہ ٹیسٹ، ششماہی، یا سالانہ امتحان) منتخب کریں۔
3. طالب علم کے حفظ، تجوید اور رفتار کے حاصل کردہ نمبرز داخل کریں۔
4. سسٹم ازخود فیصدی اور گریڈ کی حساب کتاب کرے گا جس کے بعد رزلٹ کارڈ پرنٹ کیا جا سکتا ہے۔`
  },
  {
    id: 'exam_result_print',
    topic: 'امتحانی رزلٹ کارڈ و گزٹ پرنٹنگ (Result Cards Printing)',
    primaryKeywords: ['رزلٹ کارڈ', 'نتیجہ پرنٹ', 'گزٹ', 'امتحان پرنٹ', 'کشف الدرجات', 'نتیجہ شیٹ', 'result card', 'gazette'],
    primaryPhrases: ['رزلٹ کارڈ کیسے پرنٹ کریں', 'امتحان کا نتیجہ پرنٹ کرنا', 'کلاس رزلٹ گزٹ', 'رزلٹ کارڈ پرنٹ'],
    negativeKeywords: ['شناختی کارڈ', 'فیس رسید'],
    secondaryKeywords: ['مارکس شیٹ', 'پوزیشن'],
    priority: 15,
    response: `**امتحانی رزلٹ کارڈ اور گزٹ پرنٹ کرنے کا طریقہ:**
1. مینو سے **'امتحانات'** (Exams) ٹیب کھولیں۔
2. انفرادی رزلٹ کارڈ کے لیے: رول نمبر یا طالب علم منتخب کر کے **'رزلٹ کارڈ پرنٹ کریں'** کا بٹن دبائیں۔
3. پوری کلاس کے لیے: امتحان اور کلاس منتخب کر کے **'کلاس گزٹ پرنٹ کریں'** پر کلک کریں۔
4. باضابطہ مہر، استاد کے دستخط اور پوزیشن کے ساتھ رزلٹ کارڈ پرنٹ کے لیے تیار ہو جائے گا۔`
  },
  {
    id: 'records_id_card',
    topic: 'طالب علم کا شناختی کارڈ (Student ID Card)',
    primaryKeywords: ['شناختی کارڈ', 'اسٹوڈنٹ کارڈ', 'آئی ڈی کارڈ', 'id card', 'طالب علم کارڈ', 'بچے کا کارڈ', 'کارڈ پرنٹ'],
    primaryPhrases: ['طالب علم شناختی کارڈ', 'طالب علم کا شناختی کارڈ کیسے پرنٹ کریں', 'اسٹوڈنٹ کارڈ بنانے کا طریقہ', 'طالب علم شناختی کارڈ پرنٹ'],
    negativeKeywords: ['رزلٹ کارڈ', 'امتحان رزلٹ'],
    secondaryKeywords: ['بلڈ گروپ', 'تصویر'],
    priority: 15,
    response: `**طالب علم کا شناختی کارڈ (Student ID Card) بنانے اور پرنٹ کرنے کا طریقہ:**
1. مینو سے **'تعلیمی ریکارڈز'** (Records) ٹیب پر جائیں۔
2. طالب علم کا نام یا داخلہ نمبر تلاش کریں۔
3. طالب علم کی پروفائل کے ساتھ موجود **'طالب علم شناختی کارڈ'** بٹن پر کلک کریں۔
4. شناختی کارڈ خودکار طور پر طالب علم کے نام، تصویر، کلاس، بلڈ گروپ اور ایمرجنسی رابطے کے ساتھ تیار ہو جائے گا۔
5. 'پرنٹ' پر کلک کر کے کارڈ کا پرنٹ لے لیں۔`
  },
  {
    id: 'records_certificate',
    topic: 'تعلیمی سند اور سرٹیفکیٹ (Certificate of Hifz)',
    primaryKeywords: ['سند', 'سرٹیفکیٹ', 'تعلیمی سند', 'فراغت کی سند', 'حفظ کی سند', 'certificate', 'degree'],
    primaryPhrases: ['تعلیمی سند کیسے نکالیں', 'حفظ کی سند پرنٹ کرنا', 'سرٹیفکیٹ جاری کرنا', 'حفظ کی سند'],
    secondaryKeywords: ['اعزازی گریڈ', 'تکمیل'],
    priority: 15,
    response: `**حفظ کی تعلیمی سند اور سرٹیفکیٹ حاصل کرنے کا طریقہ:**
1. مینو سے **'تعلیمی ریکارڈز'** (Records) ٹیب پر جائیں۔
2. متعلقہ طالب علم کی مکمل تعلیمی پروفائل کھولیں۔
3. **'تعلیمی سند'** یا **'سرٹیفکیٹ'** کے بٹن پر کلک کریں۔
4. سند میں طالب علم کا نام، والد کا نام، حفظ مکمل کرنے کا دورانیہ اور خصوصی تعریفی کلمات خودکار درج ہو جائیں گے۔
5. اسے پرنٹ کر کے ادارے کی مہر اور دستخط کے ساتھ جاری کریں۔`
  },
  {
    id: 'records',
    topic: 'تعلیمی ریکارڈز (Records & Credentials)',
    primaryKeywords: ['تعلیمی ریکارڈ', 'تعلیمی ریکارڈز', 'گراف', 'ہسٹری', 'کارکردگی', 'records', 'student history'],
    primaryPhrases: ['تعلیمی ریکارڈز', 'طالب علم شناختی کارڈ', 'طالب علم تعلیمی ریکارڈ'],
    negativeKeywords: ['شناختی کارڈ', 'سند', 'سرٹیفکیٹ'],
    secondaryKeywords: ['سالانہ حاضری', 'کارکردگی'],
    priority: 5,
    response: `**تعلیمی ریکارڈز اور کارڈز حاصل کرنے کا طریقہ:**
1. **'تعلیمی ریکارڈز'** (Records) ٹیب کھولیں۔
2. طالب علم کا مکمل سبق ہسٹری، سالانہ حاضری فیصد، اور تعلیمی ترقی کا گراف دیکھیں۔
3. **'طالب علم شناختی کارڈ'** یا **'تعلیمی سند'** بٹن پر کلک کر کے پرنٹ ایبل کارڈ حاصل کریں۔`
  },
  {
    id: 'ai-listen',
    topic: 'اے آئی استاد (AI Quran Listener)',
    primaryKeywords: ['صوتی', 'مائیکروفون', 'تجوید', 'مخارج', 'اے آئی استاد', 'تلاوت سننا', 'ai-listen', 'listen', 'recitation'],
    primaryPhrases: ['اے آئی استاد', 'تلاوت صوتی', 'اے آئی استاد کا طریقہ'],
    secondaryKeywords: ['اصلاح', 'تلاوت'],
    priority: 10,
    response: `**اے آئی استاد کے استعمال کا طریقہ:**
1. **'اے آئی استاد'** (AI Listen) ٹیب پر جائیں۔
2. مائیکروفون کی اجازت دیں اور طالب علم کو تلاوت کا حکم دیں۔
3. AI سسٹم تلاوت کو سنے گا اور تجوید و مخارج سے متعلق رہنمائی فراہم کرے گا۔`
  },
  {
    id: 'dashboard',
    topic: 'ڈیش بورڈ اور تنظیم (Dashboard & Overview)',
    primaryKeywords: ['ڈیش بورڈ', 'شاخ', 'لوگو', 'کیمپس', 'مجموعی', 'کل طلباء', 'لوگو اپلوڈ', 'شاخ کا نام', 'dashboard', 'home', 'overview', 'branch', 'logo'],
    primaryPhrases: ['ڈیش بورڈ کا جائزہ', 'شاخ کی تبدیلی', 'لوگو تبدیل'],
    secondaryKeywords: ['فعال کلاسز', 'احصائیات'],
    priority: 5,
    response: `**ڈیش بورڈ کا جائزہ:**
1. **'ڈیش بورڈ'** (Dashboard) پر مدرسے کے کل طلباء، فعال کلاسز، اور حاضری کی شرح کے احصائیات ظاہر ہوتے ہیں۔
2. ہیڈر کنٹرولز سے آپ مدرسے کا لوگو اپ لوڈ یا شاخ (Branch) کو تبدیل اور رینیم کر سکتے ہیں۔`
  },
  {
    id: 'change_password',
    topic: 'پاسورڈ تبدیل کرنا (Change Password)',
    primaryKeywords: ['پاسورڈ تبدیل', 'پاسورڈ بدلنا', 'نیا پاسورڈ', 'پاسورڈ کیسے بدلیں', 'change password'],
    primaryPhrases: ['پاسورڈ کیسے تبدیل کریں', 'پاسورڈ بدلنے کا طریقہ', 'پاسورڈ تبدیل'],
    negativeKeywords: ['بھول گیا', 'ری سیٹ', 'forgot'],
    secondaryKeywords: ['پرانا پاسورڈ', 'سیکیورٹی'],
    priority: 15,
    response: `**اپنا پاسورڈ تبدیل کرنے کا طریقہ:**
1. اسکرین پر اوپر موجود پروفائل آئیکن (صارف کے نام) پر کلک کریں۔
2. پاپ اپ ونڈو میں **'پاسورڈ تبدیل کریں'** والے حصے پر جائیں۔
3. سیکیورٹی کے لیے اپنا پرانا (موجودہ) پاسورڈ درج کریں۔
4. نیا پاسورڈ درج کریں (کم از کم 6 حروف) اور تصدیق کریں۔
5. **'پاسورڈ محفوظ کریں'** پر کلک کریں۔`
  },
  {
    id: 'forgot_password',
    topic: 'پاسورڈ بھول جانا اور ری سیٹ (Forgot Password)',
    primaryKeywords: ['پاسورڈ بھول', 'پاسورڈ یاد نہیں', 'پاسورڈ ری سیٹ', 'لاگ ان نہیں ہو رہا', 'forgot password', 'reset password'],
    primaryPhrases: ['پاسورڈ بھول گیا ہوں', 'پاسورڈ کیسے ری سیٹ کریں', 'لاگ ان پاسورڈ بحال'],
    secondaryKeywords: ['ای میل لنک', 'ریکوری'],
    priority: 15,
    response: `**بھولا ہوا پاسورڈ بحال (Reset) کرنے کا طریقہ:**
1. لاگ ان پیج پر **'پاسورڈ بھول گئے؟'** کے لنک پر کلک کریں۔
2. اپنا رجسٹرڈ ای میل ایڈریس درج کریں۔
3. **'ری سیٹ لنک بھیجیں'** کا بٹن دبائیں۔
4. آپ کے ای میل پر پاسورڈ ری سیٹ کرنے کا محفوظ لنک موصول ہو جائے گا جہاں سے آپ نیا پاسورڈ مقرر کر سکتے ہیں۔`
  },
  {
    id: 'offline_sync',
    topic: 'آف لائن موڈ اور انٹرنیٹ بحالی (Offline Sync)',
    primaryKeywords: ['آف لائن', 'انٹرنیٹ نہیں', 'نیٹ بند', 'ڈیٹا ضائع', 'سنک', 'offline', 'sync', 'بغیر انٹرنیٹ'],
    primaryPhrases: ['کیا بغیر انٹرنیٹ کے کام کر سکتے ہیں', 'آف لائن ڈیٹا کیسے محفوظ ہوتا ہے', 'نیٹ نہ ہو تو'],
    secondaryKeywords: ['خودکار محفوظ', 'کلاؤڈ'],
    priority: 15,
    response: `**آف لائن موڈ اور خودکار سنک (Auto-Sync) کی معلومات:**
1. یہ سوفٹ ویئر انٹرنیٹ نہ ہونے کی صورت میں بھی فیس اور ڈیٹا محفوظ کرنے کی سہولت رکھتا ہے۔
2. جب انٹرنیٹ بند ہوتا ہے تو سسٹم تمام اندراج کو مقامی طور پر محفوظ کر کے اسکرین پر نوٹس دکھاتا ہے۔
3. جیسے ہی انٹرنیٹ دوبارہ چالو ہوتا ہے، سسٹم ازخود سارا ڈیٹا کلاؤڈ پر ہم وقت ساز (Sync) کر دیتا ہے اور کوئی اندراج ضائع نہیں ہوتا۔`
  },
  {
    id: 'theme_toggle',
    topic: 'ڈارک اور لائٹ موڈ (Dark & Light Mode)',
    primaryKeywords: ['ڈارک موڈ', 'لائٹ موڈ', 'تھیم', 'سیاہ موڈ', 'theme', 'dark mode', 'light mode'],
    primaryPhrases: ['ڈارک موڈ کیسے کریں', 'تھیم کیسے تبدیل کریں', 'نائٹ موڈ'],
    secondaryKeywords: ['روشن', 'سیاہ تھیم'],
    priority: 15,
    response: `**ڈارک اور لائٹ موڈ تبدیل کرنے کا طریقہ:**
1. اسکرین کے اوپری ہیڈر بار میں دائیں جانب موجود تھیم آئیکن پر کلک کریں۔
2. پورا سسٹم فوری طور پر ڈارک (سیاہ) یا لائٹ (روشن) موڈ میں منتقل ہو جائے گا۔
3. دونوں موڈز میں تحریر اور تمام فارمز کی پڑھنے کی صلاحیت کو اعلی معیار پر رکھا گیا ہے۔`
  },
  {
    id: 'super_admin',
    topic: 'سپر ایڈمن پینل (Super Admin Panel)',
    primaryKeywords: ['سپر ایڈمن', 'نیا مدرسہ', 'نیا ادارہ', 'مہتمم اکاؤنٹ', 'مدرسہ ڈیلیٹ', 'مدرسہ معطل', 'super admin'],
    primaryPhrases: ['نیا ادارہ کیسے بنائیں', 'سپر ایڈمن پینل کا استعمال'],
    secondaryKeywords: ['اداروں کی فہرست', 'ادارہ ڈیلیٹ'],
    priority: 15,
    response: `**سپر ایڈمن پینل کے استعمال کا طریقہ:**
1. سپر ایڈمن اکاؤنٹ سے لاگ ان کرنے کے بعد مینو میں **'سپر ایڈمن'** کا خصوصی ٹیب ظاہر ہوتا ہے۔
2. وہاں سے آپ **'نیا ادارہ شامل کریں'** پر کلک کر کے نئے مدرسے اور مہتمم کا اکاؤنٹ بنا سکتے ہیں۔
3. اداروں کی لسٹ سے کسی بھی مدرسے کو عارضی معطل یا مستقل طور پر حذف کرنے کا مکمل اختیار موجود ہے۔`
  },
  {
    id: 'search_student',
    topic: 'طالب علم کو تلاش کرنا (Search Student)',
    primaryKeywords: ['تلاش', 'سرچ', 'ڈھونڈنا', 'تلاش کریں', 'طالب علم تلاش', 'search student'],
    primaryPhrases: ['طالب علم کیسے تلاش کریں', 'طالب علم ڈھونڈنے کا طریقہ'],
    secondaryKeywords: ['رول نمبر تلاش', 'نام سے تلاش'],
    priority: 15,
    response: `**طالب علم کو تلاش (Search) کرنے کا طریقہ:**
1. داخلہ جات، فیس، حاضری اور جائزہ جات کے ہر صفحے پر تلاش کا خانہ دیا گیا ہے۔
2. آپ طالب علم کے **نام**، **والد کے نام**، **داخلہ نمبر** یا **رول نمبر** میں سے کوئی بھی ایک چیز لکھ کر فوراً مطلوبہ طالب علم کا ریکارڈ نکال سکتے ہیں۔`
  },
  {
    id: 'greeting',
    topic: 'خوش آمدید',
    primaryKeywords: ['سلام', 'السلام', 'ہیلو', 'hello', 'hi', 'assalam', 'aoa', 'کون', 'رہنما'],
    primaryPhrases: ['السلام علیکم', 'ہیلو', 'سلام'],
    secondaryKeywords: ['تعارف', 'مدد'],
    priority: 5,
    response: `وعلیکم السلام ورحمۃ اللہ وبرکاتہ!
میں مدرسہ منیجر کا **اے آئی رہنما** ہوں۔ میں آپ کو اس سافٹ ویئر کے تمام فیچرز (داخلہ جات، سبق جائزہ جات، فیس، حاضری، امتحانات، تعلیمی ریکارڈز، اور اسٹاف) استعمال کرنے میں رہنمائی فراہم کر سکتا ہوں۔`
  },
  {
    id: 'help',
    topic: 'عمومی مدد اور رہنمائی (Help & Overview)',
    primaryKeywords: ['مدد', 'رہنمائی', 'سپورٹ', 'help', 'support', 'فیچرز'],
    primaryPhrases: ['مدد چاہیے', 'سافٹ ویئر کے فیچرز کیا ہیں'],
    secondaryKeywords: ['معلومات'],
    priority: 5,
    response: `**مدرسہ منیجر اے آئی رہنما - مکمل رہنمائی:**
آپ اس سافٹ ویئر کے کسی بھی شعبے کے بارے میں براہ راست سوال پوچھ سکتے ہیں:
1. **داخلہ جات:** نیا داخلہ، اخراج، کلاس منتقلی۔
2. **فیس:** فیس وصولی، رسید پرنٹنگ، نادہندگان لسٹ۔
3. **جائزہ جات:** روزانہ سبق، سبقی، منزل اور ششماہی جائزہ۔
4. **حاضری:** طلباء و اساتذہ کی حاضری اور ماہانہ خلاصہ۔
5. **امتحانات:** نمبرات، پوزیشن اور رزلٹ کارڈز۔
6. **اسٹاف:** اساتذہ کے پروفائلز اور لاگ ان اکاؤنٹس۔
7. **ریکارڈز:** شناختی کارڈ، اسناد اور تعلیمی تاریخ۔`
  }
];

// Advanced Intent-Aware Domain Knowledge Matcher Function
export function findBestKnowledgeMatch(queryText) {
  if (!queryText || !queryText.trim()) return null;
  const rawLower = queryText.toLowerCase().trim();
  const normText = normalizeUrduText(queryText);

  let bestMatch = null;
  let maxScore = 0;

  KNOWLEDGE_BASE.forEach(item => {
    let score = 0;
    let exactPhraseMatched = false;

    // 1. Check exact phrase matches (Highest Weight: 60 pts)
    if (item.primaryPhrases && item.primaryPhrases.length > 0) {
      for (const phrase of item.primaryPhrases) {
        const normPhrase = normalizeUrduText(phrase);
        if (normPhrase && (normText.includes(normPhrase) || rawLower.includes(phrase.toLowerCase()))) {
          score += 60;
          exactPhraseMatched = true;
          break;
        }
      }
    }

    // 2. Check negative disqualifier keywords (Avoid misrouting like 'خارج' to 'داخلہ')
    if (item.negativeKeywords && item.negativeKeywords.length > 0) {
      let hasNegative = false;
      for (const neg of item.negativeKeywords) {
        const normNeg = normalizeUrduText(neg);
        if (normNeg && (normText.includes(normNeg) || rawLower.includes(neg.toLowerCase()))) {
          hasNegative = true;
          break;
        }
      }
      if (hasNegative) {
        if (!exactPhraseMatched) {
          score -= 200; // Heavily penalize and disqualify
        }
      }
    }

    // 3. Check primary keywords (Weight: 15 pts per match)
    if (item.primaryKeywords && item.primaryKeywords.length > 0) {
      for (const kw of item.primaryKeywords) {
        const normKw = normalizeUrduText(kw);
        if (!normKw) continue;
        if (normText.includes(normKw) || rawLower.includes(kw.toLowerCase())) {
          score += 15;
        }
      }
    }

    // 4. Check secondary keywords (Weight: 4 pts per match)
    if (item.secondaryKeywords && item.secondaryKeywords.length > 0) {
      for (const skw of item.secondaryKeywords) {
        const normSkw = normalizeUrduText(skw);
        if (!normSkw) continue;
        if (normText.includes(normSkw) || rawLower.includes(skw.toLowerCase())) {
          score += 4;
        }
      }
    }

    // 5. Apply priority weight
    if (score > 0 && item.priority) {
      score += item.priority;
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  });

  // Return match only if strict threshold met
  return maxScore >= 12 ? bestMatch : null;
}

// Helper to query Gemini/OpenAI with strict software domain prompt
async function fetchLlmResponse(query) {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const systemInstruction = `You are AI Rehnuma (اے آئی رہنما), an exclusive user-guide assistant for this Madrasa SaaS software.
Scope: Help users navigate features like Admissions, Daily Hifz Sabaq Entry, Attendance, Fee Records, Staff Management, Exams & Results, Educational Records, and AI Listener.
CRITICAL RULE: If the user asks anything outside this Madrasa management software domain (e.g. general knowledge, weather, cooking, external directions), politely decline in Urdu:
"معذرت! یہ سوال مدرسہ منیجر سافٹ ویئر کے دائرہ کار سے باہر ہے۔ میں صرف اس سافٹ ویئر کے فیچرز اور استعمال کی رہنمائی فراہم کر سکتا ہوں۔"
Do not guess or fabricate information outside the application features.`;

  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemInstruction}\nUser query: ${query}`
            }]
          }]
        })
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      console.warn('Gemini API call failed:', err);
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: query }
          ]
        })
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err) {
      console.warn('OpenAI API call failed:', err);
    }
  }

  return null;
}

// Helper for screen viewport boundary clamping
function clampPosition(x, y, elemWidth = 0, elemHeight = 0) {
  const margin = 12;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const maxX = Math.max(margin, winW - elemWidth - margin);
  const maxY = Math.max(margin, winH - elemHeight - margin);
  return {
    x: Math.round(Math.min(Math.max(margin, x), maxX)),
    y: Math.round(Math.min(Math.max(margin, y), maxY))
  };
}

function getInitialTriggerPos() {
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  try {
    const saved = localStorage.getItem('hifz_chatbot_trigger_pos') || localStorage.getItem('hifz_chatbot_pos');
    if (saved) {
      const parsed = JSON.parse(saved);
      const pos = parsed?.trigger || parsed;
      if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
        return clampPosition(pos.x, pos.y, 160, 50);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return {
    x: 24,
    y: Math.max(12, winH - 76)
  };
}

function getInitialDrawerPos() {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const drawerW = Math.min(410, winW - 24);
  const drawerH = Math.min(600, winH - 32);
  try {
    const saved = localStorage.getItem('hifz_chatbot_drawer_pos') || localStorage.getItem('hifz_chatbot_pos');
    if (saved) {
      const parsed = JSON.parse(saved);
      const pos = parsed?.drawer || parsed;
      if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
        return clampPosition(pos.x, pos.y, drawerW, drawerH);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return {
    x: 24,
    y: Math.max(12, winH - drawerH - 24)
  };
}

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: 'السلام علیکم! میں آپ کا **اے آئی رہنما** ہوں۔ سافٹ ویئر استعمال کرنے سے متعلق کوئی بھی سوال پوچھیے یا نیچے دیے گئے سوالات پر کلک کریں۔',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Draggable state
  const [triggerPos, setTriggerPos] = useState(getInitialTriggerPos);
  const [drawerPos, setDrawerPos] = useState(getInitialDrawerPos);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragTarget, setActiveDragTarget] = useState(null); // 'trigger' | 'drawer' | null

  const hasCustomDrawerPos = useRef(false);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const justDraggedRef = useRef(false);

  const dragInfoRef = useRef({
    isDown: false,
    targetType: null,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    elemWidth: 0,
    elemHeight: 0,
    hasMoved: false,
    pointerId: null,
    targetElem: null
  });

  // Track if drawer has been positioned by the user previously
  useEffect(() => {
    try {
      const savedDrawer = localStorage.getItem('hifz_chatbot_drawer_pos');
      const savedComposite = localStorage.getItem('hifz_chatbot_pos');
      if (savedDrawer) {
        hasCustomDrawerPos.current = true;
      } else if (savedComposite) {
        const parsed = JSON.parse(savedComposite);
        if (parsed?.drawer) {
          hasCustomDrawerPos.current = true;
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Re-clamp positions if window is resized or orientation changes
  useEffect(() => {
    const handleResize = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTriggerPos(prev => clampPosition(prev.x, prev.y, rect.width, rect.height));
      }
      if (drawerRef.current) {
        const rect = drawerRef.current.getBoundingClientRect();
        setDrawerPos(prev => clampPosition(prev.x, prev.y, rect.width, rect.height));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  // Unified Pointer Drag Event Handlers
  const handlePointerDown = (e, targetType) => {
    if (e.button !== 0 && e.button !== undefined) return;

    // For drawer: ignore drag if clicked inside interactive controls or messages scroll container
    if (targetType === 'drawer') {
      if (e.target.closest('button, input, textarea, .prompt-chip, a, .ai-chatbot-messages')) {
        return;
      }
    }

    const currentPos = targetType === 'trigger' ? triggerPos : drawerPos;
    const targetElem = targetType === 'trigger' ? triggerRef.current : drawerRef.current;
    const rect = targetElem?.getBoundingClientRect();
    const elemWidth = (rect?.width && rect.width > 0) ? rect.width : (targetType === 'trigger' ? 160 : 410);
    const elemHeight = (rect?.height && rect.height > 0) ? rect.height : (targetType === 'trigger' ? 50 : 600);

    dragInfoRef.current = {
      isDown: true,
      targetType,
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: currentPos.x,
      elemStartY: currentPos.y,
      elemWidth,
      elemHeight,
      hasMoved: false,
      pointerId: e.pointerId,
      targetElem
    };

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore mock/environment errors
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!dragInfoRef.current.isDown) return;

    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;

    // Movement threshold to distinguish tap/click from drag
    if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) >= 6) {
      dragInfoRef.current.hasMoved = true;
      setIsDragging(true);
      setActiveDragTarget(dragInfoRef.current.targetType);
    }

    if (dragInfoRef.current.hasMoved) {
      const nextX = dragInfoRef.current.elemStartX + dx;
      const nextY = dragInfoRef.current.elemStartY + dy;
      const clamped = clampPosition(
        nextX,
        nextY,
        dragInfoRef.current.elemWidth,
        dragInfoRef.current.elemHeight
      );

      if (dragInfoRef.current.targetType === 'trigger') {
        setTriggerPos(clamped);
      } else {
        setDrawerPos(clamped);
      }
    }
  };

  const handlePointerUp = () => {
    if (!dragInfoRef.current.isDown) return;

    const { targetType, hasMoved, pointerId, targetElem } = dragInfoRef.current;

    if (targetElem && typeof targetElem.releasePointerCapture === 'function' && pointerId !== null) {
      try {
        if (typeof targetElem.hasPointerCapture === 'function') {
          if (targetElem.hasPointerCapture(pointerId)) {
            targetElem.releasePointerCapture(pointerId);
          }
        } else {
          targetElem.releasePointerCapture(pointerId);
        }
      } catch {
        // Ignore
      }
    }

    if (hasMoved) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 120);

      try {
        if (targetType === 'trigger') {
          setTriggerPos(current => {
            localStorage.setItem('hifz_chatbot_trigger_pos', JSON.stringify(current));
            try {
              const composite = JSON.parse(localStorage.getItem('hifz_chatbot_pos') || '{}');
              composite.trigger = current;
              localStorage.setItem('hifz_chatbot_pos', JSON.stringify(composite));
            } catch {
              // Ignore
            }
            return current;
          });
        } else {
          hasCustomDrawerPos.current = true;
          setDrawerPos(current => {
            localStorage.setItem('hifz_chatbot_drawer_pos', JSON.stringify(current));
            try {
              const composite = JSON.parse(localStorage.getItem('hifz_chatbot_pos') || '{}');
              composite.drawer = current;
              localStorage.setItem('hifz_chatbot_pos', JSON.stringify(composite));
            } catch {
              // Ignore
            }
            return current;
          });
        }
      } catch {
        // Ignore
      }
    }

    dragInfoRef.current.isDown = false;
    setIsDragging(false);
    setActiveDragTarget(null);
  };

  const handleToggle = () => {
    setIsOpen(prev => {
      const nextState = !prev;
      if (nextState && !hasCustomDrawerPos.current) {
        // Intelligently place the drawer near current trigger location
        const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const drawerW = Math.min(410, winW - 24);
        const drawerH = Math.min(600, winH - 32);

        let targetY = triggerPos.y - drawerH - 12;
        if (targetY < 12) {
          targetY = Math.min(triggerPos.y + 54, winH - drawerH - 12);
        }
        let targetX = triggerPos.x;
        const clamped = clampPosition(targetX, targetY, drawerW, drawerH);
        setDrawerPos(clamped);
      }
      return nextState;
    });
  };

  const handleTriggerClick = (e) => {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleToggle();
  };

  const handleResetPosition = (e) => {
    if (e) e.stopPropagation();
    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
    const defaultTrigger = { x: 24, y: Math.max(12, winH - 76) };
    const drawerH = Math.min(600, winH - 32);
    const defaultDrawer = { x: 24, y: Math.max(12, winH - drawerH - 24) };

    setTriggerPos(defaultTrigger);
    setDrawerPos(defaultDrawer);
    hasCustomDrawerPos.current = false;
    try {
      localStorage.removeItem('hifz_chatbot_trigger_pos');
      localStorage.removeItem('hifz_chatbot_drawer_pos');
      localStorage.removeItem('hifz_chatbot_pos');
    } catch {
      // Ignore
    }
  };

  const handleSend = async (queryText) => {
    const textToSend = typeof queryText === 'string' ? queryText : inputText;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Score-based knowledge matching logic
    const matchedKnowledge = findBestKnowledgeMatch(textToSend);
    let replyText = matchedKnowledge?.response;

    // Fallback to LLM or explicit Domain Restriction message if outside scope
    if (!replyText) {
      const apiReply = await fetchLlmResponse(textToSend);
      if (apiReply) {
        replyText = apiReply;
      } else {
        replyText = `معذرت! یہ سوال مدرسہ منیجر سافٹ ویئر کے دائرہ کار سے باہر ہے۔ میں صرف اس سافٹ ویئر کے فیچرز اور استعمال سے متعلق سوالات کی رہنمائی فراہم کر سکتا ہوں۔

برائے مہربانی سافٹ ویئر کے متعلقہ ٹیبز (داخلہ جات، جائزہ جات، فیس، حاضری، امتحانات، تعلیمی ریکارڈز، یا اسٹاف) کے بارے میں سوال پوچھیے۔`;
      }
    }

    // Simulate typing delay for realistic interaction
    setTimeout(() => {
      const botMsg = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'bot',
        text: 'گفتگو کو ری سیٹ کر دیا گیا ہے۔ آپ نیا سوال پوچھ سکتے ہیں۔',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Helper function to render formatted text without raw markdown asterisks
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <React.Fragment key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
          {lineIdx !== lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="ai-chatbot-root" dir="rtl">
      {/* Floating Trigger Button (Only rendered when drawer is closed) */}
      {!isOpen && (
        <button
          ref={triggerRef}
          type="button"
          className={`ai-chatbot-trigger ${isDragging && activeDragTarget === 'trigger' ? 'is-dragging' : ''}`}
          style={{
            left: `${triggerPos.x}px`,
            top: `${triggerPos.y}px`,
            bottom: 'auto',
            right: 'auto'
          }}
          onPointerDown={(e) => handlePointerDown(e, 'trigger')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleTriggerClick}
          title="اے آئی رہنما (کھینچ کر کہیں بھی منتقل کر سکتے ہیں)"
          aria-label="Toggle AI Rehnuma Assistant"
        >
          <span className="chatbot-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.11L2 22l1.11-5.413A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z"></path>
              <circle cx="8.5" cy="11.5" r="1" fill="currentColor"></circle>
              <circle cx="12" cy="11.5" r="1" fill="currentColor"></circle>
              <circle cx="15.5" cy="11.5" r="1" fill="currentColor"></circle>
            </svg>
          </span>
          <span className="chatbot-badge">اے آئی رہنما</span>
          <span className="drag-pill-indicator" title="کھینچ کر منتقل کریں (Drag to move)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.65">
              <circle cx="9" cy="6" r="2" />
              <circle cx="15" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="18" r="2" />
              <circle cx="15" cy="18" r="2" />
            </svg>
          </span>
        </button>
      )}

      {/* Slide-out Drawer Popup Modal */}
      {isOpen && (
        <div
          ref={drawerRef}
          className={`ai-chatbot-drawer ${isDragging && activeDragTarget === 'drawer' ? 'is-dragging' : ''}`}
          style={{
            left: `${drawerPos.x}px`,
            top: `${drawerPos.y}px`,
            bottom: 'auto',
            right: 'auto'
          }}
          onPointerDown={(e) => handlePointerDown(e, 'drawer')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Header & Primary Drag Handle */}
          <div
            className="ai-chatbot-header"
            onDoubleClick={handleResetPosition}
            title="کھینچ کر کہیں بھی منتقل کریں (ڈبل کلک سے اصل جگہ ری سیٹ کریں)"
          >
            <div className="header-info">
              <div className="drag-handle-grip" aria-hidden="true" title="کھینچ کر منتقل کریں (Drag to move)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="2" />
                  <circle cx="15" cy="6" r="2" />
                  <circle cx="9" cy="12" r="2" />
                  <circle cx="15" cy="12" r="2" />
                  <circle cx="9" cy="18" r="2" />
                  <circle cx="15" cy="18" r="2" />
                </svg>
              </div>
              <div className="bot-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <div>
                <h3 className="bot-title">اے آئی رہنما</h3>
                <span className="bot-status">آن لائن | تعلیمی رہنما</span>
              </div>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="clear-chat-btn"
                onClick={handleClearChat}
                title="گفتگو صاف کریں"
                aria-label="گفتگو صاف کریں"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={handleToggle}
                title="بند کریں"
                aria-label="بند کریں"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="ai-chatbot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}
              >
                <div className="chat-bubble">
                  <div className="chat-bubble-text">
                    {renderFormattedText(msg.text)}
                  </div>
                  <span className="chat-timestamp">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="chat-bubble-wrapper bot-msg">
                <div className="chat-bubble typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preset Suggested Prompt Chips */}
          <div className="ai-chatbot-prompts">
            <div className="prompts-grid-container">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className="prompt-chip"
                  onClick={() => handleSend(prompt.text)}
                >
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <div className="ai-chatbot-footer">
            <input
              type="text"
              className="chatbot-input"
              placeholder="اپنا سوال یہاں لکھیں..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="chatbot-send-btn"
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              title="ارسال کریں"
              aria-label="ارسال کریں"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
