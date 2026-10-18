// مقارنة ما يكتبه المستخدم بالإجابة الصحيحة
// الأوضاع:
//   loose   : للمبتدئين — يتجاهل التشكيل، والهمزات (أ إ آ ٱ ← ا)، والتاء المربوطة/الهاء، والياء/الألف المقصورة
//   strict  : لدروس القرآن المتقدمة — يتجاهل التشكيل فقط (الحروف يجب أن تطابق تماماً)
//   harakat : لوحدة الحركات — التشكيل جزء من الإجابة

const HARAKAT = /[ً-ٰٟ]/g;          // فتحة ضمة كسرة سكون شدة تنوين… + الألف الخنجرية
const QURAN_MARKS = /[ۖ-ࣰۭ-ࣿ]/g; // علامات الوقف والعلامات الصغيرة في المصحف
const INVISIBLE = /[ـ​-‏‪-‮⁦-⁩﻿]/g; // تطويل وعلامات اتجاه
const PUNCT = /[.,،؛;:!?؟"'«»()\-]/g;

// فروقات في ترميز الحرف نفسه (كيبورد فارسي/كردي مقابل عربي) — تُوحَّد دائماً لأنها ليست أخطاء كتابة
function unifyCodepoints(s, lang) {
  if (lang === 'ku') {
    return s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ہ/g, 'ه');
  }
  return s.replace(/[یے]/g, 'ي').replace(/ک/g, 'ك').replace(/[ہھ]/g, 'ه');
}

export function normalize(input, mode = 'loose', lang = 'ar') {
  let s = (input || '').normalize('NFC');
  s = s.replace(INVISIBLE, '').replace(QURAN_MARKS, '').replace(PUNCT, ' ');
  s = unifyCodepoints(s, lang);
  s = s.replace(/ٱ/g, 'ا'); // همزة الوصل غير موجودة في الكيبورد
  if (mode === 'harakat') {
    // NFD يرتّب الحركات المتراكبة (مثل الشدة مع الفتحة) بترتيب ثابت
    s = s.normalize('NFD').replace(/ٰ/g, '');
  } else {
    s = s.replace(HARAKAT, '');
  }
  if (mode === 'loose') {
    s = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, lang === 'ku' ? 'ی' : 'ي');
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function isCorrect(input, answers, mode, lang) {
  const got = normalize(input, mode, lang);
  if (!got) return false;
  return answers.some(a => normalize(a, mode, lang) === got);
}

// تقسيم الكلمة إلى حروف (الحرف مع حركاته وحدة واحدة)
export function graphemes(s) {
  const out = [];
  for (const ch of s.normalize('NFC')) {
    if (/[ً-ٰٟۖ-ۭ]/.test(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}
