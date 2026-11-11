import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Entry from '../pages/Entry';
import SubjectAnalysisModal from './SubjectAnalysisModal';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const CLASS_ID = '251aecd8-1990-4907-a02a-4651bb35a6d4';

const SAMPLE_CLASSES = [
  { id: CLASS_ID, name: 'کلاس نمبر: 1-شعبہ حفظ', teacher: 'حافظ احمد' }
];

const SAMPLE_STUDENTS = [
  {
    id: 'std-uuid-1',
    name: 'محمد حذیفہ',
    roll_number: '101',
    admRegNo: '101',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-uuid-2',
    name: 'عبداللہ خان',
    roll_number: '102',
    admRegNo: '102',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-uuid-3',
    name: 'عمر فاروق',
    roll_number: '103',
    admRegNo: '103',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-uuid-4',
    name: 'احمد علی',
    roll_number: '104',
    admRegNo: '104',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-uuid-5',
    name: 'حمزہ طارق',
    roll_number: '105',
    admRegNo: '105',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  },
  {
    id: 'std-uuid-6',
    name: 'بلال سعید',
    roll_number: '106',
    admRegNo: '106',
    class_id: CLASS_ID,
    admClass: CLASS_ID,
    status: 'active',
    isAdmissionProfile: true
  }
];

