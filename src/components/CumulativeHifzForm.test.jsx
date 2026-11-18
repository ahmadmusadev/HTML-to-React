import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CumulativeHifzForm from './CumulativeHifzForm';
import * as MadrasaContext from '../context/MadrasaContext';

describe('CumulativeHifzForm (مجموعی حفظ کارکردگی فارم)', () => {
  const mockStudents = [
    {
      id: 'std-uuid-1',
      roll_number: '10979',
      admRegNo: '10979',
      name: 'محمد ابراہیم شاہد',
      father_name: 'محمد شاہد خان',
      date_of_birth: '2015-08-06',
      admission_date: '2019-04-04',
      department: 'قاعدہ',
      initial_department: 'قاعدہ',
      qaida_start_date: '2019-04-04',
      qaida_completion_date: '2020-09-23',
      nazira_start_date: '2019-04-03',
      nazira_completion_date: '2020-09-23',
      hifz_start_date: '2020-11-01',
      hifz_completion_date: '2026-05-20',
      address: 'بیدیاں روڈ لاہور',
      father_mobile: '03001234567',
      class_id: 'cls-uuid-1'
    }
  ];

  const mockClasses = [
    {
      id: 'cls-uuid-1',
      name: 'کلاس حفظ الف',
      teacher_name: 'قاری عبد اللطیف صاحب'
    }
  ];

  const mockSave = vi.fn().mockResolvedValue({
    id: 'form-uuid-1',
    student_id: 'std-uuid-1',
    computer_id: '100723',
    hifz_duration_text: '5 سال، 6 ماہ، 19 دن'
  });

  const mockContextValue = {
    activeMadrasaId: 'madrasa-uuid-1',
    activeMadrasa: {
      id: 'madrasa-uuid-1',
      name: 'جامعہ روضۃ الاطفال',
      name_english: 'JAMIA RAUZATAL ATFAL',
      district: 'لاہور'
    },
    activeLogo: 'https://example.com/logo.png',
    fetchStudentsFromSupabase: vi.fn().mockResolvedValue(mockStudents),
    fetchClassesFromSupabase: vi.fn().mockResolvedValue(mockClasses),
    fetchHifzCompletionFormsFromSupabase: vi.fn().mockResolvedValue([]),
    fetchHifzCompletionFormForStudent: vi.fn().mockResolvedValue(null),
    saveHifzCompletionFormToSupabase: mockSave,
    classesList: mockClasses
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MadrasaContext, 'useMadrasa').mockReturnValue(mockContextValue);
  });

  it('renders initial empty state with student selection prompt', () => {
    render(<CumulativeHifzForm />);
    expect(screen.getByText('مجموعی حفظ کارکردگی فارم')).toBeInTheDocument();
    expect(screen.getByText(/براہِ کرم اوپر دی گئی فہرست میں سے کسی طالب علم کا انتخاب کریں/)).toBeInTheDocument();
  });

  it('populates student details and auto-calculates duration when a student is selected', async () => {
    render(<CumulativeHifzForm initialStudentId="std-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('محمد ابراہیم شاہد')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('محمد شاہد خان')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10979')).toBeInTheDocument();

    // Verify Hifz duration is calculated from 2020-11-01 to 2026-05-20 (5 سال، 6 ماہ، 19 دن)
    await waitFor(() => {
      expect(screen.getByDisplayValue(/5 سال، 6 ماہ/)).toBeInTheDocument();
    });
  });

  it('auto-computes exam grade when entering marks', async () => {
    render(<CumulativeHifzForm initialStudentId="std-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('محمد ابراہیم شاہد')).toBeInTheDocument();
    });

    const marksInputs = screen.getAllByPlaceholderText('نمبرات');
    expect(marksInputs.length).toBeGreaterThan(0);
    fireEvent.change(marksInputs[0], { target: { value: '83' } });

    // 83 is >= 80, so grade should be ممتاز
    await waitFor(() => {
      expect(screen.getByDisplayValue('ممتاز')).toBeInTheDocument();
    });
  });

  it('strictly adheres to customizations: institution stamp present, Nazim-ul-Umoor removed, no emojis', async () => {
    render(<CumulativeHifzForm initialStudentId="std-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('محمد ابراہیم شاہد')).toBeInTheDocument();
    });

    // Switch to preview mode
    const previewBtn = screen.getByText('پرنٹ پری ویو (A4)');
    fireEvent.click(previewBtn);

    // Verify header branding
    expect(screen.getAllByText('جامعہ روضۃ الاطفال').length).toBeGreaterThan(0);
    expect(screen.getAllByText('JAMIA RAUZATAL ATFAL').length).toBeGreaterThan(0);

    // Verify footer customizations:
    // 1. ادارہ کی مہر must exist
    expect(screen.getAllByText(/ادارہ کی مہر/).length).toBeGreaterThan(0);

    // 2. شاخ کی مہر must NOT exist in footer
    const bodyText = document.body.textContent;
    expect(bodyText).not.toContain('شاخ کی مہر');

    // 3. دستخط ناظم الامور must NOT exist
    expect(bodyText).not.toContain('دستخط ناظم الامور');

    // 4. دستخط مرتب and دستخط ناظم تعلیمات must exist
    expect(screen.getAllByText(/دستخط ناظم تعلیمات/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/دستخط مرتب/).length).toBeGreaterThan(0);

    // 5. No emojis in the DOM
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(document.body.innerHTML)).toBe(false);
  });

  it('calls saveHifzCompletionFormToSupabase when save button is clicked', async () => {
    render(<CumulativeHifzForm initialStudentId="std-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('محمد ابراہیم شاہد')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: 'محفوظ کریں' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('کارکردگی فارم کامیابی سے محفوظ ہو گیا ہے۔')).toBeInTheDocument();
    });
  });

  it('contains the specified categories in the overall quality (مجموعی کیفیت) dropdown', async () => {
    render(<CumulativeHifzForm initialStudentId="std-uuid-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('محمد ابراہیم شاہد')).toBeInTheDocument();
    });

    const qualitySelect = screen.getByLabelText('مجموعی کیفیت');
    const options = Array.from(qualitySelect.querySelectorAll('option')).map(opt => opt.value);
    expect(options).toEqual(['بہترین', 'بہتر', 'اوسط', 'قدرے اوسط', 'کمزور']);
  });
});
