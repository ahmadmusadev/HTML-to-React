import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Admissions from './Admissions';
import * as MadrasaContextModule from '../context/MadrasaContext';
import fs from 'fs';
import path from 'path';

describe('Admissions Department (شعبہ) Dropdown & Row Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: '11111111-1111-1111-1111-111111111111',
      activeMadrasa: { id: '11111111-1111-1111-1111-111111111111', name: 'دارالعلوم مدینہ' },
      madrasas: [{ id: '11111111-1111-1111-1111-111111111111', name: 'دارالعلوم مدینہ' }],
      fetchRecordsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue([
        { id: 'c1', name: 'کلاس اول', teacher: 'استاد احمد' }
      ]),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue([]),
      seedDefaultClassesForMadrasa: vi.fn().mockResolvedValue([]),
      addClassToSupabase: vi.fn(),
      updateClassInSupabase: vi.fn(),
      deleteClassFromSupabase: vi.fn(),
      deleteStudentFromSupabase: vi.fn(),
      addStudentToSupabase: vi.fn(),
      updateStudentInSupabase: vi.fn(),
      withdrawStudentInSupabase: vi.fn(),
    });
  });

  it('renders Department (شعبہ), Class (کلاس), and Gender (صنف) in the same row in correct order', () => {
    render(<Admissions />);

    const deptSelect = screen.getByLabelText('شعبہ');
    const classSelect = screen.getByLabelText('کلاس');
    const genderLabel = screen.getByText('صنف');

    expect(deptSelect).toBeDefined();
    expect(classSelect).toBeDefined();
    expect(genderLabel).toBeDefined();

    // Verify row container has the single-row class
    const rowContainer = deptSelect.closest('.adm-dept-class-gender-row');
    expect(rowContainer).toBeDefined();
    expect(rowContainer.contains(deptSelect)).toBe(true);
    expect(rowContainer.contains(classSelect)).toBe(true);
    expect(rowContainer.contains(genderLabel)).toBe(true);

    // Verify DOM order: 1st dept (right in RTL), 2nd class (middle), 3rd gender (left in RTL)
    const children = Array.from(rowContainer.children);
    expect(children.length).toBe(3);
    expect(children[0].contains(deptSelect)).toBe(true);
    expect(children[1].contains(classSelect)).toBe(true);
    expect(children[2].contains(genderLabel)).toBe(true);
  });

  it('contains the three required options in Department dropdown: قاعدہ, ناظرہ, حفظ', () => {
    render(<Admissions />);

    const deptSelect = screen.getByLabelText('شعبہ');
    const options = Array.from(deptSelect.querySelectorAll('option')).map(opt => opt.value);

    expect(options).toContain('');
    expect(options).toContain('قاعدہ');
    expect(options).toContain('ناظرہ');
    expect(options).toContain('حفظ');

    // Select 'حفظ'
    fireEvent.change(deptSelect, { target: { value: 'حفظ' } });
    expect(deptSelect.value).toBe('حفظ');

    // Select 'ناظرہ'
    fireEvent.change(deptSelect, { target: { value: 'ناظرہ' } });
    expect(deptSelect.value).toBe('ناظرہ');

    // Select 'قاعدہ'
    fireEvent.change(deptSelect, { target: { value: 'قاعدہ' } });
    expect(deptSelect.value).toBe('قاعدہ');
  });

  it('CSS styles ensure 3-column single row layout on desktop with mobile responsiveness', () => {
    const cssPath = path.resolve(__dirname, 'Admissions.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('.adm-dept-class-gender-row');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('@media (max-width: 600px)');
  });
});
