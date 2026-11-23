import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import DailyAcademicPerformance from './DailyAcademicPerformance';
import * as MadrasaContext from '../context/MadrasaContext';
import * as OcrModule from '../utils/dailyPerformanceSheetOcr';

vi.mock('../utils/dailyPerformanceSheetOcr', () => ({
  fileToBase64: vi.fn().mockResolvedValue({ base64: 'fake-base64-data', mimeType: 'image/jpeg' }),
  parseDailyPerformanceSheet: vi.fn().mockResolvedValue({
    success: true,
    totalParsed: 1,
    matchedCount: 1,
    mappedRecords: {
      'std-1': {
        sabaq: true,
        sabqi: true,
        manzil: true,
        manzil_para: '5',
        manzil_amount: 'آدھا پارہ',
        sami_name: 'قاری بلال',
        kaifiyat_checked: true,
        kaifiyat_text: 'بہترین',
        mutalaah: true
      }
    }
  })
}));

describe('DailyAcademicPerformance (روزانہ تعلیمی کارکردگی فارم)', () => {
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

  const mockSaveDaily = vi.fn().mockImplementation((payload) => Promise.resolve(payload));
  const mockFetchDaily = vi.fn().mockResolvedValue([]);

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-sheet.jpg');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(MadrasaContext, 'useMadrasa').mockReturnValue({
      activeMadrasaId: '00000000-0000-0000-0000-000000000001',
      activeMadrasa: { name: 'جامعہ دار العلوم' },
      classesList: mockClasses,
      fetchClassesFromSupabase: vi.fn().mockResolvedValue(mockClasses),
      fetchStudentsFromSupabase: vi.fn().mockResolvedValue(mockStudents),
      fetchDailyAcademicRecordsFromSupabase: mockFetchDaily,
      saveDailyAcademicRecordsToSupabase: mockSaveDaily
    });
  });

  it('renders all required columns in the table', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getAllByText(/روزانہ تعلیمی کارکردگی/i)[0]).toBeInTheDocument();
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    // Check all requested table header columns
    expect(screen.getByText('نمبر شمار')).toBeInTheDocument();
    expect(screen.getByText('نام مع ولدیت')).toBeInTheDocument();
    expect(screen.getByText('سبق')).toBeInTheDocument();
    expect(screen.getByText('سبقی')).toBeInTheDocument();
    expect(screen.getByText('منزل (پارہ و مقدار)')).toBeInTheDocument();
    expect(screen.getByText('سامع')).toBeInTheDocument();
    expect(screen.getByText('کیفیت')).toBeInTheDocument();
    expect(screen.getByText('مطالعہ')).toBeInTheDocument();
  });

  it('renders teacher signature section in footer', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText(/دستخط استادِ محترم/)).toBeInTheDocument();
      expect(screen.getByText(/دستخط ناظم تعلیمات \/ مہتمم/)).toBeInTheDocument();
    });
  });

  it('reveals Para and amount inputs when Manzil is checked', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    // Initially para input is not visible
    expect(screen.queryByPlaceholderText(/کتنا سنایا؟/)).not.toBeInTheDocument();

    // Check the Manzil checkbox
    const manzilCheckbox = screen.getAllByRole('checkbox')[2]; // 3rd checkbox for first student
    fireEvent.click(manzilCheckbox);

    // Now Para and amount should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/کتنا سنایا؟/)).toBeInTheDocument();
      expect(screen.getByTitle('پارہ نمبر منتخب کریں')).toBeInTheDocument();
    });
  });

  it('allows filling Kaifiyat via preset buttons', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    const behtareenPills = screen.getAllByText('بہترین');
    fireEvent.click(behtareenPills[0]);

    const kaifiyatInput = screen.getAllByPlaceholderText(/کیفیت \(3 تا 4 الفاظ\)/)[0];
    expect(kaifiyatInput.value).toBe('بہترین');
  });

  it('bulk marks Sabaq for all students', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    const bulkSabaqBtn = screen.getByText('سبق (سب پاس)');
    fireEvent.click(bulkSabaqBtn);

    // Verify stats footer updates
    await waitFor(() => {
      expect(screen.getByText('سبق سنانے والے')).toBeInTheDocument();
    });
  });

  it('saves the academic records when save button is clicked', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    const saveBtn = screen.getByText('ریکارڈ محفوظ کریں');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSaveDaily).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/روزانہ تعلیمی کارکردگی کا ریکارڈ کامیابی سے محفوظ ہو گیا ہے/)).toBeInTheDocument();
    });
  });

  it('renders AI sheet upload button and opens modal', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    const uploadBtn = screen.getByText('پُر شدہ شیٹ اپلوڈ کریں (AI Scan)');
    expect(uploadBtn).toBeInTheDocument();

    fireEvent.click(uploadBtn);

    // Modal opens
    expect(screen.getByText(/پُر شدہ شیٹ کا خودکار اسکین و اندراج/)).toBeInTheDocument();
    expect(screen.getByText(/تصویر یہاں ڈریگ کریں یا فائل منتخب کرنے کے لیے کلک کریں/)).toBeInTheDocument();

    // Close button works
    const closeBtn = screen.getByText('بند کریں');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/تصویر یہاں ڈریگ کریں یا فائل منتخب کرنے کے لیے کلک کریں/)).not.toBeInTheDocument();
    });
  });

  it('scans the sheet image and updates student performance records', async () => {
    render(<DailyAcademicPerformance />);

    await waitFor(() => {
      expect(screen.getByText('محمد عمر ولد عبد الرشید')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('پُر شدہ شیٹ اپلوڈ کریں (AI Scan)'));

    // Upload a fake image file
    const file = new File(['fake-content'], 'sheet_page1.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Image preview and start scan button become active
    await waitFor(() => {
      expect(screen.getByText('sheet_page1.jpg')).toBeInTheDocument();
    });

    const scanSubmitBtn = screen.getByText('تجزیہ و خودکار اندراج شروع کریں');
    fireEvent.click(scanSubmitBtn);

    // Verification
    await waitFor(() => {
      expect(OcrModule.parseDailyPerformanceSheet).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/کامیابی سے شیٹ اسکین ہو گئی اور 1 طلبہ کا ڈیٹا درج ہو گیا۔/)).toBeInTheDocument();
    });

    // Check that Manzil para, amount, and Sami name were populated in the row for std-1
    await waitFor(() => {
      const samiInput = screen.getAllByPlaceholderText(/سامع کا نام.../)[0];
      expect(samiInput.value).toBe('قاری بلال');
    });
  });
});