describe('Manzil and Tajweed Separate Analytical Reports Integration', () => {
  let mockFetchClasses;
  let mockFetchStudents;
  let mockFetchMonthlyEvaluations;
  let mockSaveMonthlyEvaluation;
  let mockDeleteMonthlyEvaluation;
  let mockSaveMadrasaData;
  let mockLoadMadrasaData;

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
    window.print = vi.fn();

    mockFetchClasses = vi.fn().mockResolvedValue([...SAMPLE_CLASSES]);
    mockFetchStudents = vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]);
    mockFetchMonthlyEvaluations = vi.fn().mockResolvedValue([]);
    mockSaveMonthlyEvaluation = vi.fn().mockImplementation((payload) => Promise.resolve({
      id: 'monthly-eval-uuid-1',
      ...payload
    }));
    mockDeleteMonthlyEvaluation = vi.fn().mockResolvedValue(true);
    mockSaveMadrasaData = vi.fn();
    mockLoadMadrasaData = vi.fn().mockImplementation((key) => {
      if (key === 'hf_records_v1') return { records: [...SAMPLE_STUDENTS] };
      if (key === 'hf_classes_v1') return { classes: [...SAMPLE_CLASSES] };
      return {};
    });

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      activeMadrasa: { id: MADRASA_ID, name: 'دارالعلوم مدینہ المنورہ' },
      loadMadrasaData: mockLoadMadrasaData,
      saveMadrasaData: mockSaveMadrasaData,
      fetchStudentsFromSupabase: mockFetchStudents,
      fetchClassesFromSupabase: mockFetchClasses,
      fetchMonthlyEvaluationsFromSupabase: mockFetchMonthlyEvaluations,
      saveMonthlyEvaluationToSupabase: mockSaveMonthlyEvaluation,
      deleteMonthlyEvaluationFromSupabase: mockDeleteMonthlyEvaluation,
      classesList: [...SAMPLE_CLASSES],
      setClassesList: vi.fn(),
      saveHifzHalfYearRecordToSupabase: vi.fn(),
      updateStudentHifzStartDate: vi.fn(),
      isMadrasaDisabled: false
    });
  });

  it('renders the report buttons immediately below the marks table when students are loaded', async () => {
    render(<Entry />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalled();
    });

    // Before loading, the report buttons must NOT be present
    expect(screen.queryByRole('button', { name: 'منزل کی رپورٹ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تجوید کی رپورٹ' })).not.toBeInTheDocument();

    // Select class
    const classSelect = screen.getByRole('combobox', { name: /کلاس منتخب کریں/i });
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });

    // Click "طلباء لوڈ کریں"
    const loadBtn = screen.getByText('طلباء لوڈ کریں');
    fireEvent.click(loadBtn);

    // Verify marks table and both report buttons appear
    await waitFor(() => {
      expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
    });

    const manzilBtn = screen.getByRole('button', { name: 'منزل کی رپورٹ' });
    const tajweedBtn = screen.getByRole('button', { name: 'تجوید کی رپورٹ' });

    expect(manzilBtn).toBeInTheDocument();
    expect(tajweedBtn).toBeInTheDocument();
  });

  it('generates the Manzil analytical report with accurate Mizan categories and calculations', async () => {
    render(<Entry />);

    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalled();
    });

    const classSelect = screen.getByRole('combobox', { name: /کلاس منتخب کریں/i });
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });
    fireEvent.click(screen.getByText('طلباء لوڈ کریں'));

    await waitFor(() => {
      expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
    });

    // Each row has 5 number inputs: [attendance, manzil, tajweed, islamiat, itmaad]
    const inputs = screen.getAllByRole('spinbutton');
    // Student 0: 56/60 (Cat 1: 93.33%)
    fireEvent.change(inputs[1], { target: { value: '56' } });
    // Student 1: 54/60 (Cat 1: 90%)
    fireEvent.change(inputs[6], { target: { value: '54' } });
    // Student 2: 51/60 (Cat 2: 85%)
    fireEvent.change(inputs[11], { target: { value: '51' } });
    // Student 3: 45/60 (Cat 3: 75%)
    fireEvent.change(inputs[16], { target: { value: '45' } });
    // Student 4: 44/60 (Cat 4: 73.33%)
    fireEvent.change(inputs[21], { target: { value: '44' } });
    // Student 5: 0/60 (Cat 4: 0%)
    fireEvent.change(inputs[26], { target: { value: '0' } });

    // Click "منزل کی رپورٹ"
    const manzilBtn = screen.getByRole('button', { name: 'منزل کی رپورٹ' });
    fireEvent.click(manzilBtn);

    // Verify Modal opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/تجزیاتی رپورٹ برائے ماہانہ جائزہ — منزل/i)).toBeInTheDocument();

    // Check institutional & class details
    expect(within(modal).getByText('دارالعلوم مدینہ المنورہ')).toBeInTheDocument();
    expect(within(modal).getByText('منزل (کل نمبر: 60)')).toBeInTheDocument();

    // Check Mizan totals:
    // Total entries: 6, Participating: 6, Absent: 0
    expect(within(modal).getByText('کل شریک طلبہ:')).toBeInTheDocument();
    expect(within(modal).getByText(/فیصد کا مجموعہ 100٪ ہے۔/i)).toBeInTheDocument();

    // Check Category percentages:
    // Cat 1: 2 (56, 54) -> 33%
    // Cat 2: 1 (51) -> 17%
    // Cat 3: 1 (45) -> 17%
    // Cat 4: 2 (44, 0) -> 33%
    // Total = 100%
    expect(within(modal).getAllByText('33٪').length).toBeGreaterThanOrEqual(1);
    expect(within(modal).getAllByText('17٪').length).toBeGreaterThanOrEqual(1);

    // Verify student rows inside report
    expect(within(modal).getByText('محمد حذیفہ')).toBeInTheDocument();
    expect(within(modal).getByText('56 / 60')).toBeInTheDocument();
    expect(within(modal).getByText('بلال سعید')).toBeInTheDocument();
    expect(within(modal).getByText('0 / 60')).toBeInTheDocument();

    // Test print action
    const printBtn = within(modal).getByRole('button', { name: /پرنٹ \/ PDF/i });
    fireEvent.click(printBtn);
    expect(document.body.classList.contains('printing-subject-analysis')).toBe(true);

    // Test close action
    const closeBtn = within(modal).getByRole('button', { name: 'بند کریں' });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('generates the Tajweed analytical report independently using max 10 marks', async () => {
    render(<Entry />);

    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalled();
    });

    const classSelect = screen.getByRole('combobox', { name: /کلاس منتخب کریں/i });
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });
    fireEvent.click(screen.getByText('طلباء لوڈ کریں'));

    await waitFor(() => {
      expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
    });

    // Tajweed inputs are indices: 2, 7, 12, 17, 22, 27
    const inputs = screen.getAllByRole('spinbutton');
    // Student 0: 10/10 (Cat 1: 100%)
    fireEvent.change(inputs[2], { target: { value: '10' } });
    // Student 1: 9/10 (Cat 1: 90%)
    fireEvent.change(inputs[7], { target: { value: '9' } });
    // Student 2: 8.5/10 (Cat 2: 85%)
    fireEvent.change(inputs[12], { target: { value: '8.5' } });
    // Student 3: 8/10 (Cat 3: 80%)
    fireEvent.change(inputs[17], { target: { value: '8' } });
    // Student 4: 7/10 (Cat 4: 70%)
    fireEvent.change(inputs[22], { target: { value: '7' } });
    // Student 5: 0/10 (Cat 4: 0%)
    fireEvent.change(inputs[27], { target: { value: '0' } });

    // Click "تجوید کی رپورٹ"
    const tajweedBtn = screen.getByRole('button', { name: 'تجوید کی رپورٹ' });
    fireEvent.click(tajweedBtn);

    // Verify Modal opens for Tajweed
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(/تجزیاتی رپورٹ برائے ماہانہ جائزہ — تجوید/i)).toBeInTheDocument();
    expect(within(modal).getByText('تجوید (کل نمبر: 10)')).toBeInTheDocument();

    expect(within(modal).getByText('10 / 10')).toBeInTheDocument();
    expect(within(modal).getByText('8.5 / 10')).toBeInTheDocument();
    expect(within(modal).getByText('0 / 10')).toBeInTheDocument();
  });

  it('correctly handles blank or absent student marks without treating them as zero', async () => {
    // 2 students: 1 has mark 54/60, 1 has blank mark
    const twoStudents = [
      { id: 's1', name: 'طالب الف', regNo: '1', manzil: 54 },
      { id: 's2', name: 'طالب ب', regNo: '2', manzil: '' }
    ];

    render(
      <SubjectAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        subjectKey="manzil"
        students={twoStudents}
        className="کلاس 1"
        month="اپریل"
        year="2025"
        madrasaName="جامعہ ٹیسٹ"
      />
    );

    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('کل اندراجات:')).toBeInTheDocument();
    expect(within(modal).getByText('غیر حاضر / غیر درج')).toBeInTheDocument();

    // Denominator for percentages is 1 (participating), so Cat 1 is 100%
    expect(within(modal).getAllByText('100٪').length).toBeGreaterThanOrEqual(1);
    expect(within(modal).getByText('فیصد کا مجموعہ 100٪ ہے۔')).toBeInTheDocument();
  });

  it('calculates true total sum without clamping to 100 and shows error when marks exceed maximum', async () => {
    render(<Entry />);

    await waitFor(() => {
      expect(mockFetchClasses).toHaveBeenCalled();
    });

    const classSelect = screen.getByRole('combobox', { name: /کلاس منتخب کریں/i });
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });
    fireEvent.click(screen.getByText('طلباء لوڈ کریں'));

    await waitFor(() => {
      expect(screen.getByText('محمد حذیفہ')).toBeInTheDocument();
    });

    // Inputs for student 0: [attendance (10), manzil (60), tajweed (10), islamiat (10), itmaad (10)]
    const inputs = screen.getAllByRole('spinbutton');
    
    // Enter 10 in attendance (index 0)
    fireEvent.change(inputs[0], { target: { value: '10' } });
    // Enter 61 in manzil (> 60 max, index 1)
    fireEvent.change(inputs[1], { target: { value: '61' } });
    // Enter 13 in tajweed (> 10 max, index 2)
    fireEvent.change(inputs[2], { target: { value: '13' } });
    // Enter 10 in islamiat (index 3)
    fireEvent.change(inputs[3], { target: { value: '10' } });
    // Enter 10 in itmaad (index 4)
    fireEvent.change(inputs[4], { target: { value: '10' } });

    // Verify true sum is displayed in total cell (10 + 61 + 13 + 10 + 10 = 104, NOT clamped to 100)
    expect(screen.getAllByText('104').length).toBeGreaterThanOrEqual(1);
    const totalCell = document.querySelector('.me-total-cell.me-total-invalid');
    expect(totalCell).toBeInTheDocument();
    expect(totalCell).toHaveTextContent('104');

    // Verify error banner is visible
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/کل نمبر.*سے زیادہ ہیں/i)).toBeInTheDocument();

    // Verify inputs have invalid class
    expect(inputs[1]).toHaveClass('me-invalid');
    expect(inputs[2]).toHaveClass('me-invalid');

    // Test cursor trapping: pressing Tab on invalid input cancels event
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    inputs[1].dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);

    // Test save blocking: meSaveExam alerts and refuses to save
    const saveBtn = screen.getByRole('button', { name: /محفوظ کریں/i });
    fireEvent.click(saveBtn);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('محفوظ نہیں کیا جا سکتا'));
    expect(mockSaveMonthlyEvaluation).not.toHaveBeenCalled();

    // Test report blocking: clicking "منزل کی رپورٹ" alerts and refuses to open modal with invalid data
    const manzilBtn = screen.getByRole('button', { name: 'منزل کی رپورٹ' });
    fireEvent.click(manzilBtn);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('رپورٹ نہیں بن سکتی'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Correct the marks (61 -> 55, 13 -> 10)
    fireEvent.change(inputs[1], { target: { value: '55' } });
    fireEvent.change(inputs[2], { target: { value: '10' } });

    // Verify corrected total (10 + 55 + 10 + 10 + 10 = 95)
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(inputs[1]).not.toHaveClass('me-invalid');
    expect(inputs[2]).not.toHaveClass('me-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Now report opens properly
    fireEvent.click(manzilBtn);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
