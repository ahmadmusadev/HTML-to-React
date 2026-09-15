import React, { useState, useEffect, useRef } from 'react';
import './AiChatbot.css';

// Preset suggested questions for quick access
const SUGGESTED_PROMPTS = [
  { id: 'adm', text: 'نئے طالب علم کا نیا داخلہ کیسے کریں؟' },
  { id: 'entry', text: 'روزانہ کا سبق، سبقی اور منزل کیسے درج کریں؟' },
  { id: 'fee', text: 'طالب علم کی ماہانہ فیس کا ریکارڈ کیسے اپڈیٹ کریں؟' },
  { id: 'staff', text: 'کلاس یا مدرسے کے استاد کا نیا اکاؤنٹ کیسے بنائیں؟' },
  { id: 'att', text: 'روزانہ کی حاضری کا طریقہ کار کیا ہے؟' },
];

// Structured Software Knowledge Base Engine
const KNOWLEDGE_BASE = [
  {
    id: 'admissions',
    topic: 'داخلہ جات (Admissions)',
    primaryKeywords: ['داخلہ', 'نیا داخلہ', 'داخلہ جات', 'داخلہ فارم', 'داخلہ نمبر', 'رجسٹریشن', 'admit', 'admission', 'register'],
    secondaryKeywords: ['رول نمبر', 'کلاس انتخاب', 'سرپرست', 'مقیم'],
    response: `**نئے طالب علم کے داخلہ کا طریقہ کار:**
1. مینو بار سے **'داخلہ جات'** (Admissions) ٹیب منتخب کریں۔
2. **'نیا داخلہ'** فارم میں طالب علم کا پورا نام، والد کا نام، اور فون نمبر درج کریں۔
3. رول نمبر، داخلہ نمبر اور متعلقہ کلاس منتخب کریں۔
4. رہائشی صورتحال (مقیم / غیر مقیم) منتخب کریں۔
5. **'داخلہ محفوظ کریں'** کا بٹن دبائیں۔ طالب علم کا ریکارڈ فوری شامل ہو جائے گا۔`
  },
  {
    id: 'entry',
    topic: 'جائزہ جات (Daily Hifz Entry)',
    primaryKeywords: ['سبق', 'سبقی', 'منزل', 'جائزہ', 'جائزہ جات', 'تلاوت', 'پارہ', 'سطور', 'حفظ', 'sabaq', 'sabqi', 'manzil', 'entry'],
    primaryPhrases: ['سبق، سبقی اور منزل', 'سبق درج', 'روزانہ کا سبق'],
    secondaryKeywords: ['دور', 'تجھوید'],
    response: `**روزانہ کا سبق، سبقی اور منزل درج کرنے کا طریقہ:**
1. نیویگیشن بار سے **'جائزہ جات'** (Entry) ٹیب پر کلک کریں۔
2. مطلوبہ کلاس اور طالب علم کا نام منتخب کریں۔
3. **سبق (Sabaq):** موجودہ پڑھا گیا پارہ اور سطور درج کریں۔
4. **سبقی (Sabqi):** پچھلے یاد شدہ پارے کا نمبر درج کریں۔
5. **منزل (Manzil):** دور یا پچھلی منزل کا جائزہ منتخب کریں۔
6. **'ریکارڈ محفوظ کریں'** کا بٹن دبا کر اینٹری مکمل کریں۔`
  },
  {
    id: 'fees',
    topic: 'فیس ریکارڈ (Fees Management)',
    primaryKeywords: ['فیس', 'ماہانہ فیس', 'فیس ریکارڈ', 'رسید', 'چالان', 'ادائیگی', 'بقایا', 'وصولی', 'مالیات', 'fee', 'fees', 'payment', 'dues', 'receipt'],
    primaryPhrases: ['فیس کا ریکارڈ', 'فیس اپڈیٹ', 'ماہانہ فیس'],
    secondaryKeywords: ['نقد', 'بینک', 'آن لائن'],
    response: `**فیس کا ریکارڈ اور رسید جاری کرنے کا طریقہ:**
1. مینو میں **'فیس ریکارڈ'** (Fees) ٹیب کھولیں۔
2. طالب علم کا نام یا رول نمبر تلاش کریں۔
3. وصول شدہ فیس کی رقم، متعلقہ مہینہ اور ادائیگی کی تاریخ درج کریں۔
4. ادائیگی کا طریقہ (نقد / بینک / آن لائن) منتخب کریں۔
5. **'فیس جمع کریں'** پر کلک کریں اور ضرورت پڑنے پر پرنٹ رسید پر کلک کر کے رسید ڈاؤن لوڈ کریں۔`
  },
  {
    id: 'attendance',
    topic: 'حاضری ریکارڈ (Attendance System)',
    primaryKeywords: ['حاضری', 'حاضر', 'غیر حاضر', 'رخصت', 'حاضری ریکارڈ', 'حاضری شیٹ', 'attendance', 'present', 'absent', 'leave'],
    primaryPhrases: ['روزانہ کی حاضری', 'حاضری کا طریقہ'],
    secondaryKeywords: ['اسٹاف حاضری', 'تاریخ'],
    response: `**روزانہ کی حاضری مارک کرنے کا طریقہ:**
1. مینو سے **'حاضری'** (Attendance) ٹیب پر جائیں۔
2. متعلقہ تاریخ اور کلاس منتخب کریں۔
3. تمام طلباء کے نام کے سامنے **حاضر (Present)**، **غیر حاضر (Absent)**، یا **رخصت (Leave)** پر نشان لگائیں۔
4. اساتذہ اور عملے کی حاضری کے لیے اوپر دیے گئے 'اسٹاف حاضری' سوئچ کا استعمال کریں۔
5. **'حاضری محفوظ کریں'** کا بٹن دبائیں۔`
  },
  {
    id: 'staff',
    topic: 'اسٹاف و اساتذہ (Staff Management)',
    primaryKeywords: ['استاد', 'اساتذہ', 'ٹیچر', 'اسٹاف', 'عملہ', 'استاد اکاؤنٹ', 'عہدہ', 'ناظم', 'قاری', 'staff', 'teacher', 'employee'],
    primaryPhrases: ['استاد کا نیا اکاؤنٹ', 'نیا استاد'],
    secondaryKeywords: ['موبائل نمبر', 'کلاس تفویض'],
    response: `**نئے استاد یا اسٹاف رکن کا اکاؤنٹ بنانے کا طریقہ:**
1. مینو میں **'اسٹاف'** (Staff) ٹیب پر جائیں۔
2. **'نیا استاد شامل کریں'** والے فارم میں استاد کا پورا نام، موبائل نمبر اور عہدہ (مثلاً: مدرسِ حفظ، ناظم، قاری) درج کریں۔
3. استاد کے سپرد کی جانے والی کلاس منتخب کریں۔
4. **'استاد کا ریکارڈ محفوظ کریں'** پر کلک کریں۔`
  },
  {
    id: 'exams',
    topic: 'امتحانات اور نتائج (Exams & Results)',
    primaryKeywords: ['امتحان', 'امتحانات', 'رزلٹ', 'نمبر', 'نتائج', 'گریڈ', 'امتحانی', 'exam', 'exams', 'result', 'marks', 'test'],
    primaryPhrases: ['امتحان کا طریقہ', 'رزلٹ کارڈ'],
    secondaryKeywords: ['ششماہی', 'سالانہ', 'ماہانہ ٹیسٹ'],
    response: `**امتحانات اور نتائج کے اندراج کا طریقہ:**
1. مینو سے **'امتحانات'** (Exams) ٹیب کھولیں۔
2. امتحان کی قسم (مثلاً: ماہانہ ٹیسٹ، ششماہی، یا سالانہ امتحان) منتخب کریں۔
3. طالب علم کے حفظ، تجوید اور رفتار کے حاصل کردہ نمبرز داخل کریں۔
4. سسٹم ازخود فیصدی اور گریڈ کی حساب کتاب کرے گا جس کے بعد رزلٹ کارڈ پرنٹ کیا جا سکتا ہے۔`
  },
  {
    id: 'records',
    topic: 'تعلیمی ریکارڈز (Records & Credentials)',
    primaryKeywords: ['تعلیمی ریکارڈ', 'تعلیمی ریکارڈز', 'شناختی کارڈ', 'سند', 'سرٹیفکیٹ', 'گراف', 'ہسٹری', 'records', 'card', 'certificate'],
    primaryPhrases: ['تعلیمی ریکارڈز', 'طالب علم شناختی کارڈ'],
    secondaryKeywords: ['سالانہ حاضری', 'کارکردگی'],
    response: `**تعلیمی ریکارڈز اور کارڈز حاصل کرنے کا طریقہ:**
1. **'تعلیمی ریکارڈز'** (Records) ٹیب کھولیں۔
2. طالب علم کا مکمل سبق ہسٹری، سالانہ حاضری فیصد، اور تعلیمی ترقی کا گراف دیکھیں۔
3. **'طالب علم شناختی کارڈ'** یا **'تعلیمی سند'** بٹن پر کلک کر کے پرنٹ ایبل کارڈ حاصل کریں۔`
  },
  {
    id: 'ai-listen',
    topic: 'اے آئی استاد (AI Quran Listener)',
    primaryKeywords: ['صوتی', 'مائیکروفون', 'تجوید', 'مخارج', 'اے آئی استاد', 'تلاوت سننا', 'ai-listen', 'listen', 'recitation'],
    primaryPhrases: ['اے آئی استاد', 'تلاوت صوتی'],
    secondaryKeywords: ['اصلاح', 'تلاوت'],
    response: `**اے آئی استاد کے استعمال کا طریقہ:**
1. **'اے آئی استاد'** (AI Listen) ٹیب پر جائیں۔
2. مائیکروفون کی اجازت دیں اور طالب علم کو تلاوت کا حکم دیں۔
3. AI سسٹم تلاوت کو سنے گا اور تجوید و مخارج سے متعلق رہنمائی فراہم کرے گا۔`
  },
  {
    id: 'dashboard',
    topic: 'ڈیش بورڈ اور تنظیم (Dashboard & Overview)',
    primaryKeywords: ['ڈیش بورڈ', 'شاخ', 'لوگو', 'کیمپس', 'مجموعی', 'کل طلباء', 'dashboard', 'home', 'overview', 'branch', 'logo'],
    primaryPhrases: ['ڈیش بورڈ کا جائزہ', 'شاخ کی تبدیلی'],
    secondaryKeywords: ['فعال کلاسز', 'احصائیات'],
    response: `**ڈیش بورڈ کا جائزہ:**
1. **'ڈیش بورڈ'** (Dashboard) پر مدرسے کے کل طلباء، فعال کلاسز، اور حاضری کی شرح کے احصائیات ظاہر ہوتے ہیں۔
2. ہیڈر کنٹرولز سے آپ مدرسے کا لوگو اپ لوڈ یا شاخ (Branch) کو تبدیل اور رینیم کر سکتے ہیں۔`
  },
  {
    id: 'greeting',
    topic: 'خوش آمدید',
    primaryKeywords: ['سلام', 'السلام', 'ہیلو', 'hello', 'hi', 'assalam', 'aoa', 'کون', 'رہنما'],
    primaryPhrases: ['السلام علیکم', 'ہیلو'],
    secondaryKeywords: ['تعارف', 'مدد'],
    response: `وعلیکم السلام ورحمۃ اللہ وبرکاتہ!
میں مدرسہ منیجر کا **اے آئی رہنما** ہوں۔ میں آپ کو اس سافٹ ویئر کے تمام فیچرز (داخلہ جات، سبق جائزہ جات، فیس، حاضری، امتحانات، تعلیمی ریکارڈز، اور اسٹاف) استعمال کرنے میں رہنمائی فراہم کر سکتا ہوں۔`
  }
];

