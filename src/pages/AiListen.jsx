import React, { useState, useEffect, useRef } from 'react';

export default function AiListen() {
  const [currentSurah, setCurrentSurah] = useState(1);
  const [currentAyah, setCurrentAyah] = useState(1);
  const [targetAyahText, setTargetAyahText] = useState('');
  const [ayahLoadStatus, setAyahLoadStatus] = useState('');
  
  const [aiListening, setAiListening] = useState(false);
  const aiListeningRef = useRef(false);
  
  const [finalRecitedText, setFinalRecitedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [micStatusText, setMicStatusText] = useState('تلاوت شروع کرنے کے لیے مائیک دبائیں');
  const [micStatusColor, setMicStatusColor] = useState('#666');
  
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  
  const [score, setScore] = useState(0);
  const [compareRes, setCompareRes] = useState([]);
  const [aiFeedback, setAiFeedback] = useState('');
  
  const recognitionRef = useRef(null);
  const referenceAudioRef = useRef(null);
  const qariAudioRef = useRef(null);
  const analysisPanelRef = useRef(null);

  // Auto load target Ayah on mount
  useEffect(() => {
    loadTargetAyah(currentSurah, currentAyah);
  }, []);

  // Debounced load on Ayah input change
  const handleAyahInputChange = (val) => {
    const num = parseInt(val) || 1;
    setCurrentAyah(num);
    clearTimeout(window._ayahDebounce);
    window._ayahDebounce = setTimeout(() => {
      loadTargetAyah(currentSurah, num);
    }, 600);
  };

  const handleSurahChange = (val) => {
    const surahNum = parseInt(val) || 1;
    setCurrentSurah(surahNum);
    loadTargetAyah(surahNum, currentAyah);
  };

  const loadTargetAyah = async (surah, ayah) => {
    setAyahLoadStatus('لوڈ ہو رہا ہے...');
    setTargetAyahText('');
    
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.uthmani`);
      const data = await res.json();
      if (data.code === 200) {
        setTargetAyahText(data.data.text);
        setAyahLoadStatus('آیت تیار ہے');
        updateReferenceAudio(surah, ayah);
      } else {
        setAyahLoadStatus('❌ آیت نہیں ملی — نمبر چیک کریں');
        setTargetAyahText('');
      }
    } catch (e) {
      setAyahLoadStatus('❌ انٹرنیٹ کنکشن چیک کریں');
      setTargetAyahText('');
    }
  };

  const updateReferenceAudio = (surah, ayah) => {
    const s = String(surah).padStart(3, '0');
    const a = String(ayah).padStart(3, '0');
    const url = `https://verses.quran.com/Alafasy/mp3/${s}${a}.mp3`;
    if (referenceAudioRef.current) referenceAudioRef.current.src = url;
    if (qariAudioRef.current) qariAudioRef.current.src = url;
  };

  const playReferenceAudio = () => {
    if (referenceAudioRef.current) {
      if (!referenceAudioRef.current.src || referenceAudioRef.current.src === window.location.href) {
        updateReferenceAudio(currentSurah, currentAyah);
      }
      referenceAudioRef.current.play().catch(() => {});
    }
  };

  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('آپ کا براؤزر مائیک سپورٹ نہیں کرتا۔ براہ کرم Chrome استعمال کریں۔');
      return null;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      aiListeningRef.current = true;
      setAiListening(true);
      setFinalRecitedText('');
      setInterimText('');
      setMicStatusText('تلاوت سنی جا رہی ہے... (رکنے کے لیے دوبارہ دبائیں)');
      setMicStatusColor('#d32f2f');
      setShowAnalysisPanel(false);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalStr = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setFinalRecitedText(prev => prev ? prev + ' ' + finalStr : finalStr);
      setInterimText(interim);
    };

    recognition.onerror = (ev) => {
      if (ev.error === 'no-speech') return;
      stopAiListeningState();
      setMicStatusText('مائیک میں مسئلہ: ' + ev.error + ' — دوبارہ کوشش کریں');
      setMicStatusColor('#c62828');
    };

    recognition.onend = () => {
      if (aiListeningRef.current) {
        try { recognition.start(); } catch(e) {}
      } else {
        stopAiListeningState();
      }
    };

    return recognition;
  };

  const stopAiListeningState = () => {
    aiListeningRef.current = false;
    setAiListening(false);
    setMicStatusText('تلاوت مکمل — اب "غلطیاں چیک کریں" دبائیں');
    setMicStatusColor('#2e7d32');
  };

  const toggleAiListening = () => {
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }
    if (!recognitionRef.current) return;

    if (aiListeningRef.current) {
      aiListeningRef.current = false;
      setAiListening(false);
      recognitionRef.current.stop();
    } else {
      if (!targetAyahText) {
        loadTargetAyah(currentSurah, currentAyah).then(() => {
          try { recognitionRef.current.start(); } catch(e) {}
        });
      } else {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    }
  };

  const normalizeArabic = (text) => {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '')  // harakat
      .replace(/أ|إ|آ/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    const dp = Array.from({length: m+1}, (_,i) => Array.from({length: n+1}, (_,j) => i===0?j:j===0?i:0));
    for (let i=1; i<=m; i++) {
      for(let j=1; j<=n; j++) {
        dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  };

  const compareWords = (targetWords, recitedWords) => {
    const results = [];
    const maxLen = Math.max(targetWords.length, recitedWords.length);
    for (let i = 0; i < maxLen; i++) {
      const tw = targetWords[i] || null;
      const rw = recitedWords[i] || null;
      if (!tw) {
        results.push({ target: null, recited: rw, status: 'extra' });
        continue;
      }
      if (!rw) {
        results.push({ target: tw, recited: null, status: 'missing' });
        continue;
      }
      const nt = normalizeArabic(tw);
      const nr = normalizeArabic(rw);
      if (nt === nr) {
        results.push({ target: tw, recited: rw, status: 'correct' });
      } else {
        const dist = levenshtein(nt, nr);
        const ratio = dist / Math.max(nt.length, nr.length);
        results.push({ target: tw, recited: rw, status: ratio < 0.4 ? 'close' : 'wrong' });
      }
    }
    return results;
  };

  const analyseRecitation = async () => {
    const recited = finalRecitedText.trim();
    if (!recited) {
      alert('پہلے تلاوت کریں اور پھر چیک کریں۔');
      return;
    }
    if (!targetAyahText) {
      alert('پہلے آیت لوڈ کریں۔');
      return;
    }

    setShowAnalysisPanel(true);
    setIsLoadingAnalysis(true);
    
    setTimeout(() => {
      if (analysisPanelRef.current) {
        analysisPanelRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    const targetWords = targetAyahText.trim().split(/\s+/);
    const recitedWords = recited.trim().split(/\s+/);
    const results = compareWords(targetWords, recitedWords);
    
    const correctCount = results.filter(r => r.status === 'correct').length;
    const totalTarget = results.filter(r => r.target).length;
    const calcScore = totalTarget > 0 ? Math.round((correctCount / totalTarget) * 100) : 0;
    
    setCompareRes(results);
    setScore(calcScore);
    setAiFeedback('');

    try {
      const wrongWords = results.filter(r => r.status === 'wrong').map(r => `"${r.recited || '?'}" بجائے "${r.target || '?'}"`);
      const missingWords = results.filter(r => r.status === 'missing').map(r => `"${r.target}"`);
      
      const prompt = `آپ ایک قرآن کے ماہر استاد ہیں جو بچوں کو تجوید سکھاتے ہیں۔ آپ نے ایک طالب علم کی تلاوت سنی۔

آیت: "${targetAyahText}"
طالب علم نے پڑھا: "${recited}"
درست الفاظ: ${correctCount} / ${totalTarget}
${wrongWords.length > 0 ? `غلط الفاظ: ${wrongWords.join(' ، ')}` : ''}
${missingWords.length > 0 ? `بھولے ہوئے الفاظ: ${missingWords.join(' ، ')}` : ''}

براہ کرم اردو میں ایک مختصر مگر پرجوش تبصرہ دیں جیسے ایک اصل استاد دیتا ہے۔ پہلے حوصلہ افزائی کریں، پھر غلطیاں بتائیں، آخر میں مشورہ دیں۔ تجوید کے اصول بھی ذکر کریں اگر متعلقہ ہوں۔ جواب 100-150 الفاظ میں رکھیں۔`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      
      if (data.content && data.content[0]) {
        setAiFeedback(data.content[0].text);
      } else {
        setAiFeedback(calcScore >= 80 
          ? 'ماشاءاللہ! آپ کی تلاوت بہت اچھی ہے۔ اللہ تعالیٰ آپ کو مزید برکت دے۔' 
          : '⚠️ کچھ الفاظ درست نہیں ہوئے۔ پہلے آیت ذہن میں پکی کریں، پھر دوبارہ سنائیں۔');
      }
    } catch (e) {
      setAiFeedback(calcScore >= 80 
        ? 'ماشاءاللہ! آپ کی تلاوت بہت اچھی ہے۔ اللہ تعالیٰ آپ کو مزید برکت دے۔' 
        : '⚠️ کچھ الفاظ درست نہیں ہوئے۔ پہلے آیت ذہن میں پکی کریں، پھر دوبارہ سنائیں۔');
    }

    updateReferenceAudio(currentSurah, currentAyah);
    setIsLoadingAnalysis(false);
  };

  const resetAiSession = () => {
    setFinalRecitedText('');
    setInterimText('');
    setShowAnalysisPanel(false);
    setMicStatusText('تلاوت شروع کرنے کے لیے مائیک دبائیں');
    setMicStatusColor('#666');
  };

  const scoreColor = score >= 80 ? '#2e7d32' : score >= 50 ? '#f57f17' : '#c62828';
  const scoreEmoji = score >= 80 ? 'ماشاءاللہ!' : score >= 50 ? 'کوشش جاری رکھیں' : 'مزید مشق کریں';

  return (
    <div className="tab-content" id="tab-ai-listen">
      
      {/* ===== ہیڈر ===== */}
      <div style={{ background: "linear-gradient(135deg, #2e7d32, #1b5e20)", boxShadow: "0 4px 15px rgba(27,94,32,0.3)", borderRadius: "12px", padding: "25px", color: "white", marginBottom: "20px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "white", fontSize: "1.8rem" }}>اے آئی استاد</h2>
        <p style={{ margin: "0", fontSize: "1rem", opacity: "0.9" }}>اپنی تلاوت سنائیں — آئی استاد غلطیاں پکڑ کر اردو میں بتائے گا</p>
      </div>

      {/* ===== سورت / آیت انتخاب ===== */}
      <div style={{ background: "white", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "16px" }}>
        <div className="grid-row" style={{ marginBottom: "12px" }}>
          <div>
            <label style={{ fontWeight: "700", color: "var(--accent)" }}>سورت منتخب کریں</label>
            <select id="aiSurahSelect" value={currentSurah} onChange={(e) => handleSurahChange(e.target.value)} style={{ marginTop: "6px" }}>
              <option value="1">۱ — سورۃ الفاتحہ</option>
              <option value="2">۲ — سورۃ البقرۃ</option>
              <option value="3">۳ — سورۃ آل عمران</option>
              <option value="4">۴ — سورۃ النساء</option>
              <option value="5">۵ — سورۃ المائدۃ</option>
              <option value="6">۶ — سورۃ الانعام</option>
              <option value="18">۱۸ — سورۃ الکہف</option>
              <option value="19">۱۹ — سورۃ مریم</option>
              <option value="36">۳۶ — سورۃ یس</option>
              <option value="55">۵۵ — سورۃ الرحمن</option>
              <option value="56">۵۶ — سورۃ الواقعہ</option>
              <option value="67">۶۷ — سورۃ الملک</option>
              <option value="78">۷۸ — سورۃ النبأ</option>
              <option value="112">۱۱۲ — سورۃ الاخلاص</option>
              <option value="113">۱۱۳ — سورۃ الفلق</option>
              <option value="114">۱۱۴ — سورۃ الناس</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: "700", color: "var(--accent)" }}>آیت نمبر</label>
            <input type="number" id="aiAyahInput" value={currentAyah} onChange={(e) => handleAyahInputChange(e.target.value)} min="1" max="286" style={{ marginTop: "6px" }} />
          </div>
        </div>
        
        {/* آیت display */}
        <div id="targetAyahBox" style={{ background: "#f8fff8", border: "2px solid #c8e6c9", borderRadius: "10px", padding: "16px", minHeight: "60px", textAlign: "right", fontSize: "1.7rem", lineHeight: "2.5", color: "#1b5e20", fontFamily: "'Noto Naskh Arabic','Arial',sans-serif", direction: "rtl", marginBottom: "10px" }}>
          {targetAyahText ? (
            <span>{targetAyahText}</span>
          ) : (
            <span style={{ color: "#aaa", fontSize: "1rem" }}>آیت لوڈ ہو رہی ہے...</span>
          )}
        </div>
        
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={() => loadTargetAyah(currentSurah, currentAyah)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "8px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" }}>آیت لائیں</button>
          <button id="playRefBtn" onClick={playReferenceAudio} style={{ background: "#1565c0", color: "white", border: "none", padding: "8px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" }} title="صحیح تلاوت سنیں">صحیح تلاوت سنیں</button>
          <audio ref={referenceAudioRef} id="referenceAudio" style={{ display: "none" }}></audio>
          <span id="ayahLoadStatus" style={{ fontSize: "0.85rem", color: "#666" }}>{ayahLoadStatus}</span>
        </div>
      </div>

      {/* ===== مائیک سیکشن ===== */}
      <div style={{ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "16px", textAlign: "center" }}>
        <p style={{ color: "#555", margin: "0 0 12px 0", fontSize: "1rem" }}>آیت یاد کر لیں، پھر نیچے مائیک دبائیں اور تلاوت شروع کریں</p>
        <button id="micBtn" className={`mic-btn ${aiListening ? 'listening' : ''}`} onClick={toggleAiListening} title="پڑھنا شروع کرنے کے لیے دبائیں">🎙️</button>
        <div id="micStatusText" style={{ color: micStatusColor, marginTop: "8px", fontSize: "1rem" }}>{micStatusText}</div>
        
        {/* لائیو ٹرانسکرپٹ */}
        <div style={{ marginTop: "16px", textAlign: "right" }}>
          <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "6px", textAlign: "right" }}>آپ کی آواز (Live):</div>
          <div className="transcript-box" id="transcriptOutput" style={{ minHeight: "80px", fontSize: "1.5rem" }}>
            {!finalRecitedText && !interimText ? (
              <span style={{ color: "#bbb", fontSize: "1rem" }}>یہاں آپ کی تلاوت ظاہر ہوگی...</span>
            ) : (
              <>
                <span style={{ color: "#1b5e20", fontWeight: "600" }}>{finalRecitedText} </span>
                {interimText && <span style={{ color: "#888", fontStyle: "italic" }}>{interimText}</span>}
              </>
            )}
          </div>
        </div>

        {/* تجزیہ بٹن */}
        {!aiListening && finalRecitedText.trim().length > 0 && (
          <button id="analyseBtn" onClick={analyseRecitation} style={{ background: "linear-gradient(135deg,#2e7d32,#1b5e20)", color: "white", border: "none", padding: "12px 30px", borderRadius: "10px", cursor: "pointer", fontSize: "1rem", fontWeight: "700", marginTop: "14px", width: "100%", maxWidth: "300px" }}>
            غلطیاں چیک کریں
          </button>
        )}
      </div>

      {/* ===== نتیجہ پینل ===== */}
      {showAnalysisPanel && (
        <div id="aiAnalysisPanel" ref={analysisPanelRef} className={`ai-analysis-panel ${score < 80 && !isLoadingAnalysis ? 'error-mode' : ''}`} style={{ display: 'block' }}>
          
          {/* لوڈنگ */}
          {isLoadingAnalysis ? (
            <div id="aiLoadingState" style={{ textAlign: "center", padding: "30px", display: "block" }}>
              <p style={{ color: "#555", fontSize: "1.1rem" }}>اے آئی استاد آپ کی تلاوت جانچ رہا ہے...</p>
            </div>
          ) : (
            <div id="aiResultState" style={{ display: "block" }}>
              {/* سکور بار */}
              <div id="scoreArea" style={{ marginBottom: "20px" }}>
                <div style={{ textAlign: "center", padding: "12px", background: `${scoreColor}15`, borderRadius: "10px", border: `2px solid ${scoreColor}40` }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: "800", color: scoreColor }}>{score}%</div>
                  <div style={{ color: scoreColor, fontSize: "1.1rem", fontWeight: "600" }}>{scoreEmoji}</div>
                  <div style={{ background: "#e0e0e0", borderRadius: "20px", height: "10px", marginTop: "10px", overflow: "hidden" }}>
                    <div style={{ background: scoreColor, height: "100%", width: `${score}%`, borderRadius: "20px", transition: "width 1s" }}></div>
                  </div>
                </div>
              </div>
              
              {/* الفاظ کا موازنہ */}
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "var(--accent)", margin: "0 0 10px 0", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>لفظ بہ لفظ جائزہ</h4>
                <div id="wordCompareArea" style={{ background: "#f8f9fa", borderRadius: "8px", padding: "16px", fontSize: "1.4rem", lineHeight: "3", textAlign: "right", direction: "rtl", fontFamily: "'Noto Naskh Arabic','Arial',sans-serif" }}>
                  {compareRes.map((r, i) => {
                    if (r.status === 'correct') return <span key={i} style={{ color: "#2e7d32", background: "#e8f5e9", padding: "3px 6px", borderRadius: "5px", margin: "3px", display: "inline-block" }}>{r.target}</span>;
                    if (r.status === 'missing') return <span key={i} title="بھول گئے" style={{ color: "#c62828", background: "#ffebee", padding: "3px 6px", borderRadius: "5px", margin: "3px", display: "inline-block", textDecoration: "line-through", opacity: "0.7" }}>{r.target}</span>;
                    if (r.status === 'close') return <span key={i} title={`آپ نے پڑھا: ${r.recited}`} style={{ color: "#f57f17", background: "#fff8e1", padding: "3px 6px", borderRadius: "5px", margin: "3px", display: "inline-block", borderBottom: "2px solid #f57f17" }}>{r.target}</span>;
                    return <span key={i} title={`آپ نے پڑھا: ${r.recited}`} style={{ color: "#c62828", background: "#ffebee", padding: "3px 6px", borderRadius: "5px", margin: "3px", display: "inline-block", borderBottom: "2px dashed #c62828", fontWeight: "700" }}>{r.target}</span>;
                  })}
                  {compareRes.length === 0 && <span style={{ color: "#888" }}>الفاظ کا موازنہ نہیں ہو سکا</span>}
                </div>
                <div style={{ marginTop: "10px", display: "flex", gap: "16px", fontSize: "0.85rem", flexWrap: "wrap" }}>
                  <span><span style={{ color: "#2e7d32", fontWeight: "700" }}>درست</span></span>
                  <span><span style={{ color: "#c62828", fontWeight: "700" }}>غلط / بھولا</span></span>
                  <span><span style={{ color: "#f57f17", fontWeight: "700" }}>ملتا جلتا</span></span>
                </div>
              </div>

              {/* اے آئی فیڈ بیک */}
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: "#1565c0", margin: "0 0 10px 0", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>🧑‍استاد کا تبصرہ</h4>
                <div id="aiFeedbackArea" style={{ background: "#e8f4fd", borderRadius: "8px", padding: "16px", fontSize: "1rem", lineHeight: "1.9", color: "#1a237e", borderRight: "4px solid #1565c0", direction: "rtl", textAlign: "right", whiteSpace: "pre-line" }}>
                  {aiFeedback || 'استاد کا تبصرہ آ رہا ہے...'}
                </div>
              </div>

              {/* صحیح تلاوت */}
              <div style={{ background: "#f1f8e9", borderRadius: "8px", padding: "14px", marginBottom: "12px" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#33691e" }}>صحیح تلاوت دوبارہ سنیں</h4>
                <audio ref={qariAudioRef} id="qariAudio" controls style={{ width: "100%" }}></audio>
              </div>

              {/* دوبارہ کوشش */}
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <button onClick={resetAiSession} style={{ background: "#546e7a", color: "white", border: "none", padding: "10px 25px", borderRadius: "8px", cursor: "pointer", fontSize: "0.95rem" }}>دوبارہ سنائیں</button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
