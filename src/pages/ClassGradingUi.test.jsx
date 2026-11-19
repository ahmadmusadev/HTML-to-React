import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Exams from './Exams';
import * as MadrasaContextModule from '../context/MadrasaContext';

const MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const CLASS_ID = 'class-uuid-1';

const SAMPLE_CLASSES = [
  { id: CLASS_ID, name: 'کلاس اول', class_name: 'کلاس اول' }
];

const SAMPLE_STUDENTS = [
  { id: 's1', admRegNo: '101', name: 'طالب علم ۱', admClass: CLASS_ID, isAdmissionProfile: true },
  { id: 's2', admRegNo: '102', name: 'طالب علم ۲', admClass: CLASS_ID, isAdmissionProfile: true },
  { id: 's3', admRegNo: '103', name: 'طالب علم ۳', admClass: CLASS_ID, isAdmissionProfile: true },
  { id: 's4', admRegNo: '104', name: 'طالب علم ۴', admClass: CLASS_ID, isAdmissionProfile: true }
];

describe('Class Grading Integration in Exams and Entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      loadMadrasaData: vi.fn().mockReturnValue({}),
      saveMadrasaData: vi.fn(),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue([...SAMPLE_CLASSES]),
      fetchExamMiqdarFromSupabase: vi.fn().mockResolvedValue([]),
      upsertExamMiqdarToSupabase: vi.fn().mockResolvedValue([]),
      upsertExamMiqdarSingle: vi.fn().mockResolvedValue({}),
      fetchExamResultsFromSupabase: vi.fn().mockResolvedValue([
        // 4 students:
        // 3 students at 85% (اعلیٰ: 75%)
        // 1 student at 50% (کمزور: 25%)
        // Should evaluate to اعلیٰ B (since aPct >= 65% and wPct <= 20%)
        // Wait, 1/4 = 25% which is wPct <= 25% and aPct = 75% -> wait, wPct is 25%, so wPct <= 20% is false, thus it evaluates to اوسط!
        { id: 'r1', student_id: 's1', class_id: CLASS_ID, term: 'first', year: 2025, target_ruku: 20, achieved_ruku: 18, pct: 90, students: { name: 'طالب علم ۱', roll_number: '101' } },
        { id: 'r2', student_id: 's2', class_id: CLASS_ID, term: 'first', year: 2025, target_ruku: 20, achieved_ruku: 17, pct: 85, students: { name: 'طالب علم ۲', roll_number: '102' } },
        { id: 'r3', student_id: 's3', class_id: CLASS_ID, term: 'first', year: 2025, target_ruku: 20, achieved_ruku: 16, pct: 80, students: { name: 'طالب علم ۳', roll_number: '103' } },
        { id: 'r4', student_id: 's4', class_id: CLASS_ID, term: 'first', year: 2025, target_ruku: 20, achieved_ruku: 10, pct: 50, students: { name: 'طالب علم ۴', roll_number: '104' } }
      ]),
      upsertExamResultsToSupabase: vi.fn().mockResolvedValue([]),
      classesList: [...SAMPLE_CLASSES],
      setClassesList: vi.fn()
    });
  });

  it('renders class grade and tier breakdown in Exams class-result sub-tab', async () => {
    render(<Exams />);

    // Click on "کلاس کا رزلٹ" tab
    const classResultTabBtn = screen.getByRole('button', { name: 'کلاس کا رزلٹ' });
    fireEvent.click(classResultTabBtn);

    // Select class
    const classSelect = document.getElementById('crExamClass');
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });

    // Click "رزلٹ دیکھیں"
    const viewBtn = screen.getByRole('button', { name: 'رزلٹ دیکھیں' });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      // Check that class grade badge is rendered
      expect(screen.getByText(/درجہ کلاس:/i)).toBeInTheDocument();
      // Check breakdown chips
      expect(screen.getByText(/اعلیٰ:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/اوسط:/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/کمزور:/i)).toBeInTheDocument();
      // Check Urdu grade in student table: 90% is ممتاز, 85% is جید جدا, 50% is فیل
      expect(screen.getByText('ممتاز')).toBeInTheDocument();
      expect(screen.getAllByText('جید جدا').length).toBe(2);
      expect(screen.getByText('فیل')).toBeInTheDocument();
    });
  });

  it('renders class grade and breakdown in Entry class report and institute result', async () => {
    const { default: Entry } = await import('./Entry');

    const mockExams = [
      {
        id: 'eval-1',
        classId: CLASS_ID,
        className: 'کلاس اول',
        month: 'اپریل',
        year: '2026',
        students: [
          { regNo: '101', name: 'طالب علم ۱', pct: 92, grade: 'ممتاز' },
          { regNo: '102', name: 'طالب علم ۲', pct: 85, grade: 'جید جدا' },
          { regNo: '103', name: 'طالب علم ۳', pct: 82, grade: 'جید جدا' },
          { regNo: '104', name: 'طالب علم ۴', pct: 45, grade: 'فیل' }
        ]
      }
    ];

    vi.spyOn(MadrasaContextModule, 'useMadrasa').mockReturnValue({
      activeMadrasaId: MADRASA_ID,
      loadMadrasaData: vi.fn((key) => {
        if (key === 'hf_monthly_exams_v1') return mockExams;
        return {};
      }),
      saveMadrasaData: vi.fn(),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue([...SAMPLE_STUDENTS]),
      fetchClassesFromSupabase: vi.fn().mockResolvedValue([...SAMPLE_CLASSES]),
      fetchMonthlyEvaluationsFromSupabase: vi.fn().mockResolvedValue(mockExams),
      saveMonthlyEvaluationToSupabase: vi.fn().mockResolvedValue({}),
      deleteMonthlyEvaluationFromSupabase: vi.fn().mockResolvedValue(true),
      classesList: [...SAMPLE_CLASSES],
      setClassesList: vi.fn()
    });

    render(<Entry />);

    // Click on "کلاس کی انفرادی رپورٹ" tab
    const classReportTabBtn = screen.getByRole('button', { name: 'کلاس کی انفرادی رپورٹ' });
    fireEvent.click(classReportTabBtn);

    // Select class in class report
    const comboboxes = screen.getAllByRole('combobox');
    const classSelect = comboboxes[0];
    fireEvent.change(classSelect, { target: { value: CLASS_ID } });

    // Click "رپورٹ دیکھیں"
    const viewBtn = screen.getByRole('button', { name: 'رپورٹ دیکھیں' });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/درجہ کلاس:/i)).toBeInTheDocument();
      expect(screen.getByText(/اعلیٰ:/i)).toBeInTheDocument();
      expect(screen.getByText(/کمزور:/i)).toBeInTheDocument();
    });

    // Click on "نتیجہ ماہانہ جائزہ — پورا ادارہ" tab
    const instituteResultTabBtn = screen.getByRole('button', { name: /نتیجہ ماہانہ جائزہ — پورا ادارہ/i });
    fireEvent.click(instituteResultTabBtn);

    // Click "خلاصہ دیکھیں"
    const instViewBtn = screen.getByRole('button', { name: 'خلاصہ دیکھیں' });
    fireEvent.click(instViewBtn);

    await waitFor(() => {
      // In the table, the grade header and class grade badge should be rendered
      expect(screen.getByText('ادارے کا مجموعی درجہ')).toBeInTheDocument();
      expect(screen.getByText('کلاسوں کی بنیاد پر پورے ادارے کی درجہ بندی کا خلاصہ:')).toBeInTheDocument();
      expect(screen.getByText('کلاس وار نتیجہ و تجزیہ')).toBeInTheDocument();
      expect(screen.getByText('کلاس اول')).toBeInTheDocument();
    });
  });
});
