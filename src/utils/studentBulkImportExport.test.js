import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  autoDetectColumnMapping,
  calculateNextSequentialRollNumber,
  normalizeDateOfBirth,
  sanitizePhoneNumber,
  buildBatchStudentPayloads,
  parseExcelFile,
  parseWordFile,
  shouldReverseToRtl,
  reverseTableColumns,
  analyzeDuplicateStudents
} from './studentBulkImportExport';

describe('studentBulkImportExport Utility', () => {
  describe('autoDetectColumnMapping', () => {
    it('accurately detects standard Urdu column headers', () => {
      const headers = [
        'نمبر شمار',
        'طالب علم کا نام',
        'والد کا نام',
        'انگریزی نام',
        'جنس',
        'تاریخ پیدائش',
        'ب فارم',
        'موبائل نمبر',
        'والد کا شناختی کارڈ',
        'مکمل پتہ'
      ];
      const mapping = autoDetectColumnMapping(headers);
      expect(mapping.name).toBe(1);
      expect(mapping.father_name).toBe(2);
      expect(mapping.name_english).toBe(3);
      expect(mapping.gender).toBe(4);
      expect(mapping.date_of_birth).toBe(5);
      expect(mapping.b_form_number).toBe(6);
      expect(mapping.father_mobile).toBe(7);
      expect(mapping.father_cnic).toBe(8);
      expect(mapping.address).toBe(9);
    });

    it('accurately detects English column headers', () => {
      const headers = [
        'Roll No',
        'Student Name',
        'Father Name',
        'DOB',
        'Gender',
        'Mobile',
        'CNIC',
        'Address'
      ];
      const mapping = autoDetectColumnMapping(headers);
      expect(mapping.name).toBe(1);
      expect(mapping.father_name).toBe(2);
      expect(mapping.date_of_birth).toBe(3);
      expect(mapping.gender).toBe(4);
      expect(mapping.father_mobile).toBe(5);
      expect(mapping.address).toBe(7);
    });

    it('sets unmapped fields to -1', () => {
      const headers = ['نام', 'فون نمبر'];
      const mapping = autoDetectColumnMapping(headers);
      expect(mapping.name).toBe(0);
      expect(mapping.father_mobile).toBe(1);
      expect(mapping.father_name).toBe(-1);
      expect(mapping.b_form_number).toBe(-1);
    });
  });

  describe('calculateNextSequentialRollNumber', () => {
    it('returns 1 when existing students array is empty', () => {
      expect(calculateNextSequentialRollNumber([])).toBe(1);
    });

    it('finds maximum numeric roll number and adds 1', () => {
      const students = [
        { roll_number: '01' },
        { roll_number: '05' },
        { roll_number: '12' },
        { roll_number: '08' }
      ];
      expect(calculateNextSequentialRollNumber(students)).toBe(13);
    });

    it('handles alternative keys like admRegNo or roll_no', () => {
      const students = [
        { admRegNo: '20' },
        { roll_no: '25' },
        { regNo: '14' }
      ];
      expect(calculateNextSequentialRollNumber(students)).toBe(26);
    });
  });

  describe('normalizeDateOfBirth and sanitizePhoneNumber', () => {
    it('normalizes various date formats to YYYY-MM-DD', () => {
      expect(normalizeDateOfBirth('2012-05-15')).toBe('2012-05-15');
      expect(normalizeDateOfBirth('15-05-2012')).toBe('2012-05-15');
      expect(normalizeDateOfBirth('15/05/2012')).toBe('2012-05-15');
      expect(normalizeDateOfBirth('invalid-date')).toBeNull();
      expect(normalizeDateOfBirth('')).toBeNull();
    });

    it('sanitizes mobile numbers', () => {
      expect(sanitizePhoneNumber('0300-1234567')).toBe('03001234567');
      expect(sanitizePhoneNumber('+92 (300) 1234567')).toBe('+923001234567');
      expect(sanitizePhoneNumber('')).toBeNull();
    });
  });

  describe('buildBatchStudentPayloads', () => {
    it('succeeds with minimal data (only student name) using safe defaults', () => {
      const rows = [
        ['زید احمد'],
        ['عمران علی']
      ];
      const mapping = {
        name: 0,
        father_name: -1,
        gender: -1,
        date_of_birth: -1,
        father_mobile: -1
      };

      const result = buildBatchStudentPayloads({
        rows,
        mapping,
        targetClassId: 'class-uuid-123',
        startRollNo: 5,
        madrasaId: 'madrasa-uuid-999'
      });

      expect(result.totalCount).toBe(2);
      expect(result.startRollNo).toBe(5);
      expect(result.endRollNo).toBe(6);

      const p1 = result.payloads[0];
      expect(p1.name).toBe('زید احمد');
      expect(p1.roll_number).toBe('05');
      expect(p1.class_id).toBe('class-uuid-123');
      expect(p1.madrasa_id).toBe('madrasa-uuid-999');
      expect(p1.gender).toBe('لڑکا'); // Default gender
      expect(p1.status).toBe('active');
      expect(p1.father_name).toBe('');

      const p2 = result.payloads[1];
      expect(p2.name).toBe('عمران علی');
      expect(p2.roll_number).toBe('06');
    });

    it('skips rows with empty names', () => {
      const rows = [
        [''],
        ['طالب علم 1'],
        ['   ']
      ];
      const mapping = { name: 0 };
      const result = buildBatchStudentPayloads({
        rows,
        mapping,
        startRollNo: 1
      });
      expect(result.totalCount).toBe(1);
      expect(result.payloads[0].name).toBe('طالب علم 1');
      expect(result.payloads[0].roll_number).toBe('01');
    });

    it('correctly normalizes English names and uppercase', () => {
      const rows = [
        ['حامد', 'hamid ali', 'ali muhammad']
      ];
      const mapping = {
        name: 0,
        name_english: 1,
        father_name_english: 2
      };
      const result = buildBatchStudentPayloads({
        rows,
        mapping,
        startRollNo: 10
      });
      expect(result.payloads[0].name_english).toBe('HAMID ALI');
      expect(result.payloads[0].father_name_english).toBe('ALI MUHAMMAD');
    });
  });

  describe('parseExcelFile', () => {
    it('parses in-memory excel binary cleanly', async () => {
      const data = [
        ['نام', 'ولدیت', 'فون'],
        ['احمد', 'بلال', '03001234567'],
        ['کاشف', 'سلیم', '03217654321']
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const parsed = await parseExcelFile(u8);
      expect(parsed.headers).toEqual(['نام', 'ولدیت', 'فون']);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0]).toEqual(['احمد', 'بلال', '03001234567']);
      expect(parsed.rows[1]).toEqual(['کاشف', 'سلیم', '03217654321']);
    });
  });

  describe('parseWordFile', () => {
    it('throws descriptive error if document does not contain a table', async () => {
      const doc = new (await import('docx')).Document({
        sections: [
          {
            children: [
              new (await import('docx')).Paragraph({ text: 'صرف عام پیراگراف بغیر ٹیبل' })
            ]
          }
        ]
      });
      const buffer = await (await import('docx')).Packer.toBuffer(doc);
      await expect(parseWordFile(buffer)).rejects.toThrow('ورڈ فائل میں کوئی ٹیبل نہیں ملا');
    });

    it('parses docx table into headers and rows cleanly', async () => {
      const docx = await import('docx');
      const doc = new docx.Document({
        sections: [
          {
            children: [
              new docx.Table({
                rows: [
                  new docx.TableRow({
                    children: [
                      new docx.TableCell({ children: [new docx.Paragraph({ text: 'طالب علم کا نام' })] }),
                      new docx.TableCell({ children: [new docx.Paragraph({ text: 'والد کا نام' })] })
                    ]
                  }),
                  new docx.TableRow({
                    children: [
                      new docx.TableCell({ children: [new docx.Paragraph({ text: 'عثمان غنی' })] }),
                      new docx.TableCell({ children: [new docx.Paragraph({ text: 'عفان' })] })
                    ]
                  })
                ]
              })
            ]
          }
        ]
      });
      const buffer = await docx.Packer.toBuffer(doc);
      const parsed = await parseWordFile(buffer);
      expect(parsed.headers).toEqual(['طالب علم کا نام', 'والد کا نام']);
      expect(parsed.rows.length).toBe(1);
      expect(parsed.rows[0]).toEqual(['عثمان غنی', 'عفان']);
    });
  });

  describe('RTL Urdu Table Detection and Reversal', () => {
    it('detects RTL orientation when roll or serial number is on the left-most or right-most edge', () => {
      // LTR extracted table from Urdu document where right column was Roll No
      const ltrExtractedHeaders = ['تاریخ وصولی', 'فیس', 'کلاس', 'ولدیت', 'نام طالب علم', 'نمبر شمار', 'رول'];
      expect(shouldReverseToRtl(ltrExtractedHeaders)).toBe(true);

      // Already correct LTR or standard Urdu RTL parsed with start on index 0
      const standardHeaders = ['رول', 'نمبر شمار', 'نام طالب علم', 'ولدیت', 'کلاس', 'فیس', 'تاریخ وصولی'];
      expect(shouldReverseToRtl(standardHeaders)).toBe(false);
    });

    it('reverses table headers and row cells properly', () => {
      const headers = ['تاریخ وصولی', 'فیس', 'کلاس', 'ولدیت', 'نام طالب علم', 'نمبر شمار', 'رول'];
      const rows = [
        ['', '', 'حافظ تنویر احمد صاحب', 'محمد عامر', 'محمد طلحہ', '1', '178'],
        ['', '', 'حافظ تنویر احمد صاحب', 'محمد ارشاد', 'محمد اویس', '2', '179']
      ];

      const reversed = reverseTableColumns({ headers, rows });
      expect(reversed.headers).toEqual(['رول', 'نمبر شمار', 'نام طالب علم', 'ولدیت', 'کلاس', 'فیس', 'تاریخ وصولی']);
      expect(reversed.rows[0]).toEqual(['178', '1', 'محمد طلحہ', 'محمد عامر', 'حافظ تنویر احمد صاحب', '', '']);
      expect(reversed.rows[1]).toEqual(['179', '2', 'محمد اویس', 'محمد ارشاد', 'حافظ تنویر احمد صاحب', '', '']);
    });

    it('automatically reverses Excel table when visual Urdu RTL is detected', async () => {
      const ltrExtractedData = [
        ['تاریخ وصولی', 'فیس', 'کلاس', 'ولدیت', 'نام طالب علم', 'نمبر شمار', 'رول'],
        ['', '', 'کلاس 1', 'محمد عامر', 'محمد طلحہ', '1', '178']
      ];
      const ws = XLSX.utils.aoa_to_sheet(ltrExtractedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'UrduSheet');
      const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const parsed = await parseExcelFile(u8);
      expect(parsed.isRtlReversed).toBe(true);
      expect(parsed.headers[0]).toBe('رول');
      expect(parsed.headers[2]).toBe('نام طالب علم');
      expect(parsed.rows[0][0]).toBe('178');
      expect(parsed.rows[0][2]).toBe('محمد طلحہ');
    });
  });

  describe('analyzeDuplicateStudents', () => {
    it('identifies in-file duplicates and existing system duplicates', () => {
      const payloads = [
        { name: 'محمد طلحہ', father_name: 'محمد عامر', b_form_number: '1234567890123' },
        { name: 'محمد اویس', father_name: 'محمد ارشاد', b_form_number: '9876543210987' },
        { name: 'محمد طلحہ', father_name: 'محمد عامر', b_form_number: '1234567890123' }, // duplicate in file
        { name: 'احمد علی', father_name: 'اصغر علی', b_form_number: '' } // duplicate in existing database
      ];

      const existingStudents = [
        { name: 'احمد علی', father_name: 'اصغر علی', roll_number: '42' }
      ];

      const analysis = analyzeDuplicateStudents({ payloads, existingStudents });
      expect(analysis.hasDuplicates).toBe(true);
      expect(analysis.fileDuplicates.length).toBe(1);
      expect(analysis.fileDuplicates[0].name).toBe('محمد طلحہ');
      expect(analysis.systemDuplicates.length).toBe(1);
      expect(analysis.systemDuplicates[0].name).toBe('احمد علی');
      expect(analysis.cleanPayloads.length).toBe(3);
    });
  });
});
