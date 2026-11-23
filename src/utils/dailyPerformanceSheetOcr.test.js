import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeUrduText, parseDailyPerformanceSheet, fileToBase64 } from './dailyPerformanceSheetOcr';

describe('dailyPerformanceSheetOcr utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes Urdu text properly (removing tashkeel and standardizing letters)', () => {
    const raw = 'مُحَمَّد عُمَر يوسف';
    const normalized = normalizeUrduText(raw);
    expect(normalized).toBe('محمد عمر یوسف');
  });

  it('throws error when no API key is available', async () => {
    await expect(
      parseDailyPerformanceSheet({
        base64Data: 'dummy-base64',
        mimeType: 'image/jpeg',
        students: [],
        apiKey: null
      })
    ).rejects.toThrow(/گوگل جیمنائی API Key درکار ہے/);
  });

  it('throws error when no base64 image data is provided', async () => {
    await expect(
      parseDailyPerformanceSheet({
        base64Data: '',
        mimeType: 'image/jpeg',
        students: [],
        apiKey: 'fake-api-key'
      })
    ).rejects.toThrow(/تصویر کا ڈیٹا دستیاب نہیں ہے/);
  });

  it('parses Gemini structured response and maps back to student IDs', async () => {
    const mockStudents = [
      { id: 'uuid-1', roll_number: '101', name: 'محمد عمر', father_name: 'عبد الرشید' },
      { id: 'uuid-2', roll_number: '102', name: 'علی احمد', father_name: 'محمد عثمان' }
    ];

    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify([
                  {
                    roll_number: '101',
                    student_name: 'محمد عمر',
                    sabaq: true,
                    sabqi: true,
                    manzil: true,
                    manzil_para: 3,
                    manzil_amount: '1 پاؤ',
                    sami_name: 'قاری بلال',
                    kaifiyat_checked: true,
                    kaifiyat_text: 'بہترین',
                    mutalaah: true
                  },
                  {
                    roll_number: '102',
                    student_name: 'علی احمد',
                    sabaq: false,
                    sabqi: true,
                    manzil: false,
                    manzil_para: null,
                    manzil_amount: '',
                    sami_name: '',
                    kaifiyat_checked: false,
                    kaifiyat_text: '',
                    mutalaah: true
                  }
                ])
              }
            ]
          }
        }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });

    const res = await parseDailyPerformanceSheet({
      base64Data: 'valid-base64-string',
      mimeType: 'image/jpeg',
      students: mockStudents,
      apiKey: 'test-api-key'
    });

    expect(res.success).toBe(true);
    expect(res.matchedCount).toBe(2);
    expect(res.mappedRecords['uuid-1']).toBeDefined();
    expect(res.mappedRecords['uuid-1'].sabaq).toBe(true);
    expect(res.mappedRecords['uuid-1'].manzil_para).toBe('3');
    expect(res.mappedRecords['uuid-1'].sami_name).toBe('قاری بلال');

    expect(res.mappedRecords['uuid-2']).toBeDefined();
    expect(res.mappedRecords['uuid-2'].sabaq).toBe(false);
    expect(res.mappedRecords['uuid-2'].sabqi).toBe(true);
  });
});
