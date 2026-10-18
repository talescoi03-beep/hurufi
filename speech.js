// الصوت: ملفات صوتية مسجّلة أولاً، وإن لم تتوفر (أو فشل تحميلها) نستخدم القارئ الآلي العربي.

let arVoice = null;
let current = null;      // عنصر الصوت الحالي
let token = 0;           // لإلغاء التسلسلات القديمة عند بدء صوت جديد
export const settings = { rate: 0.8 };

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  arVoice = voices.find(v => /^ar[-_]SA/i.test(v.lang)) ||
            voices.find(v => /^ar/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function hasArabicVoice() { return !!arVoice; }

export function stop() {
  token++;
  if (current) { current.pause(); current.src = ''; current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function ttsOnce(text) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ar-SA';
    if (arVoice) u.voice = arVoice;
    u.rate = settings.rate;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish; u.onerror = finish;
    // بعض متصفحات أندرويد لا تطلق onend أحياناً
    setTimeout(finish, 1500 + text.length * 220);
    speechSynthesis.speak(u);
  });
}

function playOnce(src) {
  return new Promise((resolve, reject) => {
    const a = new Audio(src);
    current = a;
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('audio failed'));
    a.play().catch(reject);
  });
}

// تقريب الحروف الكردية لأقرب حرف عربي حتى يقرأها الصوت العربي (مؤقتاً إلى أن تضاف التسجيلات)
const KU_APPROX = { 'پ': 'ب', 'چ': 'تش', 'ژ': 'ج', 'ڤ': 'ف', 'گ': 'ك', 'ک': 'ك', 'ۆ': 'و', 'ێ': 'ي', 'ی': 'ي',
                    'ە': 'َه', 'ڕ': 'ر', 'ڵ': 'ل', 'ئ': 'ء' };
function kurdishApprox(s) { return [...s].map(c => KU_APPROX[c] ?? c).join(''); }

// يشغّل قائمة مقاطع بالتتابع: [{audio, say, text, lang}]
export async function sequence(parts) {
  stop();
  const my = ++token;
  for (const p of parts) {
    if (my !== token || !p) return;
    if (p.audio) {
      try { await playOnce(p.audio); notifyCache(p.audio); continue; }
      catch { /* نكمل بالقارئ الآلي */ }
      if (my !== token) return;
    }
    let text = p.say || p.text || '';
    if (p.lang === 'ku' && !p.say) text = kurdishApprox(text);
    await ttsOnce(text);
    if (p.pause) await new Promise(r => setTimeout(r, p.pause));
  }
}

export function say(text) { return sequence([{ say: text }]); }

// نطلب من Service Worker حفظ الملف الصوتي للعمل بدون إنترنت
function notifyCache(url) {
  if (/^https?:/.test(url) && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'cache-audio', urls: [url] });
  }
}

// أندرويد يحتاج لمسة من المستخدم قبل السماح بالصوت
export function unlock() {
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
