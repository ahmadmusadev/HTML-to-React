import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Admissions from './Admissions';
import * as MadrasaContextModule from '../context/MadrasaContext';
import fs from 'fs';
import path from 'path';

describe('Admissions Gender Toggle Light and Dark Mode Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: '11111111-1111-1111-1111-111111111111',
      activeMadrasa: { id: '11111111-1111-1111-1111-111111111111', name: 'دارالعلوم مدینہ' },
      madrasas: [{ id: '11111111-1111-1111-1111-111111111111', name: 'دارالعلوم مدینہ' }],
      fetchRecordsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue([]),
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

  it('renders gender options with Male (لڑکا) selected by default', () => {
    render(<Admissions />);

    const boyLabel = screen.getByText('لڑکا', { selector: 'label' });
    const girlLabel = screen.getByText('لڑکی', { selector: 'label' });

    expect(boyLabel).toBeDefined();
    expect(girlLabel).toBeDefined();

    expect(boyLabel.classList.contains('selected')).toBe(true);
    expect(boyLabel.getAttribute('data-selected')).toBe('true');

    expect(girlLabel.classList.contains('selected')).toBe(false);
    expect(girlLabel.getAttribute('data-selected')).toBe('false');
  });

  it('switches to Female (لڑکی) when clicked and updates classes and visual state', () => {
    render(<Admissions />);

    const boyLabel = screen.getByText('لڑکا', { selector: 'label' });
    const girlLabel = screen.getByText('لڑکی', { selector: 'label' });

    fireEvent.click(girlLabel);

    expect(girlLabel.classList.contains('selected')).toBe(true);
    expect(girlLabel.getAttribute('data-selected')).toBe('true');

    expect(boyLabel.classList.contains('selected')).toBe(false);
    expect(boyLabel.getAttribute('data-selected')).toBe('false');

    // Switch back to Male
    fireEvent.click(boyLabel);

    expect(boyLabel.classList.contains('selected')).toBe(true);
    expect(boyLabel.getAttribute('data-selected')).toBe('true');
    expect(girlLabel.classList.contains('selected')).toBe(false);
    expect(girlLabel.getAttribute('data-selected')).toBe('false');
  });

  it('verifies dark-mode.css includes high-contrast rules for selected and unselected gender options', () => {
    const darkModeCssPath = path.resolve(__dirname, '../dark-mode.css');
    const css = fs.readFileSync(darkModeCssPath, 'utf8');

    // Verify unselected base style
    expect(css).toContain('.gender-toggle-wrap label');
    expect(css).toContain('#18181b');

    // Verify checked / selected distinct high-contrast style
    expect(css).toContain('input[type="radio"]:checked + label');
    expect(css).toContain('.gender-toggle-label.selected');
    expect(css).toContain('#ffffff !important');
    expect(css).toContain('#000000 !important');
  });
});
