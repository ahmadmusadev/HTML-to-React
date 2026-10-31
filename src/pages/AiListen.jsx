import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SURAHS, PARAS } from '../constants/quranMetadata';
import { alignRecitation, calculateRecitationStats } from '../utils/quranAlignment';
import './AiListen.css';

export default function AiListen() {
  // Mode selection: 'surah' or 'para'
  const [selectMode, setSelectMode] = useState('surah');

  // Surah & Ayah state
  const [currentSurah, setCurrentSurah] = useState(1);
  const [currentAyah, setCurrentAyah] = useState(1);
  const [currentPara, setCurrentPara] = useState(1);

  // Quran Ayah text & loading state
  const [targetAyahText, setTargetAyahText] = useState('');
  const [ayahLoadStatus, setAyahLoadStatus] = useState('');
  const [isLoadingAyah, setIsLoadingAyah] = useState(false);

  // Speech Recognition & Recording state
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [finalRecitedText, setFinalRecitedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [micStatusText, setMicStatusText] = useState('تلاوت سنانے کے لیے مائیک دبائیں');
  const [micStatusColor, setMicStatusColor] = useState('#2e7d32');

  // MediaRecorder for student audio playback
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [studentAudioUrl, setStudentAudioUrl] = useState(null);

  // Reference Qari Audio
  const referenceAudioRef = useRef(null);
  const [isPlayingRefAudio, setIsPlayingRefAudio] = useState(false);

  // Results & Analysis state
  const [showReport, setShowReport] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [alignedWords, setAlignedWords] = useState([]);
  const [stats, setStats] = useState(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [selectedWordDetail, setSelectedWordDetail] = useState(null);

  // Refs
  const recognitionRef = useRef(null);
  const reportPanelRef = useRef(null);
  const debounceRef = useRef(null);

  // Current Surah details
  const currentSurahMeta = useMemo(() => {
    return SURAHS.find((s) => s.id === currentSurah) || SURAHS[0];
  }, [currentSurah]);

  // Load Ayah on initial render
  useEffect(() => {
    loadAyah(currentSurah, currentAyah);
    return () => {
      clearTimeout(debounceRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (studentAudioUrl) {
        URL.revokeObjectURL(studentAudioUrl);
      }
    };
  }, []);

  // Update Reference Qari audio url
  const updateReferenceAudio = (surahNum, ayahNum) => {
    const s = String(surahNum).padStart(3, '0');
    const a = String(ayahNum).padStart(3, '0');
    const url = `https://verses.quran.com/Alafasy/mp3/${s}${a}.mp3`;
    if (referenceAudioRef.current) {
      referenceAudioRef.current.src = url;
    }
    return url;
  };

  // Fetch Ayah text from AlQuran Cloud
  const loadAyah = async (surahNum, ayahNum) => {
    setIsLoadingAyah(true);
    setAyahLoadStatus('لوڈ ہو رہا ہے...');
    resetSession();

    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/ar.uthmani`);
      const data = await res.json();
      if (data.code === 200) {
        setTargetAyahText(data.data.text);
        setAyahLoadStatus('آیت تیار ہے');
        updateReferenceAudio(surahNum, ayahNum);
      } else {
        setAyahLoadStatus('آیت نہیں ملی — نمبر چیک کریں');
        setTargetAyahText('');
      }
    } catch {
      setAyahLoadStatus('انٹرنیٹ کنکشن چیک کریں');
      setTargetAyahText('');
    } finally {
      setIsLoadingAyah(false);
    }
  };

  // Surah Change Handler
  const handleSurahChange = (val) => {
    const num = parseInt(val, 10) || 1;
    setCurrentSurah(num);
    setCurrentAyah(1);
    loadAyah(num, 1);
  };

  // Para (Juz) Change Handler
  const handleParaChange = (val) => {
    const paraId = parseInt(val, 10) || 1;
    setCurrentPara(paraId);
    const paraMeta = PARAS.find((p) => p.id === paraId);
    if (paraMeta) {
      setCurrentSurah(paraMeta.surah);
      setCurrentAyah(paraMeta.ayah);
      loadAyah(paraMeta.surah, paraMeta.ayah);
    }
  };

  // Ayah Input Change Handler with debounce
  const handleAyahChange = (val) => {
    const maxAyahs = currentSurahMeta.ayahs;
    let num = parseInt(val, 10) || 1;
    if (num < 1) num = 1;
    if (num > maxAyahs) num = maxAyahs;

    setCurrentAyah(num);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadAyah(currentSurah, num);
    }, 500);
  };

  // Next / Previous Ayah navigation
  const goToNextAyah = () => {
    if (currentAyah < currentSurahMeta.ayahs) {
      const nextAyah = currentAyah + 1;
      setCurrentAyah(nextAyah);
      loadAyah(currentSurah, nextAyah);
    } else if (currentSurah < 114) {
      const nextSurah = currentSurah + 1;
      setCurrentSurah(nextSurah);
      setCurrentAyah(1);
      loadAyah(nextSurah, 1);
    }
  };

  const goToPrevAyah = () => {
    if (currentAyah > 1) {
      const prevAyah = currentAyah - 1;
      setCurrentAyah(prevAyah);
      loadAyah(currentSurah, prevAyah);
    } else if (currentSurah > 1) {
      const prevSurah = currentSurah - 1;
      const prevSurahMeta = SURAHS.find((s) => s.id === prevSurah);
      const prevAyah = prevSurahMeta ? prevSurahMeta.ayahs : 1;
      setCurrentSurah(prevSurah);
      setCurrentAyah(prevAyah);
      loadAyah(prevSurah, prevAyah);
    }
  };

  // Play Reference Qari Audio
  const togglePlayRefAudio = () => {
    if (!referenceAudioRef.current) return;
    if (isPlayingRefAudio) {
      referenceAudioRef.current.pause();
      setIsPlayingRefAudio(false);
    } else {
      referenceAudioRef.current
        .play()
        .then(() => setIsPlayingRefAudio(true))
        .catch(() => setIsPlayingRefAudio(false));
    }
  };

  // Speech Recognition Initialization
  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('آپ کے براؤزر میں مائیکروفون اسپیچ انجن دستیاب نہیں ہے۔ براہ کرم Google Chrome یا Microsoft Edge استعمال کریں۔');
      return null;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setFinalRecitedText('');
      setInterimText('');
      setMicStatusText('تلاوت سنی جا رہی ہے... (مکمل کرنے کے لیے دوبارہ مائیک دبائیں)');
      setMicStatusColor('#d32f2f');
      setShowReport(false);
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
      if (finalStr) {
        setFinalRecitedText((prev) => (prev ? prev + ' ' + finalStr : finalStr));
      }
      setInterimText(interim);
    };

    recognition.onerror = (ev) => {
      if (ev.error === 'no-speech') return;
      stopListeningState();
      setMicStatusText('مائیک مسئلہ: ' + ev.error + ' — دوبارہ کوشش کریں');
      setMicStatusColor('#c62828');
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {}
      } else {
        stopListeningState();
      }
    };

    return recognition;
  };

  // Start MediaRecorder for Student Audio
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (studentAudioUrl) URL.revokeObjectURL(studentAudioUrl);
        const url = URL.createObjectURL(audioBlob);
        setStudentAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (err) {
      console.warn('Audio recording error:', err);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const stopListeningState = () => {
    isListeningRef.current = false;
    setIsListening(false);
    setMicStatusText('تلاوت مکمل! اب نیچے "غلطیاں چیک کریں" پر کلک کریں');
    setMicStatusColor('#2e7d32');
    stopAudioRecording();
  };

  // Toggle Microphone
  const toggleListening = () => {
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }
    if (!recognitionRef.current) return;

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current.stop();
      stopAudioRecording();
    } else {
      if (!targetAyahText) {
        loadAyah(currentSurah, currentAyah).then(() => {
          try {
            recognitionRef.current.start();
            startAudioRecording();
          } catch {}
        });
      } else {
        try {
          recognitionRef.current.start();
          startAudioRecording();
        } catch {}
      }
    }
  };

  // Analyze Recitation using Sequence Alignment Engine
  const runAnalysis = () => {
    const recited = finalRecitedText.trim();
    if (!recited) {
      alert('پہلے مائیک آن کر کے تلاوت کریں، پھر جائزہ لیں۔');
      return;
    }
    if (!targetAyahText) {
      alert('پہلے آیت لوڈ کریں۔');
      return;
    }

    setIsAnalyzing(true);
    setShowReport(true);
    setSelectedWordDetail(null);

    setTimeout(() => {
      if (reportPanelRef.current) {
        reportPanelRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);

    // Split words
    const targetWords = targetAyahText.trim().split(/\s+/);
    const recitedWords = recited.trim().split(/\s+/);

    // Run Needleman-Wunsch Alignment
    const aligned = alignRecitation(targetWords, recitedWords);
    const computedStats = calculateRecitationStats(aligned);

    setAlignedWords(aligned);
    setStats(computedStats);

    // Generate pedagogical teacher feedback
    generateTeacherComment(computedStats, aligned);
    setIsAnalyzing(false);
  };

  // Intelligent Madrassa Feedback Generator
  const generateTeacherComment = (statsData, alignedList) => {
    const { score, missing, wrong } = statsData;

    let comment = '';
    if (score >= 90) {
      comment = `ماشاءاللہ تبارک اللہ! آپ کی تلاوت انتہائی عمدہ اور رواں ہے۔ تمام بنیادی الفاظ بالکل درست پڑھے گئے۔ تلاوت کا حسن برقرار رکھنے کے لیے تجوید کے احکام (مدات اور غنہ) کا خاص خیال رکھیں۔`;
    } else if (score >= 75) {
      comment = `بہت خوب! تلاوت مجموعی طور پر اچھی ہے۔ کچھ الفاظ پر ہلکی سی جھجک یا اعراب میں معمولی فرق آیا۔ نیچے دیے گئے سرخ نشان والے الفاظ پر دوبارہ نظر ڈالیں اور قاری صاحب کی آڈیو سن کر مشق کریں۔`;
    } else if (score >= 60) {
      comment = `مناسب کوشش ہے، مگر آیت کو مزید پکا کرنے کی ضرورت ہے۔ آپ نے ${missing > 0 ? `${missing} لفظ چھوڑے` : ''} ${wrong > 0 ? `اور ${wrong} الفاظ میں غلطی کی` : ''}۔ پہلے 3 بار قاری کی آڈیو سنیں، پھر دوبارہ سنائیں۔`;
    } else {
      comment = `توجہ درکار ہے! اس آیت کا حفظ ابھی کچا ہے۔ الفاظ کی ترتیب اور یاداشت پر دوبارہ محنت کریں۔ استاد سے ایک بار سن کر پھر سنائیں تاکہ غلطیاں درست ہو سکیں۔`;
    }

    // Append specific words to review if any
    const wrongWords = alignedList
      .filter((w) => w.status === 'wrong' && w.target)
      .map((w) => `"${w.target}" (آپ نے پڑھا: "${w.recited || '?'}")`);

    const missingWords = alignedList
      .filter((w) => w.status === 'missing' && w.target)
      .map((w) => `"${w.target}"`);

    let specificNotes = [];
    if (missingWords.length > 0) {
      specificNotes.push(`• بھولے ہوئے الفاظ: ${missingWords.slice(0, 4).join(' ، ')}`);
    }
    if (wrongWords.length > 0) {
      specificNotes.push(`• غلط پڑھے گئے الفاظ: ${wrongWords.slice(0, 3).join(' ، ')}`);
    }

    if (specificNotes.length > 0) {
      comment += '\n\n' + specificNotes.join('\n');
    }

    setTeacherComment(comment);
  };

  // Reset Session
  const resetSession = () => {
    setFinalRecitedText('');
    setInterimText('');
    setShowReport(false);
    setAlignedWords([]);
    setStats(null);
    setStudentAudioUrl(null);
    setSelectedWordDetail(null);
    setMicStatusText('تلاوت سنانے کے لیے مائیک دبائیں');
    setMicStatusColor('#2e7d32');
  };

  return (
    <div className="tab-content ai-ustad-container" id="tab-ai-listen">
      {/* Header Banner */}
      <div className="ai-ustad-header">
        <h2 className="ai-ustad-title">اے آئی استاد — قرآنی تلاوت اور غلطی پکڑنے کا نظام</h2>
        <p className="ai-ustad-subtitle">
          طالب علم اپنی تلاوت سنائیں — اے آئی استاد لفظ بہ لفظ نگرانی کر کے چھوٹے ہوئے اور غلط الفاظ کی نشاندہی کرے گا۔
        </p>
      </div>

      {/* Selector Card (Surah & Para) */}
      <div className="ai-selector-card">
        {/* Mode Toggle */}
        <div className="ai-mode-toggle">
          <button
            type="button"
            className={`ai-mode-btn ${selectMode === 'surah' ? 'active' : ''}`}
            onClick={() => setSelectMode('surah')}
          >
            سورت کے مطابق
          </button>
          <button
            type="button"
            className={`ai-mode-btn ${selectMode === 'para' ? 'active' : ''}`}
            onClick={() => setSelectMode('para')}
          >
            پارے کے مطابق
          </button>
        </div>

        {/* Controls Grid */}
        <div className="ai-nav-controls">
          {selectMode === 'surah' ? (
            <div className="ai-input-group">
              <label>سورت منتخب کریں (114 سورتیں)</label>
              <select
                className="ai-select"
                value={currentSurah}
                onChange={(e) => handleSurahChange(e.target.value)}
              >
                {SURAHS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. سورۃ {s.name} ({s.english}) — {s.ayahs} آیات
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="ai-input-group">
              <label>پارہ منتخب کریں (30 پارے)</label>
              <select
                className="ai-select"
                value={currentPara}
                onChange={(e) => handleParaChange(e.target.value)}
              >
                {PARAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    پارہ {p.id}: {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ai-input-group">
            <label>
              آیت نمبر (کل آیات: {currentSurahMeta.ayahs})
            </label>
            <input
              type="number"
              className="ai-input"
              value={currentAyah}
              min={1}
              max={currentSurahMeta.ayahs}
              onChange={(e) => handleAyahChange(e.target.value)}
            />
          </div>
        </div>

        {/* Quranic Ayah Box */}
        <div className="ai-ayah-display">
          {isLoadingAyah ? (
            <span style={{ color: '#888', fontSize: '1.2rem' }}>آیت مبارکہ لوڈ ہو رہی ہے...</span>
          ) : targetAyahText ? (
            <span>{targetAyahText}</span>
          ) : (
            <span style={{ color: '#d32f2f', fontSize: '1.2rem' }}>{ayahLoadStatus}</span>
          )}
        </div>

        {/* Navigation & Audio Tools */}
        <div className="ai-ayah-tools">
          <button
            type="button"
            className="ai-btn-secondary"
            onClick={togglePlayRefAudio}
            title="قاری مشاری راشد کی صحیح تلاوت سنیں"
          >
            {isPlayingRefAudio ? 'تلاوت روکیں' : 'صحیح تلاوت سنیں (مشاری راشد)'}
          </button>
          <audio
            ref={referenceAudioRef}
            onEnded={() => setIsPlayingRefAudio(false)}
            style={{ display: 'none' }}
          />

          <button type="button" className="ai-btn-outline" onClick={goToPrevAyah} title="پچھلی آیت">
            پچھلی آیت
          </button>
          <button type="button" className="ai-btn-outline" onClick={goToNextAyah} title="اگلی آیت">
            اگلی آیت
          </button>

          <span style={{ fontSize: '0.9rem', color: '#555', marginRight: 'auto' }}>
            {ayahLoadStatus}
          </span>
        </div>
      </div>

      {/* Mic & Live Recitation Section */}
      <div className="ai-mic-card">
        <p className="ai-mic-hint">
          آیت کو ذہن میں دہرائیں، پھر نیچے مائیک دبائیں اور اپنی تلاوت سنائیں:
        </p>

        {/* Pulsing Mic Button */}
        <button
          type="button"
          className={`ai-mic-button ${isListening ? 'listening' : ''}`}
          onClick={toggleListening}
          title={isListening ? 'تلاوت روکیں' : 'تلاوت شروع کریں'}
        >
          {isListening ? 'روکیں' : 'مائیک'}
        </button>

        {/* Sound Waves Animation */}
        {isListening && (
          <div className="ai-sound-waves">
            <div className="ai-sound-bar"></div>
            <div className="ai-sound-bar"></div>
            <div className="ai-sound-bar"></div>
            <div className="ai-sound-bar"></div>
            <div className="ai-sound-bar"></div>
            <div className="ai-sound-bar"></div>
            <div className="ai-sound-bar"></div>
          </div>
        )}

        <div className="ai-mic-status" style={{ color: micStatusColor }}>
          {micStatusText}
        </div>

        {/* Live Audio Transcript Box */}
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
            طالب علم کی لائیو تلاوت:
          </div>
          <div className="ai-live-transcript-box">
            {!finalRecitedText && !interimText ? (
              <div className="ai-live-transcript-empty">
                یہاں بچے کی تلاوت کے الفاظ لائیو ظاہر ہوں گے...
              </div>
            ) : (
              <>
                <span style={{ fontWeight: '700' }}>{finalRecitedText} </span>
                {interimText && <span style={{ color: '#888', fontStyle: 'italic' }}>{interimText}</span>}
              </>
            )}
          </div>
        </div>

        {/* Check Mistakes Button */}
        {!isListening && finalRecitedText.trim().length > 0 && (
          <button
            type="button"
            className="ai-btn-primary"
            onClick={runAnalysis}
            style={{
              fontSize: '1.15rem',
              padding: '14px 40px',
              margin: '22px auto 0 auto',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(46, 125, 50, 0.35)',
            }}
          >
            غلطیاں چیک کریں اور نتیجہ دیکھیں
          </button>
        )}
      </div>

      {/* Result & Analysis Report Card */}
      {showReport && (
        <div className="ai-report-card" ref={reportPanelRef}>
          {isAnalyzing ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '1.2rem', color: '#2e7d32' }}>
                اے آئی استاد تلاوت کا لفظ بہ لفظ تجزیہ کر رہا ہے...
              </p>
            </div>
          ) : stats ? (
            <div>
              {/* Score Banner */}
              <div
                className="ai-score-banner"
                style={{
                  background: `${stats.color}15`,
                  borderRightColor: stats.color,
                }}
              >
                <div>
                  <div className="ai-score-big" style={{ color: stats.color }}>
                    {stats.score}%
                  </div>
                  <div className="ai-grade-tag" style={{ color: stats.color }}>
                    {stats.emoji} {stats.grade}
                  </div>
                </div>

                <div style={{ textAlign: 'left', minWidth: '200px' }}>
                  <div style={{ fontSize: '0.95rem', color: '#555', marginBottom: '6px' }}>
                    درستگی کی شرح (Accuracy):
                  </div>
                  <div
                    style={{
                      background: '#e0e0e0',
                      borderRadius: '12px',
                      height: '14px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        background: stats.color,
                        height: '100%',
                        width: `${stats.score}%`,
                        transition: 'width 0.8s ease',
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Stats Summary Pills */}
              <div className="ai-stats-row">
                <div className="ai-stat-pill">
                  <div className="ai-stat-number" style={{ color: '#1b5e20' }}>
                    {stats.totalTarget}
                  </div>
                  <div className="ai-stat-label">کل الفاظ</div>
                </div>
                <div className="ai-stat-pill" style={{ background: '#e8f5e9' }}>
                  <div className="ai-stat-number" style={{ color: '#2e7d32' }}>
                    {stats.correct}
                  </div>
                  <div className="ai-stat-label">درست الفاظ</div>
                </div>
                <div className="ai-stat-pill" style={{ background: '#ffebee' }}>
                  <div className="ai-stat-number" style={{ color: '#c62828' }}>
                    {stats.missing}
                  </div>
                  <div className="ai-stat-label">بھولے ہوئے</div>
                </div>
                <div className="ai-stat-pill" style={{ background: '#fff3e0' }}>
                  <div className="ai-stat-number" style={{ color: '#e65100' }}>
                    {stats.wrong}
                  </div>
                  <div className="ai-stat-label">غلط الفاظ</div>
                </div>
                {stats.extra > 0 && (
                  <div className="ai-stat-pill" style={{ background: '#f3e5f5' }}>
                    <div className="ai-stat-number" style={{ color: '#6a1b9a' }}>
                      {stats.extra}
                    </div>
                    <div className="ai-stat-label">اضافی الفاظ</div>
                  </div>
                )}
              </div>

              {/* Word-by-Word Diff Board */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#1b5e20', fontSize: '1.25rem' }}>
                  لفظ بہ لفظ تفصیلی جائزہ:
                </h3>
                <div className="ai-word-board">
                  {alignedWords.map((w, idx) => {
                    let chipClass = 'correct';
                    let title = 'درست';
                    if (w.status === 'missing') {
                      chipClass = 'missing';
                      title = `یہ لفظ چھوٹ گیا: "${w.target}"`;
                    } else if (w.status === 'wrong') {
                      chipClass = 'wrong';
                      title = `غلط پڑھا: "${w.recited || '?'}" بجائے "${w.target}"`;
                    } else if (w.status === 'close') {
                      chipClass = 'close';
                      title = `ملتا جلتا: "${w.recited}"`;
                    } else if (w.status === 'extra') {
                      chipClass = 'extra';
                      title = `اضافی لفظ: "${w.recited}"`;
                    }

                    return (
                      <span
                        key={idx}
                        className={`ai-word-chip ${chipClass}`}
                        title={title}
                        onClick={() => setSelectedWordDetail(w)}
                      >
                        {w.target || w.recited}
                      </span>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="ai-word-legend">
                  <div className="ai-legend-item">
                    <span className="ai-legend-dot" style={{ background: '#2e7d32' }}></span>
                    <span>درست پڑھا</span>
                  </div>
                  <div className="ai-legend-item">
                    <span className="ai-legend-dot" style={{ background: '#e65100' }}></span>
                    <span>ملتا جلتا / معمولی فرق</span>
                  </div>
                  <div className="ai-legend-item">
                    <span className="ai-legend-dot" style={{ background: '#b71c1c' }}></span>
                    <span>غلط لفظ (تبدیل شدہ)</span>
                  </div>
                  <div className="ai-legend-item">
                    <span className="ai-legend-dot" style={{ background: '#7f0000' }}></span>
                    <span>چھوٹا ہوا لفظ (Missing)</span>
                  </div>
                  <div className="ai-legend-item">
                    <span className="ai-legend-dot" style={{ background: '#6a1b9a' }}></span>
                    <span>اضافی لفظ (Extra)</span>
                  </div>
                </div>

                {/* Selected Word Popover / Info */}
                {selectedWordDetail && (
                  <div
                    style={{
                      background: '#fff9c4',
                      border: '1px solid #fbc02d',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginTop: '12px',
                      fontSize: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      {selectedWordDetail.status === 'correct' && (
                        <span style={{ color: '#2e7d32', fontWeight: '700' }}>
                          یہ لفظ بالکل درست پڑھا گیا: "{selectedWordDetail.target}"
                        </span>
                      )}
                      {selectedWordDetail.status === 'missing' && (
                        <span style={{ color: '#c62828', fontWeight: '700' }}>
                          یہ لفظ چھوٹ گیا تھا۔ اصل لفظ: "{selectedWordDetail.target}"
                        </span>
                      )}
                      {selectedWordDetail.status === 'wrong' && (
                        <span style={{ color: '#b71c1c', fontWeight: '700' }}>
                          غلطی: طالب علم نے پڑھا "{selectedWordDetail.recited}" جبکہ اصل تھا "{selectedWordDetail.target}"
                        </span>
                      )}
                      {selectedWordDetail.status === 'close' && (
                        <span style={{ color: '#e65100', fontWeight: '700' }}>
                          معمولی فرق: طالب علم نے پڑھا "{selectedWordDetail.recited}" (اصل: "{selectedWordDetail.target}")
                        </span>
                      )}
                      {selectedWordDetail.status === 'extra' && (
                        <span style={{ color: '#6a1b9a', fontWeight: '700' }}>
                          اضافی لفظ: "{selectedWordDetail.recited}" قرآنی متن کا حصہ نہیں ہے۔
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWordDetail(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Student's Recording Playback */}
              {studentAudioUrl && (
                <div className="ai-audio-player-box">
                  <h4 className="ai-audio-player-title">طالب علم کی اپنی ریکارڈ شدہ تلاوت سنیں:</h4>
                  <audio controls src={studentAudioUrl} style={{ width: '100%', outline: 'none' }} />
                </div>
              )}

              {/* Teacher Feedback Box */}
              <div className="ai-feedback-box">
                <h4 className="ai-feedback-title">اے آئی استاد کا تبصرہ اور مشورہ:</h4>
                <p className="ai-feedback-text">{teacherComment}</p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ai-btn-secondary"
                  onClick={resetSession}
                  style={{ padding: '10px 24px' }}
                >
                  اسی آیت کو دوبارہ سنائیں
                </button>
                <button
                  type="button"
                  className="ai-btn-primary"
                  onClick={() => {
                    goToNextAyah();
                    resetSession();
                  }}
                  style={{ padding: '10px 28px' }}
                >
                  اگلی آیت کی طرف جائیں
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
