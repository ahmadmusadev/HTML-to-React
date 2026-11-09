import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle
} from 'docx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker if available
try {
  if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
} catch {
  // Gracefully fallback to main thread parsing if URL resolution fails
}

export const SYSTEM_FIELD_DEFS = [
  { key: 'name', label: 'طالب علم کا نام', required: true },
  { key: 'father_name', label: 'والد کا نام', required: false },
  { key: 'name_english', label: 'طالب علم کا نام (انگریزی)', required: false },
  { key: 'father_name_english', label: 'والد کا نام (انگریزی)', required: false },
  { key: 'gender', label: 'جنس', required: false },
  { key: 'date_of_birth', label: 'تاریخ پیدائش', required: false },
  { key: 'b_form_number', label: 'ب فارم / شناختی کارڈ', required: false },
  { key: 'father_mobile', label: 'موبائل نمبر / رابطہ', required: false },
  { key: 'father_cnic', label: 'والد کا شناختی کارڈ', required: false },
  { key: 'address', label: 'مکمل پتہ', required: false }
];

export const COLUMN_ALIASES = {
  name: [
    'نام',
    'طالب علم کا نام',
    'طالب علم',
    'اسم',
    'نام طالب علم',
    'student name',
    'name',
    'full name',
    'student_name',
    'student'
  ],
  father_name: [
    'والد کا نام',
    'ولدیت',
    'والد',
    'نام والد',
    'father name',
    "father's name",
    'father',
    'father_name'
  ],
  name_english: [
    'انگریزی نام',
    'انگلش نام',
    'نام انگریزی',
    'طالب علم کا نام انگریزی',
    'english name',
    'name (eng)',
    'student name (english)',
    'name_english'
  ],
  father_name_english: [
    'انگریزی والد کا نام',
    'والد کا انگریزی نام',
    'ولدیت انگریزی',
    'father english name',
    "father's name (eng)",
    'father_name_english'
  ],
  gender: ['جنس', 'gender', 'sex', 'طالب علم / طالبہ'],
  date_of_birth: [
    'تاریخ پیدائش',
    'پیدائش',
    'تاریخ ولادت',
    'dob',
    'date of birth',
    'birth date',
    'birthdate'
  ],
  b_form_number: [
    'بے فارم',
    'ب فارم',
    'بے فارم نمبر',
    'شناختی کارڈ',
    'b-form',
    'bform',
    'cnic',
    'child cnic',
    'b_form_number'
  ],
  father_mobile: [
    'موبائل',
    'فون',
    'رابطہ',
    'موبائل نمبر',
    'واٹس ایپ',
    'mobile',
    'phone',
    'whatsapp',
    'contact',
    'cell'
  ],
  father_cnic: [
    'والد کا شناختی کارڈ',
    'شناختی کارڈ والد',
    'father cnic',
    'father id',
    'father_cnic'
  ],
  address: [
    'پتہ',
    'رہائش',
    'مکمل پتہ',
    'سکونت',
    'address',
    'current address',
    'residence',
    'home address'
  ]
};

/**
 * Normalizes text for alias matching
 */
export const normalizeHeaderString = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[:_\-–—()[\].]/g, ' ')
    .replace(/\s+/g, ' ');
};

/**
 * Detects if a table extracted in LTR order was originally visually an RTL Urdu table
 * (e.g. rightmost column has roll no, serial no, or student name, while leftmost column has date, fee, signature, etc.)
 */
export const shouldReverseToRtl = (headers = []) => {
  if (!headers || headers.length <= 1) return false;
  const lastHeader = normalizeHeaderString(headers[headers.length - 1]);
  const firstHeader = normalizeHeaderString(headers[0]);

  // If last column looks like Roll No, Serial No, or Sr No
  const rollOrSrKeywords = ['رول', 'نمبر شمار', 'شمار', 'نمبر', 'roll', 'sr', 'serial', 's no', 'id'];
  const dateOrFeeOrEndKeywords = ['تاریخ', 'وصولی', 'فیس', 'دستخط', 'کیفیت', 'ریمارکس', 'fee', 'date', 'sign'];

  const lastIsStart = rollOrSrKeywords.some((k) => lastHeader.includes(k));
  const firstIsEnd = dateOrFeeOrEndKeywords.some((k) => firstHeader.includes(k));

  return lastIsStart || firstIsEnd;
};

