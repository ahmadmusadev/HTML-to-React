import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiChatbot, {
  SUGGESTED_PROMPTS,
  KNOWLEDGE_BASE,
  findBestKnowledgeMatch,
  analyzeKnowledgeQuery,
  normalizeUrduText,
} from './AiChatbot';

describe('AiChatbot Component', () => {
  it('renders floating trigger button initially', () => {
    render(<AiChatbot />);
    const button = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    expect(button).toBeInTheDocument();
    expect(button.querySelector('.chatbot-icon-wrapper svg')).toBeInTheDocument();
    expect(screen.queryByText('اے آئی رہنما')).not.toBeInTheDocument();
  });

  it('opens drawer on trigger button click and shows welcome message', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    expect(screen.getAllByText('اے آئی رہنما').length).toBeGreaterThan(0);
    expect(screen.getByText('ہمہ وقت دستیاب | نظامِ مدرسہ رہنما')).toBeInTheDocument();
  });

  it('displays 6 updated preset prompt chips in drawer', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    expect(SUGGESTED_PROMPTS).toHaveLength(6);
    for (const prompt of SUGGESTED_PROMPTS) {
      expect(screen.getByText(prompt.text)).toBeInTheDocument();
    }
  });

  it('clicks Admissions chip and displays 4-step Admissions response', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const chip = screen.getByText('نئے طالب علم کا چار مرحلوں والا داخلہ کیسے کریں؟');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText(/نئے طالب علم کے چار مرحلوں والے داخلے کا طریقہ کار/i)).toBeInTheDocument();
    });
  });

  it('clicks Payroll chip and displays Payroll response (not Fees)', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const chip = screen.getByText('اساتذہ کی ماہانہ تنخواہ اور کٹوتیوں کا حساب کیسے لگتا ہے؟');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText(/ماہانہ تنخواہ کا مسودہ، حسابی ضابطے اور حتمی منظوری کا طریقہ/i)).toBeInTheDocument();
      expect(screen.queryByText(/طالب علم کی ماہانہ فیس وصول کرنے/i)).not.toBeInTheDocument();
    });
  });

  it('shows related topic suggestion buttons for ambiguous queries and opens chosen topic on click', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.change(input, { target: { value: 'رپورٹ' } });

    const sendBtn = screen.getByTitle('ارسال کریں');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/آپ کا سوال تھوڑا عمومی یا غیر واضح ہے/i)).toBeInTheDocument();
    });

    const suggestionGroup = screen.getByRole('group', { name: 'متعلقہ قریبی موضوعات' });
    const suggestionButtons = suggestionGroup.querySelectorAll('.bot-suggestion-btn');
    expect(suggestionButtons.length).toBeGreaterThanOrEqual(2);

    const firstTopicTitle = suggestionButtons[0].textContent;
    const expectedTopic = KNOWLEDGE_BASE.find(item => item.topic === firstTopicTitle);
    expect(expectedTopic).toBeDefined();

    fireEvent.click(suggestionButtons[0]);

    await waitFor(() => {
      const headingLine = expectedTopic.response.split('\n')[0].replace(/\*\*/g, '');
      expect(screen.getByText(headingLine)).toBeInTheDocument();
    });
  });

  it('handles out-of-scope queries with pure-Urdu domain restriction message', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.change(input, { target: { value: 'موسم کا حال کیا ہے؟' } });

    const sendBtn = screen.getByTitle('ارسال کریں');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/جامعہ حفظ منیجر نظامِ مدرسہ کے دائرہ کار سے باہر ہے/i)).toBeInTheDocument();
    });
  });

  it('updates trigger position when dragged and does not open drawer on drag end', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    const initialLeft = trigger.style.left;
    const initialTop = trigger.style.top;

    fireEvent.pointerDown(trigger, { clientX: 50, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(trigger, { clientX: 120, clientY: 420, pointerId: 1 });
    fireEvent.pointerUp(trigger, { clientX: 120, clientY: 420, pointerId: 1 });

    fireEvent.click(trigger);

    expect(trigger.style.left).not.toBe(initialLeft);
    expect(trigger.style.top).not.toBe(initialTop);
    expect(screen.queryByPlaceholderText('اپنا سوال یہاں لکھیں...')).not.toBeInTheDocument();
  });

  it('updates drawer position when header is dragged', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const header = screen.getByText('ہمہ وقت دستیاب | نظامِ مدرسہ رہنما').closest('.ai-chatbot-header');
    const drawer = header.closest('.ai-chatbot-drawer');
    const initialLeft = drawer.style.left;
    const initialTop = drawer.style.top;

    fireEvent.pointerDown(drawer, { clientX: 100, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(drawer, { clientX: 180, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(drawer, { clientX: 180, clientY: 100, pointerId: 1 });

    expect(drawer.style.left).not.toBe(initialLeft);
    expect(drawer.style.top).not.toBe(initialTop);
  });

  it('differentiates small movement click (< 6px) from drag (>= 6px)', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });

    fireEvent.pointerDown(trigger, { clientX: 50, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(trigger, { clientX: 52, clientY: 501, pointerId: 1 });
    fireEvent.pointerUp(trigger, { clientX: 52, clientY: 501, pointerId: 1 });
    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...')).toBeInTheDocument();
  });

  it('ensures interactive elements inside drawer are not blocked by drag handlers', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.pointerDown(input, { clientX: 100, clientY: 100 });
    fireEvent.change(input, { target: { value: 'طالب علم فیس' } });
    expect(input.value).toBe('طالب علم فیس');

    const closeBtn = screen.getByRole('button', { name: 'بند کریں' });
    fireEvent.pointerDown(closeBtn, { clientX: 300, clientY: 50 });
    fireEvent.click(closeBtn);

    expect(screen.queryByPlaceholderText('اپنا سوال یہاں لکھیں...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i })).toBeInTheDocument();
  });

  it('accurately distinguishes withdrawal from new admission via chat input', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.change(input, { target: { value: 'طالب علم کا اخراج کیسے کریں؟' } });

    const sendBtn = screen.getByTitle('ارسال کریں');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/طالب علم کے اخراج \(روانگی\) اور خارج شدہ فہرست کا طریقہ/i)).toBeInTheDocument();
      expect(screen.queryByText(/نئے طالب علم کے چار مرحلوں والے داخلے کا طریقہ کار/i)).not.toBeInTheDocument();
    });
  });

  it('accurately answers query about all students overall list without showing dashboard response', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /اے آئی رہنما کھولیں یا بند کریں/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.change(input, { target: { value: 'تمام طلبہ کی مجموعی فہرست کہاں سے دیکھیں۔' } });

    const sendBtn = screen.getByTitle('ارسال کریں');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/تمام طلباء کی مجموعی فہرست دیکھنے اور تلاش کرنے کا طریقہ/i)).toBeInTheDocument();
      expect(screen.queryByText(/ڈیش بورڈ \(ادارہ جاتی خلاصہ\)/i)).not.toBeInTheDocument();
    });
  });

  describe('Knowledge Base Integrity & Pure Standards', () => {
    it('contains zero mentions of AI Ustad and zero emojis', () => {
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      for (const item of KNOWLEDGE_BASE) {
        const combined = `${item.id} ${item.topic} ${item.response} ${(item.primaryKeywords || []).join(' ')} ${(item.primaryPhrases || []).join(' ')}`;
        expect(combined).not.toMatch(/اے آئی استاد|ai-listen|ai ustad|ai listener/i);
        expect(emojiRegex.test(item.topic)).toBe(false);
        expect(emojiRegex.test(item.response)).toBe(false);
      }
      for (const p of SUGGESTED_PROMPTS) {
        expect(p.text).not.toMatch(/اے آئی استاد/i);
        expect(emojiRegex.test(p.text)).toBe(false);
      }
    });
  });

  describe('findBestKnowledgeMatch, analyzeKnowledgeQuery & NLP Matching Engine', () => {
    it('normalizes Urdu text stripping diacritics and unifying characters', () => {
      expect(normalizeUrduText('طَالِبُ العِلمِ؟!')).toBe('طالب العلم');
      expect(normalizeUrduText('مدرسہ كے طلباء')).toBe('مدرسہ کے طلباء');
      expect(normalizeUrduText('چھٹی/رخصت')).toBe('چھٹی رخصت');
    });

    it('matches dashboard overview and class distribution queries accurately', () => {
      const overview = findBestKnowledgeMatch('ڈیش بورڈ کے اعداد و شمار کیسے نکلتے ہیں؟');
      expect(overview?.id).toBe('dashboard_overview');

      const dist = findBestKnowledgeMatch('کلاس وار تقسیم اور حالیہ داخلے کہاں نظر آتے ہیں؟');
      expect(dist?.id).toBe('dashboard_classes_recent');
    });

    it('matches admissions, quick admission, withdrawal, transfer, printable form and bulk import/export', () => {
      expect(findBestKnowledgeMatch('طالب علم کا نام خارج کرنا ہے')?.id).toBe('student_withdrawal');
      expect(findBestKnowledgeMatch('طالب علم کو دوسری کلاس میں ٹرانسفر کیسے کریں؟')?.id).toBe('class_transfer');
      expect(findBestKnowledgeMatch('کلاس کے اندر سے تیز رفتار داخلہ کیسے کریں؟')?.id).toBe('admissions_quick');
      expect(findBestKnowledgeMatch('خالی داخلہ فارم کہاں سے پرنٹ ہوگا؟')?.id).toBe('admissions_printable_form');
      expect(findBestKnowledgeMatch('ایکسل فائل سے بلک امپورٹ اور ایکسپورٹ کیسے کریں؟')?.id).toBe('bulk_import_export');
      expect(findBestKnowledgeMatch('تمام طلبہ کی مجموعی فہرست کہاں سے دیکھیں۔')?.id).toBe('students_list');
    });

    it('matches fee collection, defaulters, receipt reprint and 5 financial reports accurately', () => {
      expect(findBestKnowledgeMatch('طالب علم کی ماہانہ فیس کیسے وصول کریں؟')?.id).toBe('fees_collect');
      expect(findBestKnowledgeMatch('فیس نادہندگان کی رپورٹ کہاں ہے جن کی فیس باقی ہے؟')?.id).toBe('fees_defaulters');
      expect(findBestKnowledgeMatch('فیس کی پرانی رسید دوبارہ کیسے پرنٹ کریں؟')?.id).toBe('fees_receipt');
      expect(findBestKnowledgeMatch('فیس کی مالیاتی رپورٹس اور ڈیلی اسٹیٹمنٹ کہاں نظر آتے ہیں؟')?.id).toBe('fees_reports');
    });

    it('matches monthly evaluations, monthly literacy, 4-year half-yearly hifz and mizan accurately', () => {
      expect(findBestKnowledgeMatch('ماہانہ جائزے میں حاضری کے 10 نمبر کیسے حساب ہوتے ہیں؟')?.id).toBe('monthly_evaluation');
      expect(findBestKnowledgeMatch('ماہانہ خواندگی کے 20 صفحات فی پارہ کیسے شمار ہوتے ہیں؟')?.id).toBe('monthly_literacy');
      expect(findBestKnowledgeMatch('چار سالہ نصاب حفظ اور متناسب ہدف کیسے نکلتا ہے؟')?.id).toBe('half_yearly_hifz');
      expect(findBestKnowledgeMatch('میزان کارکردگی اور پورے ادارے کا خلاصہ کہاں ہے؟')?.id).toBe('monthly_reports_mizan');
    });

    it('matches student attendance, staff two-step attendance and attendance reports without confusion', () => {
      expect(findBestKnowledgeMatch('طلباء کی روزانہ حاضری کیسے لگائیں؟')?.id).toBe('attendance_students');
      expect(findBestKnowledgeMatch('اساتذہ کی حاضری اور چیک ان چیک آؤٹ کیسے نوٹ کریں؟')?.id).toBe('attendance_staff');
      expect(findBestKnowledgeMatch('ماہانہ حاضری رپورٹ اور خلاصہ کیسے دیکھیں؟')?.id).toBe('attendance_reports');
    });

    it('matches exams miqdar, result entry and class/individual result cards', () => {
      expect(findBestKnowledgeMatch('امتحانی مقدار خواندگی میں کل رکوع ہدف کیسے نکلتا ہے؟')?.id).toBe('exams_miqdar');
      expect(findBestKnowledgeMatch('امتحان کے حاصل کردہ رکوع اور فیصد کیسے درج کریں؟')?.id).toBe('exams_entry_results');
      expect(findBestKnowledgeMatch('کلاس کا سالانہ رزلٹ اور انفرادی رزلٹ کارڈ کیسے پرنٹ کریں؟')?.id).toBe('exams_print_cards');
    });

    it('routes daily sabaq/sabqi/manzil to Educational Records (NOT Monthly Evaluations) and covers all 4 Records sub-tabs', () => {
      const dailyPerf = findBestKnowledgeMatch('روزانہ کا سبق، سبقی اور منزل کہاں درج ہوتا ہے؟');
      expect(dailyPerf?.id).toBe('records_daily_performance');

      expect(findBestKnowledgeMatch('پارہ بہ پارہ تکمیل حفظ اور درمیان حفظ منتقلی کیسے درج کریں؟')?.id).toBe('records_para_by_para');
      expect(findBestKnowledgeMatch('مجموعی حفظ کارکردگی فارم اور ہجری تاریخ کہاں سے ملے گی؟')?.id).toBe('records_cumulative_form');
      expect(findBestKnowledgeMatch('ششماہی تعلیمی ریکارڈز کا مجموعی خلاصہ کہاں ہے؟')?.id).toBe('records_half_yearly_summary');
    });

    it('matches staff, teacher account, payroll settings/holidays and monthly payroll calculation', () => {
      expect(findBestKnowledgeMatch('نیا استاد کیسے شامل کریں اور ڈیوٹی کے اوقات کہاں درج ہوتے ہیں؟')?.id).toBe('staff_management');
      expect(findBestKnowledgeMatch('استاد کا نیا اکاؤنٹ کیسے بنائیں؟')?.id).toBe('staff_account_create');
      expect(findBestKnowledgeMatch('پے رول کا شعبہ کون دیکھ سکتا ہے اور بنیادی تنخواہ کہاں درج ہوتی ہے؟')?.id).toBe('payroll_overview_salary');
      expect(findBestKnowledgeMatch('تنخواہ کی ترتیبات، رعایتی منٹ اور عید کی تعطیلات کیسے شامل کریں؟')?.id).toBe('payroll_settings_holidays');
      expect(findBestKnowledgeMatch('اساتذہ کی ماہانہ تنخواہ، کٹوتیاں اور حتمی منظوری کا طریقہ کیا ہے؟')?.id).toBe('payroll_monthly_calculation');
    });

    it('matches tasks & reminders, super admin, password, logo, offline sync and theme queries', () => {
      expect(findBestKnowledgeMatch('زیر غور و یادداشت میں خودکار اور ذاتی کام کیسے دیکھیں؟')?.id).toBe('tasks_reminders');
      expect(findBestKnowledgeMatch('سپر ایڈمن پینل سے نیا مدرسہ کیسے رجسٹر کریں یا معطل کریں؟')?.id).toBe('super_admin');
      expect(findBestKnowledgeMatch('اپنا لاگ ان پاسورڈ کیسے تبدیل کریں؟')?.id).toBe('change_password');
      expect(findBestKnowledgeMatch('میں اپنا پاسورڈ بھول گیا ہوں کیسے ری سیٹ کروں؟')?.id).toBe('forgot_password');
      expect(findBestKnowledgeMatch('مدرسے کا لوگو اور پروفائل تصویر کیسے لگائیں؟')?.id).toBe('login_profile_settings');
      expect(findBestKnowledgeMatch('اگر انٹرنیٹ بند ہو جائے تو کیا آف لائن ڈیٹا محفوظ ہوگا؟')?.id).toBe('offline_sync');
      expect(findBestKnowledgeMatch('ڈارک موڈ اور نائٹ تھیم کیسے لگاتے ہیں؟')?.id).toBe('theme_toggle');
    });

    it('prevents partial substring collisions (e.g. دور inside دوسری, نمبر inside رول نمبر)', () => {
      const transfer = findBestKnowledgeMatch('دوسری کلاس میں طالب علم کی منتقلی کیسے کریں؟');
      expect(transfer?.id).toBe('class_transfer');

      const searchByRoll = findBestKnowledgeMatch('طالب علم کو رول نمبر سے کیسے تلاش کریں؟');
      expect(searchByRoll?.id).toBe('students_list');
    });

    it('flags single broad ambiguous queries with related topic suggestions', () => {
      const analysis = analyzeKnowledgeQuery('رپورٹ');
      expect(analysis.status).toBe('ambiguous');
      expect(analysis.bestMatch).toBeNull();
      expect(analysis.suggestions.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null for irrelevant queries outside madrasa domain', () => {
      expect(findBestKnowledgeMatch('آج کا کھانا کیا ہے؟')).toBeNull();
      expect(findBestKnowledgeMatch('لاہور سے کراچی کا فاصلہ کتنا ہے؟')).toBeNull();
      expect(findBestKnowledgeMatch('کرکٹ میچ کا اسکور کیا ہے؟')).toBeNull();
    });
  });
});
