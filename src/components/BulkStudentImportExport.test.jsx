import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BulkStudentImportExport from './BulkStudentImportExport';
import * as bulkUtils from '../utils/studentBulkImportExport';

describe('BulkStudentImportExport Component', () => {
  const mockClasses = [
    { id: 'c1', class_name: 'حفظ کلاس' },
    { id: 'c2', class_name: 'ناظرہ کلاس' }
  ];

  const mockRecords = [
    { id: 's1', roll_number: '01', name: 'محمد زید', class_id: 'c1', status: 'active', isWithdrawn: false },
    { id: 's2', roll_number: '02', name: 'عمران خان', class_id: 'c1', status: 'active', isWithdrawn: false },
    { id: 's3', roll_number: '03', name: 'بلال احمد', class_id: 'c2', status: 'active', isWithdrawn: false }
  ];

  const mockMadrasa = { id: 'm1', name: 'جامعہ دارالعلوم' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders import and export mode tabs properly', () => {
    render(
      <BulkStudentImportExport
        classesList={mockClasses}
        records={mockRecords}
        activeMadrasa={mockMadrasa}
      />
    );

    expect(screen.getByText('طلباء امپورٹ کریں (فائل اپلوڈ)')).toBeInTheDocument();
    expect(screen.getByText('طلباء ایکسپورٹ کریں (لسٹ ڈاؤن لوڈ)')).toBeInTheDocument();
  });

  it('switches to export mode and renders all 3 format options', () => {
    render(
      <BulkStudentImportExport
        classesList={mockClasses}
        records={mockRecords}
        activeMadrasa={mockMadrasa}
      />
    );

    fireEvent.click(screen.getByText('طلباء ایکسپورٹ کریں (لسٹ ڈاؤن لوڈ)'));

    expect(screen.getByText('طلباء کی لسٹ ایکسپورٹ کریں (Export Students List)')).toBeInTheDocument();
    expect(screen.getByText(/ایکسل فائل/)).toBeInTheDocument();
    expect(screen.getByText(/ورڈ دستاویز/)).toBeInTheDocument();
    expect(screen.getByText(/پرنٹ \/ پی ڈی ایف/)).toBeInTheDocument();
    expect(screen.getByText('ایکسل میں ڈاؤن لوڈ کریں')).toBeInTheDocument();
  });

  it('triggers excel export on clicking export button', async () => {
    const exportExcelSpy = vi.spyOn(bulkUtils, 'exportStudentsToExcel').mockImplementation(() => {});

    render(
      <BulkStudentImportExport
        classesList={mockClasses}
        records={mockRecords}
        activeMadrasa={mockMadrasa}
      />
    );

    fireEvent.click(screen.getByText('طلباء ایکسپورٹ کریں (لسٹ ڈاؤن لوڈ)'));
    fireEvent.click(screen.getByText('ایکسل میں ڈاؤن لوڈ کریں'));

    expect(exportExcelSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText(/ایکسل فائل برائے تمام کلاسز \(ماسٹر لسٹ\) کامیابی سے ڈاؤن لوڈ ہو گئی ہے/)).toBeInTheDocument();
    });
  });

  it('shows error in import mode when trying to proceed without selecting a file', async () => {
    render(
      <BulkStudentImportExport
        classesList={mockClasses}
        records={mockRecords}
        activeMadrasa={mockMadrasa}
      />
    );

    // Click next without file
    const nextBtn = screen.getByText(/اگلا مرحلہ: فائل پڑھیں اور میپنگ کریں/);
    expect(nextBtn).toBeDisabled();
  });

  it('renders sample template download buttons in import mode', () => {
    const sampleExcelSpy = vi.spyOn(bulkUtils, 'downloadSampleExcelTemplate').mockImplementation(() => {});
    const sampleWordSpy = vi.spyOn(bulkUtils, 'downloadSampleWordTemplate').mockImplementation(() => {});

    render(
      <BulkStudentImportExport
        classesList={mockClasses}
        records={mockRecords}
        activeMadrasa={mockMadrasa}
      />
    );

    const excelSampleBtn = screen.getByText('نمونہ ایکسل ٹیمپلیٹ ڈاؤن لوڈ کریں');
    const wordSampleBtn = screen.getByText('نمونہ ورڈ ٹیمپلیٹ ڈاؤن لوڈ کریں');

    fireEvent.click(excelSampleBtn);
    expect(sampleExcelSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(wordSampleBtn);
    expect(sampleWordSpy).toHaveBeenCalledTimes(1);
  });

  it('progresses through file parsing, column mapping, and displays sequential registration number confirmation modal', async () => {
    const mockFile = new File(['dummy content'], 'students.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    vi.spyOn(bulkUtils, 'parseImportFile').mockResolvedValue({
      headers: ['طالب علم کا نام', 'والد کا نام', 'موبائل'],
      rows: [
        ['حمزہ فاروق', 'فاروق اعظم', '03001234567'],
        ['زہیر احمد', 'احمد دین', '03217654321']
      ],
      totalRows: 2
    });

    const addBulkStudentsMock = vi.fn().mockResolvedValue([
      {
        id: 'new-1',
        roll_number: '04',
        name: 'حمزہ فاروق',
        father_name: 'فاروق اعظم',
        father_mobile: '03001234567',
        class_id: 'c1',
        status: 'active'
      },
      {
        id: 'new-2',
        roll_number: '05',
        name: 'زہیر احمد',
        father_name: 'احمد دین',
        father_mobile: '03217654321',
        class_id: 'c1',
        status: 'active'
      }
    ]);

    const onStudentsAddedMock = vi.fn();

    render(
      <BulkStudentImportExport
        classesList={mockClasses}
        records={mockRecords} // has max roll 3, so next starts at 4
        activeMadrasa={mockMadrasa}
        activeMadrasaId="m1"
        preSelectedClassId="c1"
        addBulkStudentsToSupabase={addBulkStudentsMock}
        onStudentsAdded={onStudentsAddedMock}
      />
    );

    // Upload file
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Process file
    const processBtn = screen.getByText(/اگلا مرحلہ: فائل پڑھیں اور میپنگ کریں/);
    fireEvent.click(processBtn);

    // Step 2: Mapping Screen
    await waitFor(() => {
      expect(screen.getByText('مرحلہ 2: کالمز کی جانچ اور میپنگ کی تصدیق')).toBeInTheDocument();
      expect(screen.getByText('حمزہ فاروق')).toBeInTheDocument();
    });

    // Proceed to Step 3: Confirmation modal
    const confirmStepBtn = screen.getByText(/اگلا مرحلہ: رجسٹریشن نمبر کی تصدیق/);
    fireEvent.click(confirmStepBtn);

    // Verify Step 3: Registration number sequence calculation
    await waitFor(() => {
      expect(screen.getByText('تصدیق برائے بلک داخلہ (Sequential Roll Number Confirmation)')).toBeInTheDocument();
      // Next sequence should start at 04 and end at 05
      expect(screen.getByText(/اگلا رجسٹریشن نمبر/)).toBeInTheDocument();
      expect(screen.getByText('04')).toBeInTheDocument();
      expect(screen.getByText('05')).toBeInTheDocument();
    });

    // Execute batch save
    const executeBtn = screen.getByText('تصدیق کریں اور ڈیٹا محفوظ کریں');
    fireEvent.click(executeBtn);

    // Step 4: Verify batch addition and success message
    await waitFor(() => {
      expect(addBulkStudentsMock).toHaveBeenCalledTimes(1);
      expect(onStudentsAddedMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('مبارک ہو! تمام طلباء کامیابی سے شامل کر دیے گئے ہیں۔')).toBeInTheDocument();
      expect(screen.getByText(/تفویض کردہ رجسٹریشن نمبرز:/)).toBeInTheDocument();
    });
  });
});