/**
 * Reverses table columns and rows for RTL orientation
 */
export const reverseTableColumns = ({ headers = [], rows = [] }) => {
  const reversedHeaders = [...headers].reverse();
  const reversedRows = rows.map((row) => {
    const fullRow = [];
    for (let i = 0; i < headers.length; i++) {
      fullRow.push(row[i] !== undefined ? row[i] : '');
    }
    return fullRow.reverse();
  });
  return { headers: reversedHeaders, rows: reversedRows, totalRows: reversedRows.length };
};

/**
 * Auto-detects system field mappings from extracted table headers
 */
export const autoDetectColumnMapping = (headers = []) => {
  const mapping = {};
  const normalizedHeaders = headers.map((h, idx) => ({
    raw: String(h || '').trim(),
    norm: normalizeHeaderString(h),
    index: idx
  }));

  const usedHeaderIndices = new Set();

  for (const field of SYSTEM_FIELD_DEFS) {
    const aliases = COLUMN_ALIASES[field.key] || [];
    let bestMatchIndex = -1;

    for (const h of normalizedHeaders) {
      if (usedHeaderIndices.has(h.index) || !h.norm) continue;

      // Exact normalized match
      if (aliases.some((alias) => normalizeHeaderString(alias) === h.norm)) {
        bestMatchIndex = h.index;
        break;
      }

      // Substring match
      if (
        aliases.some(
          (alias) =>
            h.norm.includes(normalizeHeaderString(alias)) ||
            normalizeHeaderString(alias).includes(h.norm)
        )
      ) {
        bestMatchIndex = h.index;
      }
    }

    if (bestMatchIndex !== -1) {
      mapping[field.key] = bestMatchIndex;
      usedHeaderIndices.add(bestMatchIndex);
    } else {
      mapping[field.key] = -1; // Unmapped
    }
  }

  return mapping;
};

/**
 * Safely extracts an ArrayBuffer from File, Blob, Uint8Array, Buffer, or ArrayBuffer
 */
export const extractArrayBuffer = async (fileOrBuffer) => {
  if (!fileOrBuffer) throw new Error('فائل کا فارمیٹ درست نہیں ہے۔');
  if (fileOrBuffer instanceof ArrayBuffer) {
    return fileOrBuffer;
  }
  if (typeof fileOrBuffer.arrayBuffer === 'function') {
    return await fileOrBuffer.arrayBuffer();
  }
  if (ArrayBuffer.isView(fileOrBuffer)) {
    return fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    );
  }
  if (fileOrBuffer.buffer && fileOrBuffer.buffer instanceof ArrayBuffer) {
    return fileOrBuffer.buffer;
  }
  // Fallback for node Buffer
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(fileOrBuffer)) {
    return fileOrBuffer.buffer.slice(
      fileOrBuffer.byteOffset,
      fileOrBuffer.byteOffset + fileOrBuffer.byteLength
    );
  }
  throw new Error('فائل کا فارمیٹ درست نہیں ہے۔');
};

/**
 * Parses Excel (.xlsx, .xls, .csv) file
 */
