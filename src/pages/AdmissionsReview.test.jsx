import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Admissions from './Admissions';
import * as MadrasaContextModule from '../context/MadrasaContext';
import fs from 'fs';
import path from 'path';

describe('Admissions Step 4 At-a-Glance Profile & Class/Teacher Resolution', () => {
  const mockClasses = [
    {
      id: 'a20850ec-9a7a-4da5-995e-45ab03b2ee6a',
      name: 'حفظِ قرآن — سال اول',
      class_name: 'حفظِ قرآن — سال اول',
      teacher: 'مولانا محمد اسحاق',
      teacher_name: 'مولانا محمد اسحاق'
    },
    {
      id: 'cls-2',
      name: 'حفظِ قرآن — ناظرہ',
      class_name: 'حفظِ قرآن — ناظرہ',
      teacher: 'مولانا عبدالرحمن',
      teacher_name: 'مولانا عبدالرحمن'
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
      addStudentToSupabase: vi.fn().mockResolvedValue({ id: 'new-std-1', name: 'عمر' }),
      updateStudentInSupabase: vi.fn(),
      withdrawStudentInSupabase: vi.fn(),
    });
  });

  it('navigates through steps to step 4 and displays class name and teacher name instead of raw UUID', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    // Step 1: Fill student details
    const nameInput = container.querySelector('#admName');
    const fatherNameInput = container.querySelector('#admFatherName');
    const classSelect = container.querySelector('#admClass');
    const bformInput = container.querySelector('#admBForm');

    expect(nameInput).not.toBeNull();
    fireEvent.change(nameInput, { target: { id: 'admName', value: 'عمر' } });
    fireEvent.change(fatherNameInput, { target: { id: 'admFatherName', value: 'یونس' } });
    fireEvent.change(classSelect, { target: { id: 'admClass', value: 'a20850ec-9a7a-4da5-995e-45ab03b2ee6a' } });
    fireEvent.change(bformInput, { target: { id: 'admBForm', value: '35210-9877366-6' } });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/اگلا: والد کی معلومات/i));

    // Step 2: Fill father details
    const fatherCnicInput = container.querySelector('#fatherCnic');
    const fatherMobileInput = container.querySelector('#fatherMobile');
    const fatherOccInput = container.querySelector('#fatherOcc');

    expect(fatherCnicInput).not.toBeNull();
    fireEvent.change(fatherCnicInput, { target: { id: 'fatherCnic', value: '35201-1234567-1' } });
    fireEvent.change(fatherMobileInput, { target: { id: 'fatherMobile', value: '0300-1234567' } });
    fireEvent.change(fatherOccInput, { target: { id: 'fatherOcc', value: 'تاجر' } });

    // Step 2 -> Step 3
    fireEvent.click(screen.getByText(/اگلا: والدہ کی معلومات/i));

    // Step 3: Fill mother details
    const motherNameInput = container.querySelector('#motherName');
    expect(motherNameInput).not.toBeNull();
    fireEvent.change(motherNameInput, { target: { id: 'motherName', value: 'فاطمہ' } });

    // Step 3 -> Step 4
    fireEvent.click(screen.getByText(/اگلا: جائزہ و تکمیل/i));

    // Step 4 verification:
    // 1. Verify Class Name and Teacher Name are displayed prominently
    const classNameEl = document.getElementById('reviewClassNameDisplay');
    const teacherNameEl = document.getElementById('reviewTeacherNameDisplay');

    expect(classNameEl).not.toBeNull();
    expect(classNameEl?.textContent?.trim()).toBe('حفظِ قرآن — سال اول');

    expect(teacherNameEl).not.toBeNull();
    expect(teacherNameEl?.textContent?.trim()).toBe('مولانا محمد اسحاق');

    // Make sure raw UUID is NOT shown as class name
    expect(classNameEl?.textContent).not.toContain('a20850ec-9a7a-4da5-995e-45ab03b2ee6a');

    // 2. Verify all sections and details are present
    expect(screen.getByText('عمر', { selector: '.adm-review-name' })).toBeDefined();
    expect(screen.getByText('35210-9877366-6', { selector: '.review-field-val' })).toBeDefined();
    expect(screen.getByText('35201-1234567-1', { selector: '.review-field-val' })).toBeDefined();
    expect(screen.getByText('فاطمہ', { selector: '.review-field-val' })).toBeDefined();

    // 3. Verify section titles
    expect(screen.getByText(/طالب علم کی ذاتی تفصیلات/i)).toBeDefined();
    expect(screen.getByText(/والد محترم کے کوائف/i)).toBeDefined();
    expect(screen.getByText(/والدہ ماجدہ کے کوائف/i)).toBeDefined();
  });

  it('displays guardian section when father is not guardian in Step 4', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    const nameInput = container.querySelector('#admName');
    fireEvent.change(nameInput, { target: { id: 'admName', value: 'طاہر' } });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/اگلا: والد کی معلومات/i));

    // Select Father is not guardian
    const guardianNoRadio = container.querySelector('#guardianNo');
    expect(guardianNoRadio).not.toBeNull();
    fireEvent.click(guardianNoRadio);

    // Step 2 -> Step 3
    fireEvent.click(screen.getByText(/اگلا: والدہ کی معلومات/i));

    // Fill Guardian info
    const guardianNameInput = container.querySelector('#guardianName');
    const guardianRelInput = container.querySelector('#guardianRel');
    if (guardianNameInput) {
      fireEvent.change(guardianNameInput, { target: { id: 'guardianName', value: 'چچا بلال' } });
      fireEvent.change(guardianRelInput, { target: { id: 'guardianRel', value: 'چچا' } });
    }

    // Step 3 -> Step 4
    fireEvent.click(screen.getByText(/اگلا: جائزہ و تکمیل/i));

    // Verify guardian card rendered on Step 4
    expect(screen.getByText(/سرپرست کے کوائف/i)).toBeDefined();
    expect(screen.getByText('چچا بلال', { selector: '.review-field-val' })).toBeDefined();
    expect(screen.getByText('چچا', { selector: '.review-field-val' })).toBeDefined();
  });

  it('allows clicking edit buttons in Step 4 to jump directly back to previous steps for changes', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    // Jump to Step 4 with valid name
    const nameInput = container.querySelector('#admName');
    fireEvent.change(nameInput, { target: { id: 'admName', value: 'علی' } });

    // Advance to Step 4
    fireEvent.click(screen.getByText(/اگلا: والد کی معلومات/i));
    fireEvent.click(screen.getByText(/اگلا: والدہ کی معلومات/i));
    fireEvent.click(screen.getByText(/اگلا: جائزہ و تکمیل/i));

    // Verify on Step 4
    expect(screen.getByText(/مرحلہ 4 — جائزہ و تکمیل/i)).toBeDefined();

    // Click edit on Father's section
    const editFatherBtn = screen.getByTitle('والد کی معلومات میں ترمیم کریں');
    fireEvent.click(editFatherBtn);

    // Verify now on Step 2
    expect(screen.getByText(/مرحلہ 2 — والد کی معلومات/i)).toBeDefined();
  });

  it('verifies dark-mode.css includes proper rules for review components without illegible colors', () => {
    const darkModeCssPath = path.resolve(__dirname, '../dark-mode.css');
    const css = fs.readFileSync(darkModeCssPath, 'utf8');

    expect(css).toContain('.adm-class-spotlight');
    expect(css).toContain('.adm-review-card');
    expect(css).toContain('.review-field-val');
    expect(css).toContain('.adm-spotlight-val');
    expect(css).toContain('#ffffff !important');
    expect(css).not.toContain('.review-value { color: #1e293b; }');
  });
});
