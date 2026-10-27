import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Admissions, { mapSupabaseToUi, mapUiToSupabase } from './Admissions';
import * as MadrasaContextModule from '../context/MadrasaContext';

describe('Admissions English Name and Parentage Inputs in Capital Letters', () => {
  const mockClasses = [
    {
      id: 'cls-1',
      name: 'حفظِ قرآن — سال اول',
      class_name: 'حفظِ قرآن — سال اول',
      teacher: 'مولانا اسحاق',
      teacher_name: 'مولانا اسحاق'
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
      addStudentToSupabase: vi.fn().mockResolvedValue({ id: 'new-std-1', name: 'عمر', name_english: 'UMAR' }),
      updateStudentInSupabase: vi.fn(),
      withdrawStudentInSupabase: vi.fn(),
    });
  });

  it('renders English student name and father name inputs in Step 1', () => {
    const { container } = render(<Admissions />);

    const engNameInput = container.querySelector('#admNameEnglish');
    const engFatherInput = container.querySelector('#admFatherNameEnglish');

    expect(engNameInput).not.toBeNull();
    expect(engFatherInput).not.toBeNull();
    expect(engNameInput.getAttribute('dir')).toBe('ltr');
    expect(engFatherInput.getAttribute('dir')).toBe('ltr');
  });

  it('automatically converts lowercase English name and father name into UPPERCASE', () => {
    const { container } = render(<Admissions />);

    const engNameInput = container.querySelector('#admNameEnglish');
    const engFatherInput = container.querySelector('#admFatherNameEnglish');

    fireEvent.change(engNameInput, { target: { id: 'admNameEnglish', value: 'muhammad usman' } });
    fireEvent.change(engFatherInput, { target: { id: 'admFatherNameEnglish', value: 'abdul rehman' } });

    expect(engNameInput.value).toBe('MUHAMMAD USMAN');
    expect(engFatherInput.value).toBe('ABDUL REHMAN');
  });

  it('mapUiToSupabase formats English names to trimmed uppercase', () => {
    const uiData = {
      admRegNo: '10',
      admName: 'عمر فاروق',
      admNameEnglish: '  umar farooq  ',
      admFatherName: 'خطاب',
      admFatherNameEnglish: '  khattab  '
    };

    const payload = mapUiToSupabase(uiData);
    expect(payload.name_english).toBe('UMAR FAROOQ');
    expect(payload.father_name_english).toBe('KHATTAB');
  });

  it('mapSupabaseToUi extracts uppercase English names', () => {
    const row = {
      id: 'uuid-1',
      roll_number: '10',
      name: 'عمر فاروق',
      name_english: 'umar farooq',
      father_name: 'خطاب',
      father_name_english: 'khattab'
    };

    const ui = mapSupabaseToUi(row);
    expect(ui.nameEnglish).toBe('UMAR FAROOQ');
    expect(ui.admNameEnglish).toBe('UMAR FAROOQ');
    expect(ui.fatherNameEnglish).toBe('KHATTAB');
    expect(ui.admFatherNameEnglish).toBe('KHATTAB');
  });

  it('displays English name and father name in Step 4 review screen', async () => {
    const { container } = render(<Admissions />);

    await waitFor(() => {
      expect(screen.queryByText('حفظِ قرآن — سال اول')).not.toBeNull();
    });

    const nameInput = container.querySelector('#admName');
    const fatherNameInput = container.querySelector('#admFatherName');
    const engNameInput = container.querySelector('#admNameEnglish');
    const engFatherInput = container.querySelector('#admFatherNameEnglish');
    const classSelect = container.querySelector('#admClass');

    fireEvent.change(nameInput, { target: { id: 'admName', value: 'عمر' } });
    fireEvent.change(fatherNameInput, { target: { id: 'admFatherName', value: 'یونس' } });
    fireEvent.change(engNameInput, { target: { id: 'admNameEnglish', value: 'umar' } });
    fireEvent.change(engFatherInput, { target: { id: 'admFatherNameEnglish', value: 'younas' } });
    fireEvent.change(classSelect, { target: { id: 'admClass', value: 'cls-1' } });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/اگلا: والد کی معلومات/i));
    // Step 2 -> Step 3
    fireEvent.click(screen.getByText(/اگلا: والدہ کی معلومات/i));
    // Step 3 -> Step 4
    fireEvent.click(screen.getByText(/اگلا: جائزہ و تکمیل/i));

    // Verify English names are displayed in Step 4
    expect(screen.getAllByText(/UMAR/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/YOUNAS/i).length).toBeGreaterThan(0);
  });
});