export const parseExcelFile = async (fileOrBuffer) => {
  const arrayBuffer = await extractArrayBuffer(fileOrBuffer);

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('ایکسل فائل خالی ہے، کوئی شیٹ نہیں ملی۔');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('ایکسل شیٹ میں کوئی ڈیٹا موجود نہیں ہے۔');
  }

  // Find first row with at least 2 non-empty cells as header
  let headerIndex = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const nonEmptyCount = rawRows[i].filter((cell) => String(cell).trim() !== '').length;
    if (nonEmptyCount >= 1) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('فائل میں کوئی کارآمد قطار نہیں ملی۔');
  }

  const headers = rawRows[headerIndex].map((h) => String(h || '').trim());
  const rows = rawRows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => row.map((cell) => (cell !== undefined && cell !== null ? String(cell).trim() : '')));

  let finalHeaders = headers;
  let finalRows = rows;
  let isRtlReversed = false;

  if (shouldReverseToRtl(headers)) {
    const reversed = reverseTableColumns({ headers, rows });
    finalHeaders = reversed.headers;
    finalRows = reversed.rows;
    isRtlReversed = true;
  }

  return { headers: finalHeaders, rows: finalRows, sheetName, totalRows: finalRows.length, isRtlReversed };
};

/**
 * Parses Word (.docx) file by extracting table HTML
 */
export const parseWordFile = async (fileOrBuffer) => {
  const arrayBuffer = await extractArrayBuffer(fileOrBuffer);
  const options = { arrayBuffer };
  if (typeof Buffer !== 'undefined' && Buffer.from) {
    options.buffer = Buffer.from(arrayBuffer);
  }

  const result = await mammoth.convertToHtml(options);
  const html = result.value || '';

  if (!html.includes('<table')) {
    throw new Error('ورڈ فائل میں کوئی ٹیبل نہیں ملا۔ طلباء کی لسٹ ٹیبل فارمیٹ میں ہونی چاہیے۔');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) {
    throw new Error('ورڈ فائل سے ٹیبل پڑھنے میں دشواری پیش آئی۔');
  }

  const trs = Array.from(table.querySelectorAll('tr'));
  if (trs.length < 2) {
    throw new Error('ورڈ فائل کے ٹیبل میں مناسب قطاریں موجود نہیں ہیں۔');
  }

  // Header row is first tr
  const headerCells = Array.from(trs[0].querySelectorAll('th, td'));
  const headers = headerCells.map((cell) => (cell.textContent || '').trim());

  const rows = [];
  for (let i = 1; i < trs.length; i++) {
    const cells = Array.from(trs[i].querySelectorAll('td'));
    const rowValues = cells.map((cell) => (cell.textContent || '').trim());
    if (rowValues.some((v) => v !== '')) {
      rows.push(rowValues);
    }
  }

  let finalHeaders = headers;
  let finalRows = rows;
  let isRtlReversed = false;

  if (shouldReverseToRtl(headers)) {
    const reversed = reverseTableColumns({ headers, rows });
    finalHeaders = reversed.headers;
    finalRows = reversed.rows;
    isRtlReversed = true;
  }

  return { headers: finalHeaders, rows: finalRows, totalRows: finalRows.length, isRtlReversed };
};

/**
 * Parses PDF (.pdf) digital text table
 */
export const parsePdfFile = async (fileOrBuffer) => {
  const arrayBuffer = await extractArrayBuffer(fileOrBuffer);

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const allItems = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (item.str && item.str.trim()) {
        allItems.push({
          str: item.str.trim(),
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
          pageNum
        });
      }
    }
  }

  if (allItems.length === 0) {
    throw new Error(
      'پی ڈی ایف سے کوئی متن نہیں مل سکا۔ فائل ڈیجیٹل ٹیکسٹ ہونی چاہیے، اسکین شدہ تصویر والی پی ڈی ایف قابل قبول نہیں ہے۔ برائے مہربانی ایکسل یا ورڈ فائل استعمال کریں۔'
    );
  }

  // Group text items by Y coordinate (within tolerance of 4 units)
  const lineGroups = [];
  allItems.sort((a, b) => {
    if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
    return b.y - a.y; // Top to bottom
  });

  for (const item of allItems) {
    let matchedGroup = lineGroups.find(
      (g) => g.pageNum === item.pageNum && Math.abs(g.y - item.y) <= 5
    );
    if (!matchedGroup) {
      matchedGroup = { pageNum: item.pageNum, y: item.y, items: [] };
      lineGroups.push(matchedGroup);
    }
    matchedGroup.items.push(item);
  }

  // In each line, sort items from right to left (RTL) or left to right (LTR) based on x
  // In RTL contexts, larger X is further to the right
  const lines = lineGroups.map((g) => {
    g.items.sort((a, b) => b.x - a.x); // RTL default: rightmost first
    return g.items.map((i) => i.str);
  });

  if (lines.length < 2) {
    throw new Error('پی ڈی ایف میں مناسب قطاریں موجود نہیں ہیں، برائے مہربانی ایکسل فائل ترجیح دیں۔');
  }

  const headers = lines[0];
  const rows = lines.slice(1).filter((r) => r.length > 0);

  let finalHeaders = headers;
  let finalRows = rows;
  let isRtlReversed = false;

  if (shouldReverseToRtl(headers)) {
    const reversed = reverseTableColumns({ headers, rows });
    finalHeaders = reversed.headers;
    finalRows = reversed.rows;
    isRtlReversed = true;
  }

  return { headers: finalHeaders, rows: finalRows, totalRows: finalRows.length, isRtlReversed };
};

