/**
 * AI Vision Sheet Scanner for Daily Academic Performance (روزانہ تعلیمی کارکردگی)
 * Parses photographed or scanned A4 sheets and maps filled checkboxes/handwriting to students.
 */

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const normalizeUrduText = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove arabic tashkeel
    .replace(/[ية]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ');
};

export async function parseDailyPerformanceSheet({
  base64Data,
  mimeType = 'image/jpeg',
  students = [],
  apiKey = null
}) {
  const activeKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY || (typeof window !== 'undefined' ? localStorage.getItem('gemini_vision_api_key') : null);

  if (!activeKey) {
    throw new Error('اے آئی اسکینر کے لیے گوگل جیمنائی API Key درکار ہے۔ برائے کرم اپنی API Key درج فرمائیں۔');
  }

  if (!base64Data) {
    throw new Error('تجزیہ کے لیے تصویر کا ڈیٹا دستیاب نہیں ہے۔');
  }

  const studentsPromptList = students.map((s, idx) => {
    const roll = s.admRegNo || s.roll_number || `${idx + 1}`;
    const name = s.name || s.admName || '';
    const father = s.father_name || s.admFatherName || '';
    return `Row ${idx + 1}: Roll No: "${roll}", Name: "${name}", Father: "${father}"`;
  }).join('\n');

  const promptText = `
You are an expert Islamic madrasa document OCR and handwriting recognition AI.
You are given an image of a handwritten / filled daily academic evaluation sheet (روزانہ تعلیمی کارکردگی و روزنامچہ).
The table is oriented Right-to-Left (RTL) with 8 columns:
1. نمبر شمار (Row Index: 1, 2, 3...)
2. نام مع ولدیت (Student Name and Father Name)
3. سبق (Sabaq Checkbox: determine if ticked/checked [✓] or empty [ ])
4. سبقی (Sabaqi Checkbox: determine if ticked/checked [✓] or empty [ ])
5. منزل (Manzil: determine if checked [✓] or empty [ ]. Also read handwritten "پارہ" number (1 to 30) and handwritten "مقدار" (amount listened, e.g. "1 پاؤ", "آدھا پارہ", "پورا پارہ", or number of pages/surah) if written)
6. سامع (Sami: read the handwritten name of the person who listened to Manzil)
7. کیفیت (Kaifiyat: determine if checked [✓]. Read handwritten condition/notes in 3-4 words if written, e.g. "بہترین", "مناسب", "روانی کمزور", "توجہ طلب")
8. مطالعہ (Mutalaah Checkbox: determine if ticked/checked [✓] or empty [ ])

Below is the authoritative registered student list for this class:
${studentsPromptList}

Instructions:
1. Carefully inspect each row of the table in the image.
2. Match each row in the image with the corresponding student from the registered list above using Roll No or Student Name.
3. For checkboxes, return true if there is a checkmark (✓), tick, dot, cross, or fill inside the box. Return false if the square box is completely blank or empty.
4. For Manzil, extract the integer para number (1-30) into "manzil_para" and the amount into "manzil_amount" (in Urdu text if possible, e.g. "آدھا پارہ", "1 پاؤ", "پورا پارہ").
5. For Sami and Kaifiyat, accurately transcribe the handwritten Urdu names and remarks.
6. Return a valid JSON array of objects following this exact schema:

[
  {
    "roll_number": "101",
    "student_name": "محمد عمر",
    "sabaq": true,
    "sabqi": true,
    "manzil": true,
    "manzil_para": 5,
    "manzil_amount": "آدھا پارہ",
    "sami_name": "قاری احمد",
    "kaifiyat_checked": true,
    "kaifiyat_text": "بہترین یاد تھا",
    "mutalaah": true
  }
]
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || response.statusText;
    throw new Error(`گوگل جیمنائی API ایرر: ${message}`);
  }

  const jsonResult = await response.json();
  const rawText = jsonResult?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('تصویر سے ڈیٹا حاصل نہیں ہو سکا۔ برائے کرم واضح اور سیدھی تصویر اپلوڈ کریں۔');
  }

  let parsedItems = [];
  try {
    parsedItems = JSON.parse(rawText);
    if (!Array.isArray(parsedItems)) {
      if (parsedItems && Array.isArray(parsedItems.students)) {
        parsedItems = parsedItems.students;
      } else if (parsedItems && Array.isArray(parsedItems.records)) {
        parsedItems = parsedItems.records;
      } else {
        parsedItems = [parsedItems];
      }
    }
  } catch (err) {
    console.error('Failed to parse Gemini OCR JSON:', rawText, err);
    throw new Error('اے آئی کے جواب کو پروسیس کرنے میں غلطی ہوئی۔ برائے کرم دوبارہ کوشش کریں۔');
  }

  // Match items with class students
  const mappedRecords = {};
  let matchedCount = 0;

  parsedItems.forEach((item) => {
    if (!item) return;

    const itemRoll = String(item.roll_number || '').trim().toLowerCase();
    const itemName = normalizeUrduText(item.student_name);

    // 1. Try matching by roll number
    let matchedStudent = null;
    if (itemRoll) {
      matchedStudent = students.find((s) => {
        const sRoll = String(s.admRegNo || s.roll_number || '').trim().toLowerCase();
        return sRoll && (sRoll === itemRoll || sRoll.endsWith(itemRoll) || itemRoll.endsWith(sRoll));
      });
    }

    // 2. If not matched, try matching by name
    if (!matchedStudent && itemName) {
      matchedStudent = students.find((s) => {
        const sName = normalizeUrduText(s.name || s.admName);
        return sName && (sName.includes(itemName) || itemName.includes(sName));
      });
    }

    if (matchedStudent) {
      matchedCount++;
      const sId = matchedStudent.id;
      mappedRecords[sId] = {
        sabaq: Boolean(item.sabaq),
        sabqi: Boolean(item.sabqi),
        manzil: Boolean(item.manzil),
        manzil_para: item.manzil_para ? String(item.manzil_para).replace(/[^0-9]/g, '') : '',
        manzil_amount: item.manzil_amount ? String(item.manzil_amount).trim() : '',
        sami_name: item.sami_name ? String(item.sami_name).trim() : '',
        kaifiyat_checked: Boolean(item.kaifiyat_checked || item.kaifiyat_text),
        kaifiyat_text: item.kaifiyat_text ? String(item.kaifiyat_text).trim() : '',
        mutalaah: Boolean(item.mutalaah)
      };
    }
  });

  return {
    success: true,
    totalParsed: parsedItems.length,
    matchedCount,
    mappedRecords,
    rawItems: parsedItems
  };
}
