import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiChatbot, { findBestKnowledgeMatch, normalizeUrduText } from './AiChatbot';

describe('AiChatbot Component', () => {
  it('renders floating trigger button initially', () => {
    render(<AiChatbot />);
    const button = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('اے آئی رہنما')).toBeInTheDocument();
  });

  it('opens drawer on trigger button click and shows welcome message', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    expect(screen.getAllByText('اے آئی رہنما').length).toBeGreaterThan(0);
  });

  it('displays 5 preset prompt chips in drawer', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    expect(screen.getByText('نئے طالب علم کا نیا داخلہ کیسے کریں؟')).toBeInTheDocument();
    expect(screen.getByText('روزانہ کا سبق، سبقی اور منزل کیسے درج کریں؟')).toBeInTheDocument();
    expect(screen.getByText('طالب علم کی ماہانہ فیس کا ریکارڈ کیسے اپڈیٹ کریں؟')).toBeInTheDocument();
    expect(screen.getByText('کلاس یا مدرسے کے استاد کا نیا اکاؤنٹ کیسے بنائیں؟')).toBeInTheDocument();
    expect(screen.getByText('روزانہ کی حاضری کا طریقہ کار کیا ہے؟')).toBeInTheDocument();
  });

  it('clicks Admissions chip and displays Admissions response', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    const chip = screen.getByText('نئے طالب علم کا نیا داخلہ کیسے کریں؟');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText(/نئے طالب علم کے داخلہ کا طریقہ کار/i)).toBeInTheDocument();
    });
  });

  it('clicks Fees chip and displays Fees response (not Admissions)', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    const chip = screen.getByText('طالب علم کی ماہانہ فیس کا ریکارڈ کیسے اپڈیٹ کریں؟');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText(/فیس کا ریکارڈ اور رسید جاری کرنے کا طریقہ/i)).toBeInTheDocument();
      expect(screen.queryByText(/نئے طالب علم کے داخلہ کا طریقہ کار/i)).not.toBeInTheDocument();
    });
  });

  it('handles out-of-scope queries with domain restriction message', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.change(input, { target: { value: 'موسم کا حال کیا ہے؟' } });

    const sendBtn = screen.getByTitle('ارسال کریں');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/مدرسہ منیجر سافٹ ویئر کے دائرہ کار سے باہر ہے/i)).toBeInTheDocument();
    });
  });

  it('updates trigger position when dragged and does not open drawer on drag end', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    const initialLeft = trigger.style.left;
    const initialTop = trigger.style.top;

    // Simulate drag gesture
    fireEvent.pointerDown(trigger, { clientX: 50, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(trigger, { clientX: 120, clientY: 420, pointerId: 1 });
    fireEvent.pointerUp(trigger, { clientX: 120, clientY: 420, pointerId: 1 });

    // Click event should be ignored if just dragged
    fireEvent.click(trigger);

    // Trigger position should have changed
    expect(trigger.style.left).not.toBe(initialLeft);
    expect(trigger.style.top).not.toBe(initialTop);

    // Drawer should NOT have opened because it was a drag, not a simple tap
    expect(screen.queryByPlaceholderText('اپنا سوال یہاں لکھیں...')).not.toBeInTheDocument();
  });

  it('updates drawer position when header is dragged', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    const header = screen.getByText('آن لائن | تعلیمی رہنما').closest('.ai-chatbot-header');
    const drawer = header.closest('.ai-chatbot-drawer');
    const initialLeft = drawer.style.left;
    const initialTop = drawer.style.top;

    // Simulate drag gesture on drawer (drag upward and rightward within viewport bounds)
    fireEvent.pointerDown(drawer, { clientX: 100, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(drawer, { clientX: 180, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(drawer, { clientX: 180, clientY: 100, pointerId: 1 });

    // Drawer position should have updated
    expect(drawer.style.left).not.toBe(initialLeft);
    expect(drawer.style.top).not.toBe(initialTop);
  });

  it('differentiates small movement click (< 6px) from drag (>= 6px)', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });

    // Small movement (e.g. 2px touch tremor below 6px threshold)
    fireEvent.pointerDown(trigger, { clientX: 50, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(trigger, { clientX: 52, clientY: 501, pointerId: 1 });
    fireEvent.pointerUp(trigger, { clientX: 52, clientY: 501, pointerId: 1 });
    fireEvent.click(trigger);

    // Drawer SHOULD open because movement was below 6px threshold
    expect(screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...')).toBeInTheDocument();
  });

  it('ensures interactive elements inside drawer (close button, prompt chips, input) are not blocked by drag handlers', () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    // Verify input accepts typing without drag interception
    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.pointerDown(input, { clientX: 100, clientY: 100 });
    fireEvent.change(input, { target: { value: 'طالب علم فیس' } });
    expect(input.value).toBe('طالب علم فیس');

    // Verify close button can be clicked to close the drawer
    const closeBtn = screen.getByRole('button', { name: 'بند کریں' });
    fireEvent.pointerDown(closeBtn, { clientX: 300, clientY: 50 });
    fireEvent.click(closeBtn);

    // Drawer should now be closed and trigger button visible again
    expect(screen.queryByPlaceholderText('اپنا سوال یہاں لکھیں...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i })).toBeInTheDocument();
  });

  it('accurately distinguishes withdrawal from new admission when queried via chat input', async () => {
    render(<AiChatbot />);
    const trigger = screen.getByRole('button', { name: /Toggle AI Rehnuma Assistant/i });
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('اپنا سوال یہاں لکھیں...');
    fireEvent.change(input, { target: { value: 'طالب علم کا داخلہ خارج یا کینسل کیسے کریں؟' } });

    const sendBtn = screen.getByTitle('ارسال کریں');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      // Must show withdrawal instructions
      expect(screen.getByText(/طالب علم کے اخراج \(منسوخی داخلہ\) کا طریقہ کار/i)).toBeInTheDocument();
      // Must NOT show new admission instructions
      expect(screen.queryByText(/نئے طالب علم کے داخلہ کا طریقہ کار/i)).not.toBeInTheDocument();
    });
  });

  describe('findBestKnowledgeMatch & NLP Intent Matching Engine', () => {
    it('normalizes Urdu text stripping diacritics and unifying characters', () => {
      expect(normalizeUrduText('طَالِبُ العِلمِ؟!')).toBe('طالب العلم');
      expect(normalizeUrduText('مدرسہ كے طلباء')).toBe('مدرسہ کے طلباء');
      expect(normalizeUrduText('چھٹی/رخصت')).toBe('چھٹی رخصت');
    });

    it('matches student withdrawal without misrouting to new admissions', () => {
      const match = findBestKnowledgeMatch('طالب علم کا نام خارج کرنا ہے');
      expect(match).not.toBeNull();
      expect(match.id).toBe('student_withdrawal');
      expect(match.response).toContain('طالب علم کے اخراج (منسوخی داخلہ) کا طریقہ کار');
    });

    it('matches class transfer correctly', () => {
      const match = findBestKnowledgeMatch('طالب علم کو دوسری کلاس میں ٹرانسفر کیسے کریں؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('class_transfer');
      expect(match.response).toContain('طالب علم کو دوسری کلاس میں منتقل (Transfer) کرنے کا طریقہ');
    });

    it('matches fee defaulters correctly', () => {
      const match = findBestKnowledgeMatch('فیس نادہندگان کی رپورٹ کہاں ہے جن کی فیس باقی ہے؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('fee_defaulters');
      expect(match.response).toContain('فیس نادہندگان اور بقایا جات دیکھنے کا طریقہ');
    });

    it('matches fee receipt printing without mixing with general fee collection', () => {
      const match = findBestKnowledgeMatch('فیس کی پرانی رسید دوبارہ کیسے پرنٹ کریں؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('fee_receipt');
      expect(match.response).toContain('فیس رسید پرنٹ کرنے کا طریقہ');
    });

    it('matches student ID card without confusing with exam result card', () => {
      const match = findBestKnowledgeMatch('طالب علم کا شناختی کارڈ کیسے پرنٹ ہوگا؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('records_id_card');
      expect(match.response).toContain('طالب علم کا شناختی کارڈ');
    });

    it('matches exam result card print correctly', () => {
      const match = findBestKnowledgeMatch('امتحان کا رزلٹ کارڈ اور کشف الدرجات پرنٹ کرنا ہے');
      expect(match).not.toBeNull();
      expect(match.id).toBe('exam_result_print');
      expect(match.response).toContain('امتحانی رزلٹ کارڈ اور گزٹ پرنٹ کرنے کا طریقہ');
    });

    it('matches staff attendance without confusing with student attendance', () => {
      const match = findBestKnowledgeMatch('اساتذہ کی حاضری اور چیک ان کیسے نوٹ کریں؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('staff_attendance');
      expect(match.response).toContain('اساتذہ اور اسٹاف کی حاضری لگانے کا طریقہ');
    });

    it('matches change password and forgot password intents accurately', () => {
      const changeMatch = findBestKnowledgeMatch('اپنا لاگ ان پاسورڈ کیسے تبدیل کریں؟');
      expect(changeMatch).not.toBeNull();
      expect(changeMatch.id).toBe('change_password');

      const forgotMatch = findBestKnowledgeMatch('میں اپنا پاسورڈ بھول گیا ہوں کیسے ری سیٹ کروں؟');
      expect(forgotMatch).not.toBeNull();
      expect(forgotMatch.id).toBe('forgot_password');
    });

    it('matches offline mode and sync questions', () => {
      const match = findBestKnowledgeMatch('اگر انٹرنیٹ بند ہو جائے تو کیا آف لائن ڈیٹا محفوظ ہوگا؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('offline_sync');
      expect(match.response).toContain('آف لائن موڈ اور خودکار سنک (Auto-Sync) کی معلومات');
    });

    it('matches theme dark mode questions', () => {
      const match = findBestKnowledgeMatch('ڈارک موڈ اور نائٹ تھیم کیسے لگاتے ہیں؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('theme_toggle');
      expect(match.response).toContain('ڈارک اور لائٹ موڈ تبدیل کرنے کا طریقہ');
    });

    it('matches super admin madrasa creation queries', () => {
      const match = findBestKnowledgeMatch('سپر ایڈمن پینل سے نیا مدرسہ کیسے رجسٹر کریں؟');
      expect(match).not.toBeNull();
      expect(match.id).toBe('super_admin');
      expect(match.response).toContain('سپر ایڈمن پینل کے استعمال کا طریقہ');
    });

    it('returns null for irrelevant queries outside madrasa domain', () => {
      expect(findBestKnowledgeMatch('آج کا کھانا کیا ہے؟')).toBeNull();
      expect(findBestKnowledgeMatch('لاہور سے کراچی کا فاصلہ کتنا ہے؟')).toBeNull();
      expect(findBestKnowledgeMatch('کرکٹ میچ کا اسکور کیا ہے؟')).toBeNull();
    });
  });
});
