/**
 * Quranic Recitation Alignment & Arabic Normalization Engine
 * Implements Needleman-Wunsch Sequence Alignment for robust word-by-word diffing.
 */

/**
 * Normalizes Arabic text for pronunciation comparison
 * Handles diacritics, Quranic pause marks, Alif variants, Hamzas, and Tatweel.
 */
export const normalizeArabic = (text = '') => {
  if (!text) return '';
  return text
    // Remove Quranic annotation marks (Sajdah, Juz, Rub, Waqf signs: Meem, Jeem, Qaf, Sad, etc.)
    .replace(/[\u06D6-\u06ED\u0610-\u061A]/g, '')
    // Remove Tashkeel / Harakat (Fatha, Damma, Kasra, Sukun, Shaddah, Tanween, Dagger Alif)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove Tatweel (Kashida)
    .replace(/\u0640/g, '')
    // Normalize Alif variants (Alif with Hamza above/below, Alif Madda, Alif Wasla)
    .replace(/[إأآٱ]/g, 'ا')
    // Normalize Yaa variants (Alif Maqsura to Yaa)
    .replace(/ى/g, 'ي')
    // Normalize Taa Marbuta to Haa
    .replace(/ة/g, 'ه')
    // Normalize Waw with Hamza and Yaa with Hamza
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // Remove punctuation, English/Urdu digits, brackets, etc.
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟،؛«»0-9۰-۹]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Standard Levenshtein distance
 */
export const levenshtein = (a = '', b = '') => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
};

/**
 * Word similarity ratio [0.0 to 1.0]
 */
export const wordSimilarity = (w1 = '', w2 = '') => {
  const n1 = normalizeArabic(w1);
  const n2 = normalizeArabic(w2);
  if (!n1 && !n2) return 1.0;
  if (!n1 || !n2) return 0.0;
  if (n1 === n2) return 1.0;

  const dist = levenshtein(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return maxLen > 0 ? Math.max(0, 1 - dist / maxLen) : 0;
};

/**
 * Needleman-Wunsch Sequence Alignment for Words
 * Aligns target Quranic words against recited words with tolerance for skipped and extra words.
 */
export const alignRecitation = (targetWords = [], recitedWords = []) => {
  const T = targetWords;
  const R = recitedWords;
  const m = T.length;
  const n = R.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) {
    return R.map((rw) => ({ target: null, recited: rw, similarity: 0, status: 'extra' }));
  }
  if (n === 0) {
    return T.map((tw) => ({ target: tw, recited: null, similarity: 0, status: 'missing' }));
  }

  // Scoring parameters:
  // Match gives a high reward.
  // Gap is slightly penalized.
  // Mismatch is penalized more heavily than a gap so that skipped/inserted words don't align to unrelated words.
  const MATCH_SCORE = 4.0;
  const CLOSE_SCORE = 2.0;
  const GAP_PENALTY = -1.5;
  const MISMATCH_PENALTY = -3.5;

  const getSimScore = (sim) => {
    if (sim === 1.0) return MATCH_SCORE;
    if (sim >= 0.7) return CLOSE_SCORE;
    if (sim >= 0.45) return -0.5;
    return MISMATCH_PENALTY;
  };

  const scoreMatrix = Array.from({ length: m + 1 }, () => new Float32Array(n + 1));

  // Initialize
  for (let i = 0; i <= m; i++) scoreMatrix[i][0] = i * GAP_PENALTY;
  for (let j = 0; j <= n; j++) scoreMatrix[0][j] = j * GAP_PENALTY;

  // Fill
  for (let i = 1; i <= m; i++) {
    const tw = T[i - 1];
    for (let j = 1; j <= n; j++) {
      const rw = R[j - 1];
      const sim = wordSimilarity(tw, rw);
      const simScore = getSimScore(sim);

      const match = scoreMatrix[i - 1][j - 1] + simScore;
      const deleteTarget = scoreMatrix[i - 1][j] + GAP_PENALTY;
      const insertRecited = scoreMatrix[i][j - 1] + GAP_PENALTY;

      scoreMatrix[i][j] = Math.max(match, deleteTarget, insertRecited);
    }
  }

  // Backtracking
  const aligned = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const tw = T[i - 1];
      const rw = R[j - 1];
      const sim = wordSimilarity(tw, rw);
      const simScore = getSimScore(sim);

      const current = scoreMatrix[i][j];
      const diagonal = scoreMatrix[i - 1][j - 1] + simScore;
      const up = scoreMatrix[i - 1][j] + GAP_PENALTY;
      const left = scoreMatrix[i][j - 1] + GAP_PENALTY;

      if (Math.abs(current - diagonal) < 0.001) {
        let status = 'wrong';
        if (sim === 1.0) status = 'correct';
        else if (sim >= 0.7) status = 'close';

        aligned.push({
          target: tw,
          recited: rw,
          similarity: sim,
          status,
        });
        i--;
        j--;
        continue;
      } else if (Math.abs(current - up) < 0.001) {
        aligned.push({
          target: tw,
          recited: null,
          similarity: 0,
          status: 'missing',
        });
        i--;
        continue;
      } else if (Math.abs(current - left) < 0.001) {
        aligned.push({
          target: null,
          recited: rw,
          similarity: 0,
          status: 'extra',
        });
        j--;
        continue;
      }
    }

    if (i > 0) {
      aligned.push({
        target: T[i - 1],
        recited: null,
        similarity: 0,
        status: 'missing',
      });
      i--;
    } else if (j > 0) {
      aligned.push({
        target: null,
        recited: R[j - 1],
        similarity: 0,
        status: 'extra',
      });
      j--;
    }
  }

  return aligned.reverse();
};

/**
 * Computes statistics and pedagogical remarks from alignment
 */
export const calculateRecitationStats = (alignedResults = []) => {
  const correct = alignedResults.filter((r) => r.status === 'correct').length;
  const close = alignedResults.filter((r) => r.status === 'close').length;
  const wrong = alignedResults.filter((r) => r.status === 'wrong').length;
  const missing = alignedResults.filter((r) => r.status === 'missing').length;
  const extra = alignedResults.filter((r) => r.status === 'extra').length;

  const totalTarget = alignedResults.filter((r) => r.target !== null).length;
  const score = totalTarget > 0 ? Math.round(((correct + close * 0.7) / totalTarget) * 100) : 0;

  let grade = 'ضعيف (محنت درکار)';
  let color = '#c62828';
  let emoji = '⚠️';

  if (score >= 90) {
    grade = 'ممتاز (شاندار)';
    color = '#2e7d32';
    emoji = '🌟';
  } else if (score >= 75) {
    grade = 'جيد جداً (بہت خوب)';
    color = '#388e3c';
    emoji = '✅';
  } else if (score >= 60) {
    grade = 'جيد (مناسب)';
    color = '#f57f17';
    emoji = '👍';
  } else if (score >= 45) {
    grade = 'مقبول (اعادہ درکار)';
    color = '#e65100';
    emoji = '🔄';
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    grade,
    color,
    emoji,
    totalTarget,
    correct,
    close,
    wrong,
    missing,
    extra,
  };
};
