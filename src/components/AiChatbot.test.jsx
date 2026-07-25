import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiChatbot from './AiChatbot';

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
});
