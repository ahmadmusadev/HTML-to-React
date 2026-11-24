import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Entry from './Entry';
import * as MadrasaContextModule from '../context/MadrasaContext';

describe('Entry.jsx (جائزہ جات) Tab Cleanliness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: 'test-madrasa',
      classesList: [],
      loadMadrasaData: vi.fn().mockReturnValue({}),
      saveMadrasaData: vi.fn(),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue([]),
      fetchExamResultsFromSupabase: vi.fn().mockResolvedValue([]),
      fetchExamMiqdarFromSupabase: vi.fn().mockResolvedValue([])
    });
  });

  it('does NOT contain روزانہ تعلیمی کارکردگی in جائزہ جات tabs', () => {
    render(<Entry />);
    // The daily performance tab should not exist in Entry / جائزہ جات
    expect(screen.queryByRole('button', { name: /روزانہ تعلیمی کارکردگی/ })).not.toBeInTheDocument();

    // Verify the standard 6 examination tabs are present
    expect(screen.getByRole('button', { name: 'اندراج ماہانہ جائزہ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اندراج ماہانہ خواندگی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ششماہی و سالانہ خواندگی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'کلاس کی انفرادی رپورٹ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'طالب علم کی انفرادی رپورٹ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'نتیجہ ماہانہ جائزہ — پورا ادارہ' })).toBeInTheDocument();
  });
});