/**
 * Universal file parser router based on file extension
 */
export const parseImportFile = async (file) => {
  if (!file) throw new Error('کوئی فائل منتخب نہیں کی گئی۔');

  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return await parseExcelFile(file);
  } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
    return await parseWordFile(file);
  } else if (name.endsWith('.pdf')) {
    return await parsePdfFile(file);
  } else {
    throw new Error('غیر معاون فائل فارمیٹ۔ صرف ایکسل (.xlsx, .xls, .csv)، ورڈ (.docx) یا پی ڈی ایف (.pdf) اپلوڈ کریں۔');
  }
};

/**
 * Calculates next sequential registration / roll number
 */
export const calculateNextSequentialRollNumber = (existingStudents = []) => {
  let maxRoll = 0;
  for (const s of existingStudents) {
    const rawVal = s.roll_number || s.admRegNo || s.roll_no || s.regNo || '';
    const match = String(rawVal).match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num) && num > maxRoll) {
        maxRoll = num;
      }
    }
  }
  return maxRoll + 1;
};

/**
 * Sanitizes phone numbers
 */
export const sanitizePhoneNumber = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^\d+]/g, '').trim();
  return cleaned || null;
};

/**
 * Normalizes date of birth to standard YYYY-MM-DD
 */
export const normalizeDateOfBirth = (rawDate) => {
  if (!rawDate) return null;
  const str = String(rawDate).trim();
  if (!str) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Excel serial number (e.g. 44561)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const date = new Date((serial - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return null;
};

/**
 * Builds student payloads ready for storage from imported rows and mapping
 */
export const buildBatchStudentPayloads = ({
  rows = [],
  mapping = {},
  targetClassId = null,
  startRollNo = 1,
  madrasaId = null
}) => {
  const payloads = [];
  let currentRollNo = startRollNo;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nameIndex = mapping.name;
    const rawName = nameIndex >= 0 && row[nameIndex] !== undefined ? String(row[nameIndex]).trim() : '';

    // Student name is the only mandatory field; skip empty names
    if (!rawName) continue;

    const getValue = (fieldKey) => {
      const idx = mapping[fieldKey];
      if (idx !== undefined && idx >= 0 && row[idx] !== undefined) {
        return String(row[idx]).trim();
      }
      return '';
    };

    const fatherName = getValue('father_name');
    const rawNameEng = getValue('name_english');
    const rawFatherEng = getValue('father_name_english');
    const rawGender = getValue('gender');
    const rawDob = getValue('date_of_birth');
    const rawBForm = getValue('b_form_number');
    const rawMobile = getValue('father_mobile');
    const rawCnic = getValue('father_cnic');
    const rawAddress = getValue('address');

    // Normalization
    const gender =
      rawGender.includes('لڑکی') || rawGender.toLowerCase().includes('female') || rawGender.toLowerCase().includes('girl')
        ? 'لڑکی'
        : 'لڑکا';

    const nameEnglish = rawNameEng ? rawNameEng.toUpperCase() : null;
    const fatherNameEnglish = rawFatherEng ? rawFatherEng.toUpperCase() : null;
    const dateOfBirth = normalizeDateOfBirth(rawDob);
    const fatherMobile = sanitizePhoneNumber(rawMobile);
    const today = new Date().toISOString().split('T')[0];

    payloads.push({
      roll_number: String(currentRollNo).padStart(2, '0'),
      name: rawName,
      father_name: fatherName || '',
      name_english: nameEnglish,
      father_name_english: fatherNameEnglish,
      class_id: targetClassId || null,
      madrasa_id: madrasaId,
      gender: gender,
      date_of_birth: dateOfBirth,
      b_form_number: rawBForm || null,
      address: rawAddress || null,
      father_mobile: fatherMobile,
      father_whatsapp: fatherMobile,
      father_cnic: rawCnic || null,
      admission_date: today,
      is_father_guardian: true,
      status: 'active'
    });

    currentRollNo++;
  }

  return {
    payloads,
    totalCount: payloads.length,
    startRollNo,
    endRollNo: payloads.length > 0 ? currentRollNo - 1 : startRollNo
  };
};

/**
 * Analyzes student payloads for duplicate entries (both in-file and existing in database)
 */
export const analyzeDuplicateStudents = ({ payloads = [], existingStudents = [] }) => {
  const seenInFile = new Map();
  const fileDuplicates = [];
  const systemDuplicates = [];
  const cleanPayloads = [];

  const existingMap = new Map();
  for (const s of existingStudents) {
    const name = String(s.name || s.admName || '').trim().toLowerCase();
    const father = String(s.father_name || s.admFatherName || s.fatherName || '').trim().toLowerCase();
    const bForm = String(s.b_form_number || s.admBForm || '').trim().replace(/[-]/g, '');

    if (name) {
      existingMap.set(`${name}:::${father}`, s);
    }
    if (bForm) {
      existingMap.set(`bform:::${bForm}`, s);
    }
  }

  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    const name = String(p.name || '').trim().toLowerCase();
    const father = String(p.father_name || '').trim().toLowerCase();
    const bForm = String(p.b_form_number || '').trim().replace(/[-]/g, '');
    const key = `${name}:::${father}`;

    let isDupInFile = false;
    let isDupInSystem = false;
    let dupReason = '';

    if (seenInFile.has(key)) {
      isDupInFile = true;
      dupReason = 'فائل میں تکرار (In-File Duplicate)';
      fileDuplicates.push({ ...p, originalIndex: i, reason: dupReason });
    } else {
      seenInFile.set(key, i);
    }

    if (existingMap.has(key)) {
      isDupInSystem = true;
      const matched = existingMap.get(key);
      const reg = matched.roll_number || matched.admRegNo || '';
      dupReason = `سسٹم میں پہلے سے موجود ہے ${reg ? `(رول نمبر: ${reg})` : ''}`;
      systemDuplicates.push({ ...p, originalIndex: i, existingStudent: matched, reason: dupReason });
    } else if (bForm && existingMap.has(`bform:::${bForm}`)) {
      isDupInSystem = true;
      const matched = existingMap.get(`bform:::${bForm}`);
      const reg = matched.roll_number || matched.admRegNo || '';
      dupReason = `ب فارم پہلے سے درج ہے ${reg ? `(رول نمبر: ${reg})` : ''}`;
      systemDuplicates.push({ ...p, originalIndex: i, existingStudent: matched, reason: dupReason });
    }

    if (!isDupInFile) {
      cleanPayloads.push({
        ...p,
        isSystemDuplicate: isDupInSystem,
        systemDuplicateReason: isDupInSystem ? dupReason : null
      });
    }
  }

  return {
    totalEvaluated: payloads.length,
    fileDuplicates,
    systemDuplicates,
    hasDuplicates: fileDuplicates.length > 0 || systemDuplicates.length > 0,
    cleanPayloads
  };
};

