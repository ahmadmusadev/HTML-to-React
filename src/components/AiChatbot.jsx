import React, { useState, useEffect, useRef } from 'react';
import './AiChatbot.css';
import {
  SUGGESTED_PROMPTS,
  KNOWLEDGE_BASE,
  normalizeUrduText,
  analyzeKnowledgeQuery,
  findBestKnowledgeMatch,
} from './aiRehnumaKnowledge';

export {
  SUGGESTED_PROMPTS,
  KNOWLEDGE_BASE,
  normalizeUrduText,
  analyzeKnowledgeQuery,
  findBestKnowledgeMatch,
};

// Helper to query Gemini/OpenAI with strict pure-Urdu domain prompt (never mentions AI Ustad)
async function fetchLlmResponse(query) {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const systemInstruction = `You are AI Rehnuma (اے آئی رہنما), an exclusive user-guide assistant for the Jamia Hifz Manager (جامعہ حفظ منیجر) institution management application.
Scope: Help users navigate and understand ONLY these active modules:
1. Dashboard (ڈیش بورڈ)
2. Admissions & Classes & Bulk Import/Export (داخلہ جات)
3. Fee Records, Receipts & 5 Financial Reports (فیس ریکارڈ)
4. Monthly Evaluations, Monthly Literacy, 4-Year Half-Yearly Hifz & Mizan (جائزہ جات)
5. Student Attendance & Staff Two-Step Check-in/Check-out Attendance (حاضری)
6. Exams Miqdar-e-Khwandgi & Class/Individual Results (امتحانات)
7. Educational Records: Para-by-Para 30 Paras, Half-Yearly Summary, Cumulative Hifz Form & Daily Academic Performance (تعلیمی ریکارڈز)
8. Staff Management & Teacher Account Creation (اسٹاف)
9. Payroll Settings, Holidays, Opening Leave & Monthly Calculation (تنخواہ)
10. Tasks & Reminders (زیرِ غور و یادداشت)
11. Super Admin (سپر ایڈمن)
12. Login, Profile, Logo, Password & Theme Settings

CRITICAL RULES:
- Respond ONLY in pure, authentic Urdu. Avoid English words, transliterated English words, and never use emojis.
- NEVER mention AI Ustad or AI Listen (اے آئی استاد) anywhere.
- If the user asks anything outside this Jamia Hifz Manager system domain, politely decline in pure Urdu:
"معذرت! یہ سوال جامعہ حفظ منیجر نظامِ مدرسہ کے دائرہ کار سے باہر ہے۔ میں صرف اس نظام کی سہولیات اور استعمال سے متعلق رہنمائی فراہم کر سکتا ہوں۔"`;

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
        return clampPosition(pos.x, pos.y, 54, 54);
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

const WELCOME_MESSAGE = {
  id: 'welcome-1',
  sender: 'bot',
  text: 'السلام علیکم! میں آپ کا **اے آئی رہنما** ہوں۔ جامعہ حفظ منیجر نظامِ مدرسہ کے استعمال، شعبہ جات اور حسابی ضابطوں سے متعلق کوئی بھی سوال پوچھیے یا نیچے تجویز کردہ سوالات میں سے انتخاب کیجیے۔',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);

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
      if (e.target.closest('button, input, textarea, .prompt-chip, .bot-suggestion-btn, a, .ai-chatbot-messages')) {
        return;
      }
    }

    const currentPos = targetType === 'trigger' ? triggerPos : drawerPos;
    const targetElem = targetType === 'trigger' ? triggerRef.current : drawerRef.current;
    const rect = targetElem?.getBoundingClientRect();
    const elemWidth = (rect?.width && rect.width > 0) ? rect.width : (targetType === 'trigger' ? 54 : 410);
    const elemHeight = (rect?.height && rect.height > 0) ? rect.height : (targetType === 'trigger' ? 54 : 600);

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
        const targetX = triggerPos.x;
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

  const appendBotReply = (replyText, suggestions = []) => {
    setTimeout(() => {
      const botMsg = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: replyText,
        suggestions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 320);
  };

  const handleSelectSuggestion = (suggestion) => {
    const matchedItem = KNOWLEDGE_BASE.find(item => item.id === suggestion.id);
    if (!matchedItem) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: matchedItem.topic,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    appendBotReply(matchedItem.response);
  };

  const handleSend = async (queryText) => {
    const textToSend = typeof queryText === 'string' ? queryText : inputText;
    if (!textToSend || !textToSend.trim()) return;

    const trimmedQuery = textToSend.trim();
    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: trimmedQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Check if query exactly matches a suggested prompt with a known topicId
    const matchedPrompt = SUGGESTED_PROMPTS.find(p => p.text === trimmedQuery && p.topicId);
    if (matchedPrompt) {
      const directItem = KNOWLEDGE_BASE.find(item => item.id === matchedPrompt.topicId);
      if (directItem) {
        appendBotReply(directItem.response);
        return;
      }
    }

    // Analyze intent and confidence
    const analysis = analyzeKnowledgeQuery(trimmedQuery);

    if (analysis.status === 'matched' && analysis.bestMatch) {
      appendBotReply(analysis.bestMatch.response);
      return;
    }

    if (analysis.status === 'ambiguous' && analysis.suggestions.length > 0) {
      const clarificationText = `آپ کا سوال تھوڑا عمومی یا غیر واضح ہے۔ برائے مہربانی نیچے دیے گئے قریبی موضوعات میں سے متعلقہ موضوع منتخب کریں یا اپنا سوال مزید واضح کر کے لکھیں:`;
      const suggestionChips = analysis.suggestions.map(item => ({
        id: item.id,
        topic: item.topic
      }));
      appendBotReply(clarificationText, suggestionChips);
      return;
    }

    // Fallback to LLM or strict pure-Urdu domain restriction message
    const apiReply = await fetchLlmResponse(trimmedQuery);
    const outOfScopeText = apiReply || `معذرت! یہ سوال جامعہ حفظ منیجر نظامِ مدرسہ کے دائرہ کار سے باہر ہے۔ میں صرف اس نظام کی سہولیات اور استعمال سے متعلق رہنمائی فراہم کر سکتا ہوں۔

برائے مہربانی نظام کے متعلقہ شعبہ جات (ڈیش بورڈ، داخلہ جات، فیس ریکارڈ، جائزہ جات، حاضری، امتحانات، تعلیمی ریکارڈز، اسٹاف، تنخواہ، یا زیرِ غور و یادداشت) کے بارے میں سوال پوچھیے۔`;

    appendBotReply(outOfScopeText);
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
        text: 'گفتگو صاف کر دی گئی ہے۔ اب آپ نظامِ مدرسہ سے متعلق نیا سوال پوچھ سکتے ہیں۔',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Render **bold** and `inline code` cleanly without raw markdown characters
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*|`[^`]+`)/g);
      return (
        <React.Fragment key={lineIdx}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
              return <code key={partIdx} className="chat-inline-code">{part.slice(1, -1)}</code>;
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
          aria-label="اے آئی رہنما کھولیں یا بند کریں"
        >
          <span className="chatbot-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10a9.96 9.96 0 0 1-4.587-1.11L2 22l1.11-5.413A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2z"></path>
              <circle cx="8.5" cy="11.5" r="1" fill="currentColor"></circle>
              <circle cx="12" cy="11.5" r="1" fill="currentColor"></circle>
              <circle cx="15.5" cy="11.5" r="1" fill="currentColor"></circle>
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
            title="کھینچ کر کہیں بھی منتقل کریں (دو بار دبانے سے اصل جگہ بحال ہوگی)"
          >
            <div className="header-info">
              <div className="drag-handle-grip" aria-hidden="true" title="کھینچ کر منتقل کریں">
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
                <span className="bot-status">ہمہ وقت دستیاب | نظامِ مدرسہ رہنما</span>
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
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="bot-suggestions-container" role="group" aria-label="متعلقہ قریبی موضوعات">
                      {msg.suggestions.map((sug) => (
                        <button
                          key={sug.id}
                          type="button"
                          className="bot-suggestion-btn"
                          onClick={() => handleSelectSuggestion(sug)}
                        >
                          {sug.topic}
                        </button>
                      ))}
                    </div>
                  )}
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
