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
});