// Score-based Domain Knowledge Matcher Function
function findBestKnowledgeMatch(queryText) {
  if (!queryText || !queryText.trim()) return null;
  const lowerText = queryText.toLowerCase().trim();

  let bestMatch = null;
  let maxScore = 0;

  KNOWLEDGE_BASE.forEach(item => {
    let score = 0;

    // Check exact phrases (Highest Weight: 50 pts)
    if (item.primaryPhrases) {
      item.primaryPhrases.forEach(phrase => {
        if (lowerText.includes(phrase.toLowerCase())) {
          score += 50;
        }
      });
    }

    // Check primary keywords (Weight: 10 pts per match)
    if (item.primaryKeywords) {
      item.primaryKeywords.forEach(kw => {
        if (lowerText.includes(kw.toLowerCase())) {
          score += 10;
        }
      });
    }

    // Check secondary keywords (Weight: 2 pts per match)
    if (item.secondaryKeywords) {
      item.secondaryKeywords.forEach(kw => {
        if (lowerText.includes(kw.toLowerCase())) {
          score += 2;
        }
      });
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  });

  // Return match only if threshold met
  return maxScore > 0 ? bestMatch : null;
}

// Helper to query Gemini/OpenAI with strict software domain prompt
async function fetchLlmResponse(query) {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const systemInstruction = `You are AI Rehnuma (اے آئی رہنما), an exclusive user-guide assistant for this Madrasa SaaS software.
Scope: Help users navigate features like Admissions, Daily Hifz Sabaq Entry, Attendance, Fee Records, Staff Management, Exams & Results, Educational Records, and AI Listener.
CRITICAL RULE: If the user asks anything outside this Madrasa management software domain (e.g. general knowledge, weather, cooking, external directions), politely decline in Urdu:
"معذرت! یہ سوال مدرسہ منیجر سافٹ ویئر کے دائرہ کار سے باہر ہے۔ میں صرف اس سافٹ ویئر کے فیچرز اور استعمال کی رہنمائی فراہم کر سکتا ہوں۔"
Do not guess or fabricate information outside the application features.`;

  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemInstruction}\nUser query: ${query}`
            }]
          }]
        })
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      console.warn('Gemini API call failed:', err);
    }
  }

  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: query }
          ]
        })
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err) {
      console.warn('OpenAI API call failed:', err);
    }
  }

  return null;
}

// Helper for screen viewport boundary clamping
function clampPosition(x, y, elemWidth = 0, elemHeight = 0) {
  const margin = 12;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const maxX = Math.max(margin, winW - elemWidth - margin);
  const maxY = Math.max(margin, winH - elemHeight - margin);
  return {
    x: Math.round(Math.min(Math.max(margin, x), maxX)),
    y: Math.round(Math.min(Math.max(margin, y), maxY))
  };
}

function getInitialTriggerPos() {
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  try {
    const saved = localStorage.getItem('hifz_chatbot_trigger_pos') || localStorage.getItem('hifz_chatbot_pos');
    if (saved) {
      const parsed = JSON.parse(saved);
      const pos = parsed?.trigger || parsed;
      if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
        return clampPosition(pos.x, pos.y, 160, 50);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return {
    x: 24,
    y: Math.max(12, winH - 76)
  };
}

function getInitialDrawerPos() {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const drawerW = Math.min(410, winW - 24);
  const drawerH = Math.min(600, winH - 32);
  try {
    const saved = localStorage.getItem('hifz_chatbot_drawer_pos') || localStorage.getItem('hifz_chatbot_pos');
    if (saved) {
      const parsed = JSON.parse(saved);
      const pos = parsed?.drawer || parsed;
      if (typeof pos?.x === 'number' && typeof pos?.y === 'number') {
        return clampPosition(pos.x, pos.y, drawerW, drawerH);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return {
    x: 24,
    y: Math.max(12, winH - drawerH - 24)
  };
}

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: 'السلام علیکم! میں آپ کا **اے آئی رہنما** ہوں۔ سافٹ ویئر استعمال کرنے سے متعلق کوئی بھی سوال پوچھیے یا نیچے دیے گئے سوالات پر کلک کریں۔',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Draggable state
  const [triggerPos, setTriggerPos] = useState(getInitialTriggerPos);
  const [drawerPos, setDrawerPos] = useState(getInitialDrawerPos);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragTarget, setActiveDragTarget] = useState(null); // 'trigger' | 'drawer' | null

  const hasCustomDrawerPos = useRef(false);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const justDraggedRef = useRef(false);

  const dragInfoRef = useRef({
    isDown: false,
    targetType: null,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    elemWidth: 0,
    elemHeight: 0,
    hasMoved: false,
    pointerId: null,
    targetElem: null
  });

  // Track if drawer has been positioned by the user previously
  useEffect(() => {
    try {
      const savedDrawer = localStorage.getItem('hifz_chatbot_drawer_pos');
      const savedComposite = localStorage.getItem('hifz_chatbot_pos');
      if (savedDrawer) {
        hasCustomDrawerPos.current = true;
      } else if (savedComposite) {
        const parsed = JSON.parse(savedComposite);
        if (parsed?.drawer) {
          hasCustomDrawerPos.current = true;
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Re-clamp positions if window is resized or orientation changes
  useEffect(() => {
    const handleResize = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTriggerPos(prev => clampPosition(prev.x, prev.y, rect.width, rect.height));
      }
      if (drawerRef.current) {
        const rect = drawerRef.current.getBoundingClientRect();
        setDrawerPos(prev => clampPosition(prev.x, prev.y, rect.width, rect.height));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  // Unified Pointer Drag Event Handlers
  const handlePointerDown = (e, targetType) => {
    if (e.button !== 0 && e.button !== undefined) return;

    // For drawer: ignore drag if clicked inside interactive controls or messages scroll container
    if (targetType === 'drawer') {
      if (e.target.closest('button, input, textarea, .prompt-chip, a, .ai-chatbot-messages')) {
        return;
      }
    }

    const currentPos = targetType === 'trigger' ? triggerPos : drawerPos;
    const targetElem = targetType === 'trigger' ? triggerRef.current : drawerRef.current;
    const rect = targetElem?.getBoundingClientRect();
    const elemWidth = (rect?.width && rect.width > 0) ? rect.width : (targetType === 'trigger' ? 160 : 410);
    const elemHeight = (rect?.height && rect.height > 0) ? rect.height : (targetType === 'trigger' ? 50 : 600);

    dragInfoRef.current = {
      isDown: true,
      targetType,
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: currentPos.x,
      elemStartY: currentPos.y,
      elemWidth,
      elemHeight,
      hasMoved: false,
      pointerId: e.pointerId,
      targetElem
    };

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore mock/environment errors
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!dragInfoRef.current.isDown) return;

    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;

    // Movement threshold to distinguish tap/click from drag
    if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) >= 6) {
      dragInfoRef.current.hasMoved = true;
      setIsDragging(true);
      setActiveDragTarget(dragInfoRef.current.targetType);
    }

    if (dragInfoRef.current.hasMoved) {
      const nextX = dragInfoRef.current.elemStartX + dx;
      const nextY = dragInfoRef.current.elemStartY + dy;
      const clamped = clampPosition(
        nextX,
        nextY,
        dragInfoRef.current.elemWidth,
        dragInfoRef.current.elemHeight
      );

      if (dragInfoRef.current.targetType === 'trigger') {
        setTriggerPos(clamped);
      } else {
        setDrawerPos(clamped);
      }
    }
  };

  const handlePointerUp = () => {
    if (!dragInfoRef.current.isDown) return;

    const { targetType, hasMoved, pointerId, targetElem } = dragInfoRef.current;

    if (targetElem && typeof targetElem.releasePointerCapture === 'function' && pointerId !== null) {
      try {
        if (typeof targetElem.hasPointerCapture === 'function') {
          if (targetElem.hasPointerCapture(pointerId)) {
            targetElem.releasePointerCapture(pointerId);
          }
        } else {
          targetElem.releasePointerCapture(pointerId);
        }
      } catch {
        // Ignore
      }
    }

    if (hasMoved) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 120);

      try {
        if (targetType === 'trigger') {
          setTriggerPos(current => {
            localStorage.setItem('hifz_chatbot_trigger_pos', JSON.stringify(current));
            try {
              const composite = JSON.parse(localStorage.getItem('hifz_chatbot_pos') || '{}');
              composite.trigger = current;
              localStorage.setItem('hifz_chatbot_pos', JSON.stringify(composite));
            } catch {
              // Ignore
            }
            return current;
          });
        } else {
          hasCustomDrawerPos.current = true;
          setDrawerPos(current => {
            localStorage.setItem('hifz_chatbot_drawer_pos', JSON.stringify(current));
            try {
              const composite = JSON.parse(localStorage.getItem('hifz_chatbot_pos') || '{}');
              composite.drawer = current;
              localStorage.setItem('hifz_chatbot_pos', JSON.stringify(composite));
            } catch {
              // Ignore
            }
            return current;
          });
        }
      } catch {
        // Ignore
      }
    }

    dragInfoRef.current.isDown = false;
    setIsDragging(false);
    setActiveDragTarget(null);
  };

  const handleToggle = () => {
    setIsOpen(prev => {
      const nextState = !prev;
      if (nextState && !hasCustomDrawerPos.current) {
        // Intelligently place the drawer near current trigger location
        const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const drawerW = Math.min(410, winW - 24);
        const drawerH = Math.min(600, winH - 32);

        let targetY = triggerPos.y - drawerH - 12;
        if (targetY < 12) {
          targetY = Math.min(triggerPos.y + 54, winH - drawerH - 12);
        }
        let targetX = triggerPos.x;
        const clamped = clampPosition(targetX, targetY, drawerW, drawerH);
        setDrawerPos(clamped);
      }
      return nextState;
    });
  };

  const handleTriggerClick = (e) => {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleToggle();
  };

  const handleResetPosition = (e) => {
    if (e) e.stopPropagation();
    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
    const defaultTrigger = { x: 24, y: Math.max(12, winH - 76) };
    const drawerH = Math.min(600, winH - 32);
    const defaultDrawer = { x: 24, y: Math.max(12, winH - drawerH - 24) };

    setTriggerPos(defaultTrigger);
    setDrawerPos(defaultDrawer);
    hasCustomDrawerPos.current = false;
    try {
      localStorage.removeItem('hifz_chatbot_trigger_pos');
      localStorage.removeItem('hifz_chatbot_drawer_pos');
      localStorage.removeItem('hifz_chatbot_pos');
    } catch {
      // Ignore
    }
  };

  const handleSend = async (queryText) => {
    const textToSend = typeof queryText === 'string' ? queryText : inputText;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Score-based knowledge matching logic
    const matchedKnowledge = findBestKnowledgeMatch(textToSend);
    let replyText = matchedKnowledge?.response;

    // Fallback to LLM or explicit Domain Restriction message if outside scope
    if (!replyText) {
      const apiReply = await fetchLlmResponse(textToSend);
      if (apiReply) {
        replyText = apiReply;
      } else {
        replyText = `معذرت! یہ سوال مدرسہ منیجر سافٹ ویئر کے دائرہ کار سے باہر ہے۔ میں صرف اس سافٹ ویئر کے فیچرز اور استعمال سے متعلق سوالات کی رہنمائی فراہم کر سکتا ہوں۔

برائے مہربانی سافٹ ویئر کے متعلقہ ٹیبز (داخلہ جات، جائزہ جات، فیس، حاضری، امتحانات، تعلیمی ریکارڈز، یا اسٹاف) کے بارے میں سوال پوچھیے۔`;
      }
    }

    // Simulate typing delay for realistic interaction
    setTimeout(() => {
      const botMsg = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'bot',
        text: 'گفتگو کو ری سیٹ کر دیا گیا ہے۔ آپ نیا سوال پوچھ سکتے ہیں۔',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Helper function to render formatted text without raw markdown asterisks
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <React.Fragment key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
          {lineIdx !== lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="ai-chatbot-root" dir="rtl">
      {/* Floating Trigger Button (Only rendered when drawer is closed) */}
      {!isOpen && (
        <button
          ref={triggerRef}
          type="button"
          className={`ai-chatbot-trigger ${isDragging && activeDragTarget === 'trigger' ? 'is-dragging' : ''}`}
          style={{
            left: `${triggerPos.x}px`,
            top: `${triggerPos.y}px`,
            bottom: 'auto',
            right: 'auto'
          }}
          onPointerDown={(e) => handlePointerDown(e, 'trigger')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleTriggerClick}
          title="اے آئی رہنما (کھینچ کر کہیں بھی منتقل کر سکتے ہیں)"
          aria-label="Toggle AI Rehnuma Assistant"
        >
          <span className="chatbot-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.11L2 22l1.11-5.413A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z"></path>
              <circle cx="8.5" cy="11.5" r="1" fill="currentColor"></circle>
              <circle cx="12" cy="11.5" r="1" fill="currentColor"></circle>
              <circle cx="15.5" cy="11.5" r="1" fill="currentColor"></circle>
            </svg>
          </span>
          <span className="chatbot-badge">اے آئی رہنما</span>
          <span className="drag-pill-indicator" title="کھینچ کر منتقل کریں (Drag to move)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.65">
              <circle cx="9" cy="6" r="2" />
              <circle cx="15" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="18" r="2" />
              <circle cx="15" cy="18" r="2" />
            </svg>
          </span>
        </button>
      )}

      {/* Slide-out Drawer Popup Modal */}
      {isOpen && (
        <div
          ref={drawerRef}
          className={`ai-chatbot-drawer ${isDragging && activeDragTarget === 'drawer' ? 'is-dragging' : ''}`}
          style={{
            left: `${drawerPos.x}px`,
            top: `${drawerPos.y}px`,
            bottom: 'auto',
            right: 'auto'
          }}
          onPointerDown={(e) => handlePointerDown(e, 'drawer')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Header & Primary Drag Handle */}
          <div
            className="ai-chatbot-header"
            onDoubleClick={handleResetPosition}
            title="کھینچ کر کہیں بھی منتقل کریں (ڈبل کلک سے اصل جگہ ری سیٹ کریں)"
          >
            <div className="header-info">
              <div className="drag-handle-grip" aria-hidden="true" title="کھینچ کر منتقل کریں (Drag to move)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="2" />
                  <circle cx="15" cy="6" r="2" />
                  <circle cx="9" cy="12" r="2" />
                  <circle cx="15" cy="12" r="2" />
                  <circle cx="9" cy="18" r="2" />
                  <circle cx="15" cy="18" r="2" />
                </svg>
              </div>
              <div className="bot-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                </svg>
              </div>
              <div>
                <h3 className="bot-title">اے آئی رہنما</h3>
                <span className="bot-status">آن لائن | تعلیمی رہنما</span>
              </div>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="clear-chat-btn"
                onClick={handleClearChat}
                title="گفتگو صاف کریں"
                aria-label="گفتگو صاف کریں"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={handleToggle}
                title="بند کریں"
                aria-label="بند کریں"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="ai-chatbot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}
              >
                <div className="chat-bubble">
                  <div className="chat-bubble-text">
                    {renderFormattedText(msg.text)}
                  </div>
                  <span className="chat-timestamp">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="chat-bubble-wrapper bot-msg">
                <div className="chat-bubble typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preset Suggested Prompt Chips */}
          <div className="ai-chatbot-prompts">
            <div className="prompts-grid-container">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  className="prompt-chip"
                  onClick={() => handleSend(prompt.text)}
                >
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input Footer */}
          <div className="ai-chatbot-footer">
            <input
              type="text"
              className="chatbot-input"
              placeholder="اپنا سوال یہاں لکھیں..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="chatbot-send-btn"
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              title="ارسال کریں"
              aria-label="ارسال کریں"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