/**
 * Exports students to Excel (.xlsx) with RTL layout and clean Urdu column headers
 */
export const exportStudentsToExcel = ({
  students = [],
  classes = [],
  className = '',
  madrasaName = 'جامعہ / مدرسہ'
}) => {
  const classMap = {};
  classes.forEach((c) => {
    classMap[c.id] = c.class_name;
  });

  const dataRows = students.map((s, idx) => {
    const cName = classMap[s.class_id || s.admClass] || className || 'متفرق';
    return {
      'نمبر شمار': idx + 1,
      'رجسٹریشن نمبر': s.roll_number || s.admRegNo || '',
      'طالب علم کا نام': s.name || s.admName || '',
      'انگریزی نام': s.name_english || s.admNameEnglish || '',
      'والد کا نام': s.father_name || s.admFatherName || s.fatherName || '',
      'کلاس': cName,
      'جنس': s.gender || s.admGender || 'لڑکا',
      'تاریخ پیدائش': s.date_of_birth || s.admDobFull || '',
      'ب فارم نمبر': s.b_form_number || s.admBForm || '',
      'موبائل نمبر': s.father_mobile || s.fatherMobile || '',
      'والد کا شناختی کارڈ': s.father_cnic || s.fatherCnic || '',
      'مکمل پتہ': s.address || s.admAddress || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows);

  // Set RTL view
  if (!worksheet['!views']) worksheet['!views'] = [];
  worksheet['!views'].push({ RTL: true });

  // Column widths
  worksheet['!cols'] = [
    { wch: 10 }, // نمبر شمار
    { wch: 15 }, // رجسٹریشن نمبر
    { wch: 22 }, // نام
    { wch: 20 }, // انگریزی نام
    { wch: 22 }, // والد کا نام
    { wch: 18 }, // کلاس
    { wch: 10 }, // جنس
    { wch: 14 }, // تاریخ پیدائش
    { wch: 18 }, // ب فارم
    { wch: 16 }, // موبائل
    { wch: 18 }, // شناختی کارڈ
    { wch: 30 }  // پتہ
  ];

  const workbook = XLSX.utils.book_new();
  // CRITICAL: Set right-to-left view on workbook for native Excel RTL rendering
  workbook.Workbook = { Views: [{ RTL: true }] };
  const safeSheetName = (className || 'Students_List').substring(0, 31).replace(/[:\\/?*[\]]/g, '_');
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

  const cleanFileName = `${madrasaName}_${className || 'تمام_طلباء'}_لسٹ.xlsx`.replace(/\s+/g, '_');
  XLSX.writeFile(workbook, cleanFileName);
};

/**
 * Exports students to Word (.docx) document
 */
export const exportStudentsToWord = async ({
  students = [],
  classes = [],
  className = '',
  madrasaName = 'جامعہ / مدرسہ'
}) => {
  const classMap = {};
  classes.forEach((c) => {
    classMap[c.id] = c.class_name;
  });

  const tableHeaderCells = [
    'نمبر',
    'رجسٹریشن',
    'طالب علم کا نام',
    'والد کا نام',
    'کلاس',
    'جنس',
    'موبائل نمبر',
    'پتہ'
  ].map(
    (label) =>
      new TableCell({
        children: [
          new Paragraph({
            text: label,
            alignment: AlignmentType.CENTER,
            bidirectional: true
          })
        ],
        shading: { fill: 'E2E8F0' }
      })
  );

  const tableRows = [
    new TableRow({
      children: tableHeaderCells,
      tableHeader: true
    })
  ];

  students.forEach((s, idx) => {
    const cName = classMap[s.class_id || s.admClass] || className || '';
    const cells = [
      String(idx + 1),
      String(s.roll_number || s.admRegNo || ''),
      String(s.name || s.admName || ''),
      String(s.father_name || s.admFatherName || s.fatherName || ''),
      String(cName),
      String(s.gender || s.admGender || 'لڑکا'),
      String(s.father_mobile || s.fatherMobile || ''),
      String(s.address || s.admAddress || '')
    ].map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              text: text,
              alignment: AlignmentType.RIGHT,
              bidirectional: true
            })
          ]
        })
  );

    tableRows.push(new TableRow({ children: cells }));
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: madrasaName,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            bidirectional: true
          }),
          new Paragraph({
            text: `فہرست طلباء - ${className || 'تمام کلاسز'}`,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            bidirectional: true
          }),
          new Paragraph({
            text: `تاریخ اجرا: ${new Date().toLocaleDateString('ur-PK')}`,
            alignment: AlignmentType.CENTER,
            bidirectional: true
          }),
          new Paragraph({ text: '', bidirectional: true }),
          new Table({
            visuallyRightToLeft: true,
            alignment: AlignmentType.CENTER,
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE
            }
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const cleanFileName = `${madrasaName}_${className || 'تمام_طلباء'}_لسٹ.docx`.replace(/\s+/g, '_');
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = cleanFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Generates sample Excel (.xlsx) template file for user download
 */
export const downloadSampleExcelTemplate = () => {
  const sampleData = [
    {
      'طالب علم کا نام': 'محمد عبداللہ',
      'والد کا نام': 'عبدالرحمن',
      'انگریزی نام': 'MUHAMMAD ABDULLAH',
      'والد کا نام (انگریزی)': 'ABDUL REHMAN',
      'جنس': 'لڑکا',
      'تاریخ پیدائش': '2012-05-15',
      'ب فارم / شناختی کارڈ': '35201-1234567-1',
      'موبائل نمبر': '03001234567',
      'والد کا شناختی کارڈ': '35201-7654321-1',
      'مکمل پتہ': 'مکان نمبر 12، گلی 3، ماڈل ٹاؤن، لاہور'
    },
    {
      'طالب علم کا نام': 'احمد حسن',
      'والد کا نام': 'محمد حسن',
      'انگریزی نام': 'AHMAD HASSAN',
      'والد کا نام (انگریزی)': 'MUHAMMAD HASSAN',
      'جنس': 'لڑکا',
      'تاریخ پیدائش': '2013-08-20',
      'ب فارم / شناختی کارڈ': '35201-9876543-1',
      'موبائل نمبر': '03217654321',
      'والد کا شناختی کارڈ': '35201-1122334-1',
      'مکمل پتہ': 'محلہ فاروقیہ، فیصل آباد'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  if (!worksheet['!views']) worksheet['!views'] = [];
  worksheet['!views'].push({ RTL: true });

  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
    { wch: 35 }
  ];

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample_Students');
  XLSX.writeFile(workbook, 'نمونہ_فہرست_طلباء_ٹیمپلیٹ.xlsx');
};

/**
 * Generates sample Word (.docx) template file for user download
 */
export const downloadSampleWordTemplate = async () => {
  const tableHeaderCells = [
    'نمبر شمار',
    'طالب علم کا نام',
    'والد کا نام',
    'انگریزی نام',
    'جنس',
    'تاریخ پیدائش',
    'ب فارم',
    'موبائل نمبر',
    'پتہ'
  ].map(
    (label) =>
      new TableCell({
        children: [
          new Paragraph({
            text: label,
            alignment: AlignmentType.CENTER,
            bidirectional: true
          })
        ],
        shading: { fill: 'F1F5F9' }
      })
  );

  const sampleRows = [
    ['1', 'محمد عبداللہ', 'عبدالرحمن', 'MUHAMMAD ABDULLAH', 'لڑکا', '2012-05-15', '35201-1234567-1', '03001234567', 'لاہور'],
    ['2', 'احمد حسن', 'محمد حسن', 'AHMAD HASSAN', 'لڑکا', '2013-08-20', '35201-9876543-1', '03217654321', 'فیصل آباد']
  ].map((rowVals) => {
    return new TableRow({
      children: rowVals.map(
        (val) =>
          new TableCell({
            children: [
              new Paragraph({
                text: val,
                alignment: AlignmentType.RIGHT,
                bidirectional: true
              })
            ]
          })
      )
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'نمونہ برائے بلک اسٹوڈنٹ امپورٹ (ورڈ ٹیمپلیٹ)',
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            bidirectional: true
          }),
          new Paragraph({
            text: 'براہ کرم اس ٹیبل میں طلباء کا ڈیٹا درج کریں اور محفوظ کر کے امپورٹ کریں۔',
            alignment: AlignmentType.CENTER,
            bidirectional: true
          }),
          new Paragraph({ text: '', bidirectional: true }),
          new Table({
            visuallyRightToLeft: true,
            alignment: AlignmentType.CENTER,
            rows: [
              new TableRow({
                children: tableHeaderCells,
                tableHeader: true
              }),
              ...sampleRows
            ],
            width: {
              size: 100,
              type: WidthType.PERCENTAGE
            }
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'نمونہ_فہرست_طلباء_ٹیمپلیٹ.docx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/**
 * Opens a dedicated printable A4 register window for students list (PDF print-ready)
 */
export const printStudentsList = ({
  students = [],
  classes = [],
  className = '',
  madrasaName = 'جامعہ / مدرسہ'
}) => {
  const classMap = {};
  classes.forEach((c) => {
    classMap[c.id] = c.class_name;
  });

  const rowsHtml = students
    .map((s, idx) => {
      const cName = classMap[s.class_id || s.admClass] || className || '';
      return `
      <tr>
        <td style="text-align: center; padding: 6px 8px; border: 1px solid #333;">${idx + 1}</td>
        <td style="text-align: center; font-weight: bold; padding: 6px 8px; border: 1px solid #333;">${s.roll_number || s.admRegNo || ''}</td>
        <td style="padding: 6px 8px; border: 1px solid #333; font-weight: 600;">${s.name || s.admName || ''}</td>
        <td style="padding: 6px 8px; border: 1px solid #333;">${s.father_name || s.admFatherName || s.fatherName || ''}</td>
        <td style="text-align: center; padding: 6px 8px; border: 1px solid #333;">${cName}</td>
        <td style="text-align: center; padding: 6px 8px; border: 1px solid #333;">${s.gender || s.admGender || 'لڑکا'}</td>
        <td style="direction: ltr; text-align: center; padding: 6px 8px; border: 1px solid #333;">${s.father_mobile || s.fatherMobile || ''}</td>
        <td style="padding: 6px 8px; border: 1px solid #333;">${s.address || s.admAddress || ''}</td>
      </tr>
    `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>${madrasaName} - ${className || 'فہرست طلباء'}</title>
      <style>
        body {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          margin: 20px;
          color: #000;
          direction: rtl;
          text-align: right;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
        }
        .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
        .header h2 { margin: 0 0 6px 0; font-size: 18px; color: #222; }
        .header .meta { font-size: 14px; color: #444; }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          direction: rtl;
        }
        th {
          background-color: #f1f5f9;
          font-weight: 700;
          border: 1px solid #333;
          padding: 8px;
          text-align: center;
        }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${madrasaName}</h1>
        <h2>فہرست طلباء - ${className || 'تمام کلاسز'}</h2>
        <div class="meta">کل طلباء: ${students.length} | تاریخ اجرا: ${new Date().toLocaleDateString('ur-PK')}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 45px;">نمبر</th>
            <th style="width: 70px;">رجسٹریشن</th>
            <th>طالب علم کا نام</th>
            <th>والد کا نام</th>
            <th style="width: 110px;">کلاس</th>
            <th style="width: 60px;">جنس</th>
            <th style="width: 110px;">موبائل نمبر</th>
            <th>مکمل پتہ</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  if (typeof window !== 'undefined') {
    try {
      const printWindow = window.open?.('', '_blank', 'width=1000,height=750');
      if (printWindow && printWindow.document) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (_) {}
        }, 350);
        return;
      }
    } catch (_) {}
    try {
      window.print?.();
    } catch (_) {}
  }
};
