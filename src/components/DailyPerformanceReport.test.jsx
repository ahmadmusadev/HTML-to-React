import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import DailyPerformanceReport, {
  parseManzilAmountToJuz,
  formatTotalManzilJuz,
  computeDateRange,
  formatDateUrdu
} from './DailyPerformanceReport';
import * as MadrasaContext from '../context/MadrasaContext';
import * as XLSX from 'xlsx';

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn().mockReturnValue({}),
    aoa_to_sheet: vi.fn().mockReturnValue({}),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}));

describe('DailyPerformanceReport (میعادی تعلیمی رپورٹ)', () => {
  const mockStudents = [
    {
      id: 'std-1',
      roll_number: '101',
      admRegNo: '101',
      name: 'محمد عمر',
      father_name: 'عبد الرشید',
      admClass: 'cls-1',
      class_id: 'cls-1',
      admStatus: 'enrolled'
    },
    {
      id: 'std-2',
      roll_number: '102',
      admRegNo: '102',
      name: 'علی احمد',
      father_name: 'محمد عثمان',
      admClass: 'cls-1',
      class_id: 'cls-1',
      admStatus: 'enrolled'
    }
  ];

  const mockClasses = [
    { id: 'cls-1', name: 'حفظ سال اول', teacher: 'مولانا عبد الرحمن' }
  ];

  const mockDailyRecords = [
    {
      id: 'rec-1',
      student_id: 'std-1',
      class_id: 'cls-1',
      date: '2026-11-20',
      sabaq: true,
      sabqi: true,
      manzil: true,
      manzil_para: 5,
      manzil_amount: 'آدھا پارہ',
      sami_name: 'قاری بلال',
      kaifiyat_text: 'بہترین',
      mutalaah: true
    },
    {
      id: 'rec-2',
      student_id: 'std-1',
      class_id: 'cls-1',
      date: '2026-11-21',
      sabaq: true,
      sabqi: false,
      manzil: true,
      manzil_para: 5,
      manzil_amount: '1 پاؤ',
      sami_name: 'قاری بلال',
      kaifiyat_text: 'مناسب',
      mutalaah: true
    },
    {
      id: 'rec-3',
      student_id: 'std-2',
      class_id: 'cls-1',
      date: '2026-11-20',
      sabaq: false,
      sabqi: true,
      manzil: false,
      manzil_para: null,
      manzil_amount: '',
      sami_name: '',
      kaifiyat_text: 'روانی کمزور',
      mutalaah: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(MadrasaContext, 'useMadrasa').mockReturnValue({
      activeMadrasaId: '00000000-0000-0000-0000-000000000001',
      activeMadrasa: { name: 'جامعہ دار العلوم' },
      classesList: mockClasses,
      fetchClassesFromSupabase: vi.fn().mockResolvedValue(mockClasses),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue(mockStudents),
      fetchDailyAcademicRecordsFromSupabase: vi.fn().mockResolvedValue(mockDailyRecords)
    });
  });

  describe('Calculation helpers', () => {
    it('parses various Urdu Manzil amount strings accurately', () => {
      expect(parseManzilAmountToJuz('1 پاؤ', 5)).toBe(0.25);
      expect(parseManzilAmountToJuz('آدھا پارہ', 5)).toBe(0.50);
      expect(parseManzilAmountToJuz('پونا پارہ', 5)).toBe(0.75);
      expect(parseManzilAmountToJuz('پورا پارہ', 5)).toBe(1.0);
      expect(parseManzilAmountToJuz('دو پارے', 5)).toBe(2.0);
      expect(parseManzilAmountToJuz('', 5)).toBe(1.0); // defaults to 1 when para number is given
      expect(parseManzilAmountToJuz('', null)).toBe(0);
    });

    it('formats total manzil juz nicely into Urdu text', () => {
      expect(formatTotalManzilJuz(0)).toBe('0 پارہ');
      expect(formatTotalManzilJuz(0.25)).toBe('1 پاؤ');
      expect(formatTotalManzilJuz(0.50)).toBe('آدھا پارہ');
      expect(formatTotalManzilJuz(0.75)).toBe('3 پاؤ');
      expect(formatTotalManzilJuz(1.0)).toBe('1 پارہ');
      expect(formatTotalManzilJuz(1.5)).toBe('1 پارہ اور آدھا پارہ');
      expect(formatTotalManzilJuz(3.25)).toBe('3 پارے اور 1 پاؤ');
      expect(formatTotalManzilJuz(4.0)).toBe('4 پارے');
    });

    it('computes correct date range for last 7 days and fortnights', () => {
      const range7 = computeDateRange('last_7_days');
      expect(range7.label).toContain('پچھلا 1 ہفتہ');
      expect(range7.startDate).toBeDefined();
      expect(range7.endDate).toBeDefined();

      const rangeFortnight1 = computeDateRange('first_fortnight');
      expect(rangeFortnight1.label).toContain('پندرہ روزہ اول');
      expect(rangeFortnight1.startDate.endsWith('-01')).toBe(true);
      expect(rangeFortnight1.endDate.endsWith('-15')).toBe(true);
    });

    it('formats date into Urdu day and month string', () => {
      const formatted = formatDateUrdu('2026-11-20');
      expect(formatted).toContain('نومبر');
      expect(formatted).toContain('2026');
    });
  });

  describe('UI Component Rendering and Functionality', () => {
    it('renders report controls, headers and class summary table', async () => {
      render(<DailyPerformanceReport />);

      await waitFor(() => {
        expect(screen.getByText('میعادی تعلیمی رپورٹ و کارکردگی جائزہ')).toBeInTheDocument();
        expect(screen.getByText('پوری کلاس کی مجموعی رپورٹ')).toBeInTheDocument();
        expect(screen.getByText('انفرادی طالب علم کا روزنامچہ')).toBeInTheDocument();
      });

      // Wait for records to load and Class Summary table headers to appear
      await waitFor(() => {
        expect(screen.getByText('نام مع ولدیت')).toBeInTheDocument();
        expect(screen.getByText('سبق کارکردگی')).toBeInTheDocument();
        expect(screen.getByText('سبقی کارکردگی')).toBeInTheDocument();
        expect(screen.getByText('منزل خلاصہ و کل پارے')).toBeInTheDocument();
        expect(screen.getByText('درجہ بندی')).toBeInTheDocument();
      });

      // Check student rows
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
      expect(screen.getByText('علی احمد ولد محمد عثمان')).toBeInTheDocument();

      // std-1 recited 0.5 + 0.25 = 0.75 juz
      expect(screen.getByText('3 پاؤ')).toBeInTheDocument();
    });

    it('switches to individual student mode and shows KPI cards and daily timeline', async () => {
      render(<DailyPerformanceReport />);

      await waitFor(() => {
        expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
      });

      // Click on Individual Student Report mode
      const individualModeBtn = screen.getByText('انفرادی طالب علم کا روزنامچہ');
      fireEvent.click(individualModeBtn);

      await waitFor(() => {
        expect(screen.getByText('طالب علم منتخب کریں')).toBeInTheDocument();
        expect(screen.getByText('کل دہرائے گئے پارے (منزل)')).toBeInTheDocument();
      });

      // Check individual student chronological rows
      expect(screen.getAllByText('سنایا').length).toBeGreaterThan(0);
      expect(screen.getAllByText('قاری بلال').length).toBeGreaterThan(0);
      expect(screen.getByText('دستخط سرپرست / والدین')).toBeInTheDocument();
    });

    it('exports report to Excel when Excel button is clicked', async () => {
      render(<DailyPerformanceReport />);

      await waitFor(() => {
        expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
      });

      const excelBtn = screen.getByText('ایکسل ڈاؤنلوڈ (.xlsx)');
      fireEvent.click(excelBtn);

      expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    });

    it('triggers print when print button is clicked', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      render(<DailyPerformanceReport />);

      await waitFor(() => {
        expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
      });

      const printBtn = screen.getByText('پرنٹ نکالیں (A4)');
      fireEvent.click(printBtn);

      expect(printSpy).toHaveBeenCalledTimes(1);
      printSpy.mockRestore();
    });
  });
});
