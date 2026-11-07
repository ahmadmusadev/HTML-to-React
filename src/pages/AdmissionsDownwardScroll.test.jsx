import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Admissions from './Admissions';
import * as MadrasaContextModule from '../context/MadrasaContext';
import fs from 'fs';
import path from 'path';

describe('Admissions Sticky Stepper & Downward Scrolling Stage Progression', () => {
  const mockClasses = [
    {
      id: 'cls-1',
      name: 'حفظِ قرآن — سال اول',
      class_name: 'حفظِ قرآن — سال اول',
      teacher: 'مولانا محمد اسحاق',
      teacher_name: 'مولانا محمد اسحاق'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: '11111111-1111-1111-1111-111111111111',
      activeMadrasa: { id: '11111111-1111-1111-1111-111111111111', name: 'جامعہ حفظ' },
      madrasas: [{ id: '11111111-1111-1111-1111-111111111111', name: 'جامعہ حفظ' }],
      fetchRecordsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue(mockClasses),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue([]),
      seedDefaultClassesForMadrasa: vi.fn().mockResolvedValue([]),
      addClassToSupabase: vi.fn(),
      updateClassInSupabase: vi.fn(),
      deleteClassFromSupabase: vi.fn(),
      deleteStudentFromSupabase: vi.fn(),
      addStudentToSupabase: vi.fn().mockResolvedValue({ id: 'new-std-1', name: 'زید' }),
      updateStudentInSupabase: vi.fn(),
      withdrawStudentInSupabase: vi.fn(),
    });
  });

  it('renders Step 1 initially and reveals Step 2 downwards without removing Step 1', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    // Verify initially Step 1 panel is rendered
    expect(container.querySelector('#step-panel-1')).not.toBeNull();
    expect(container.querySelector('#step-panel-2')).toBeNull();

    // Fill Step 1 student name
    const nameInput = container.querySelector('#admName');
    fireEvent.change(nameInput, { target: { id: 'admName', value: 'زید بن حارثہ' } });

    // Verify next button has downward indicator
    const nextBtn1 = screen.getByText(/اگلا: والد کی معلومات/i);
    expect(nextBtn1.textContent).toContain('↓');

    // Click next button
    fireEvent.click(nextBtn1);

    // Verify Step 1 is STILL in the document and Step 2 is now revealed below it
    expect(container.querySelector('#step-panel-1')).not.toBeNull();
    expect(container.querySelector('#step-panel-2')).not.toBeNull();
    expect(screen.getByText(/مرحلہ 1 — طالب علم کی معلومات/i)).toBeDefined();
    expect(screen.getByText(/مرحلہ 2 — والد کی معلومات/i)).toBeDefined();
  });

  it('progresses through Step 3 and Step 4 with downward arrows keeping previous stages intact', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    // Step 1
    const nameInput = container.querySelector('#admName');
    fireEvent.change(nameInput, { target: { id: 'admName', value: 'سعد' } });
    fireEvent.click(screen.getByText(/اگلا: والد کی معلومات/i));

    // Step 2
    expect(container.querySelector('#step-panel-2')).not.toBeNull();
    const nextBtn2 = screen.getByText(/اگلا: والدہ کی معلومات/i);
    expect(nextBtn2.textContent).toContain('↓');
    fireEvent.click(nextBtn2);

    // Step 3
    expect(container.querySelector('#step-panel-3')).not.toBeNull();
    const nextBtn3 = screen.getByText(/اگلا: جائزہ و تکمیل/i);
    expect(nextBtn3.textContent).toContain('↓');
    fireEvent.click(nextBtn3);

    // Step 4 (All 4 panels are simultaneously in DOM on the same page)
    expect(container.querySelector('#step-panel-1')).not.toBeNull();
    expect(container.querySelector('#step-panel-2')).not.toBeNull();
    expect(container.querySelector('#step-panel-3')).not.toBeNull();
    expect(container.querySelector('#step-panel-4')).not.toBeNull();

    // Verify back buttons have upward arrow indicator
    const backBtnToMother = screen.getByText(/واپس: والدہ/i);
    expect(backBtnToMother.textContent).toContain('↑');
  });

  it('allows clicking sticky stepper circles to jump directly to unlocked stages', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    // Fill name and advance to Step 3
    const nameInput = container.querySelector('#admName');
    fireEvent.change(nameInput, { target: { id: 'admName', value: 'حمزہ' } });
    fireEvent.click(screen.getByText(/اگلا: والد کی معلومات/i));
    fireEvent.click(screen.getByText(/اگلا: والدہ کی معلومات/i));

    expect(container.querySelector('#step-panel-3')).not.toBeNull();

    // Click Circle 1 in sticky stepper
    const step1Circle = screen.getByTitle('مرحلہ 1');
    expect(step1Circle).not.toBeNull();
    fireEvent.click(step1Circle);

    // Verify Step 1 is accessible
    expect(screen.getByText(/مرحلہ 1 — طالب علم کی معلومات/i)).toBeDefined();
  });

  it('verifies Admissions.css has sticky positioning and proper dark mode rules for wizard-progress-wrap', () => {
    const cssPath = path.resolve(__dirname, 'Admissions.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('.wizard-progress-wrap');
    expect(css).toContain('position: sticky');
    expect(css).toContain('top: 0');
    expect(css).toContain('.wizard-step-panel');
    expect(css).toContain('scroll-margin-top');
    expect(css).toContain('[data-theme="dark"] .wizard-progress-wrap');
    expect(css).toContain('#141417 !important');
  });
});

