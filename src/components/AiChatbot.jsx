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
    response: `📝 **نئے طالب علم کے داخلہ کا طریقہ کار:**
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
    response: `📖 **روزانہ کا سبق، سبقی اور منزل درج کرنے کا طریقہ:**
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
    response: `💳 **فیس کا ریکارڈ اور رسید جاری کرنے کا طریقہ:**
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
    response: `📅 **روزانہ کی حاضری مارک کرنے کا طریقہ:**
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
    response: `👨‍🏫 **نئے استاد یا اسٹاف رکن کا اکاؤنٹ بنانے کا طریقہ:**
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
    response: `✍️ **امتحانات اور نتائج کے اندراج کا طریقہ:**
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
    response: `📁 **تعلیمی ریکارڈز اور کارڈز حاصل کرنے کا طریقہ:**
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
    response: `🎙️ **اے آئی استاد کے استعمال کا طریقہ:**
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
    response: `📊 **ڈیش بورڈ کا جائزہ:**
1. **'ڈیش بورڈ'** (Dashboard) پر مدرسے کے کل طلباء، فعال کلاسز، اور حاضری کی شرح کے احصائیات ظاہر ہوتے ہیں۔
2. ہیڈر کنٹرولز سے آپ مدرسے کا لوگو اپ لوڈ یا شاخ (Branch) کو تبدیل اور رینیم کر سکتے ہیں۔`
  },
  {
    id: 'greeting',
    topic: 'خوش آمدید',
    primaryKeywords: ['سلام', 'السلام', 'ہیلو', 'hello', 'hi', 'assalam', 'aoa', 'کون', 'رہنما'],
    primaryPhrases: ['السلام علیکم', 'ہیلو'],
    secondaryKeywords: ['تعارف', 'مدد'],
    response: `وعلیکم السلام ورحمۃ اللہ وبرکاتہ! 🌸
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

  const messagesEndRef = useRef(null);

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

  const handleToggle = () => {
    setIsOpen(prev => !prev);
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
      // Split line by ** patterns
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
          type="button"
          className="ai-chatbot-trigger"
          onClick={handleToggle}
          title="اے آئی رہنما"
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
        </button>
      )}

      {/* Slide-out Drawer Popup Modal */}
      {isOpen && (
        <div className="ai-chatbot-drawer">
          {/* Header */}
          <div className="ai-chatbot-header">
            <div className="header-info">
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

          {/* Preset Suggested Prompt Chips (2-3 Rows, No Scrollbar) */}
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
