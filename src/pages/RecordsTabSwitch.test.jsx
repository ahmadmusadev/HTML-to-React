import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Records from './Records';
import * as MadrasaContext from '../context/MadrasaContext';

// Mock child components
vi.mock('../components/StudentParaRecords', () => ({
  default: () => <div data-testid="mock-para-records">پارہ بہ پارہ ریکارڈز اسکرین</div>
}));

vi.mock('../components/CumulativeHifzForm', () => ({
  default: () => <div data-testid="mock-cumulative-form">مجموعی حفظ کارکردگی فارم اسکرین</div>
}));

describe('Records Tab Navigation', () => {
  const mockContextValue = {
    activeMadrasaId: 'm-1',
    loadMadrasaData: vi.fn().mockReturnValue({}),
    saveMadrasaData: vi.fn(),
    fetchHifzHalfYearRecordsFromSupabase: vi.fn().mockResolvedValue([]),
    deleteHifzHalfYearRecordFromSupabase: vi.fn().mockResolvedValue(true),
    fetchStudentsFromSupabase: vi.fn().mockResolvedValue([])
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MadrasaContext, 'useMadrasa').mockReturnValue(mockContextValue);
  });

  it('renders all three subtabs: پارہ بہ پارہ، ششماہی، اور مجموعی حفظ کارکردگی فارم', () => {
    render(<Records />);
    expect(screen.getByRole('button', { name: /پارہ بہ پارہ تکمیلِ حفظ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ششماہی تعلیمی ریکارڈز و خلاصہ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /مجموعی حفظ کارکردگی فارم/ })).toBeInTheDocument();
  });

  it('switches to cumulative performance form when clicking its subtab button', () => {
    render(<Records />);
    const cumulativeTabBtn = screen.getByRole('button', { name: /مجموعی حفظ کارکردگی فارم/ });
    fireEvent.click(cumulativeTabBtn);

    expect(screen.getByTestId('mock-cumulative-form')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-para-records')).not.toBeInTheDocument();
  });

  it('switches between tabs cleanly without errors', () => {
    render(<Records />);
    // Default is paraRecords
    expect(screen.getByTestId('mock-para-records')).toBeInTheDocument();

    // Switch to academic records
    const academicTabBtn = screen.getByRole('button', { name: /ششماہی تعلیمی ریکارڈز و خلاصہ/ });
    fireEvent.click(academicTabBtn);
    expect(screen.getByText('اکیڈمک ریکارڈ تلاش کریں')).toBeInTheDocument();

    // Switch to cumulative
    const cumulativeTabBtn = screen.getByRole('button', { name: /مجموعی حفظ کارکردگی فارم/ });
    fireEvent.click(cumulativeTabBtn);
    expect(screen.getByTestId('mock-cumulative-form')).toBeInTheDocument();
  });
});
