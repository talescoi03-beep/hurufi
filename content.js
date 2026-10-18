// تحميل ملفات JSON وتحويل الدروس إلى أسئلة
import { graphemes } from './compare.js';

export const DEFAULT_INSTRUCTIONS = {
  letter:       { text: 'اكتب هذا الحرف',       say: 'اكتب هذا الحرف' },
  copy:         { text: 'اكتب هذه الكلمة',      say: 'اكتب هذه الكلمة' },
  see_write:    { text: 'ما هذا؟ اكتب اسمه',    say: 'ما هذا؟ اكتب اسمه' },
  listen_write: { text: 'اسمع واكتب',           say: 'اسمع واكتب' },
  complete:     { text: 'اكتب الحرف الناقص',    say: 'اكتب الحرف الناقص' },
  choose:       { text: 'اسمع واختر الصحيح',    say: 'اسمع واختر الصحيح' },
  arrange:      { text: 'رتّب الحروف',           say: 'رتّب الحروف' },
  arrange_words:{ text: 'رتّب الكلمات',          say: 'رتّب الكلمات' },
  ayah_word:    { text: 'اسمع واكتب الكلمة الملوّنة', say: 'اسمع واكتب الكلمة الملوّنة' },
};

let coursesCache = null;

async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`لم يُحمَّل ${path}`);
  return r.json();
}

export async function loadCourses() {
  if (coursesCache) return coursesCache;
  const index = await getJSON('data/courses.json');
  const list = await Promise.all(index.courses.map(f => getJSON('data/' + f)));
  for (const c of list) {
    if (c.textFile) c.quranText = await getJSON(c.textFile);
    prepareCourse(c);
  }
  coursesCache = list;
  return list;
}

const pad3 = n => String(n).padStart(3, '0');
function fillTemplate(tpl, s, a, w) {
  return tpl.replace('{s3}', pad3(s)).replace('{a3}', pad3(a)).replace('{w3}', pad3(w ?? 1));
}

// كلمة قرآنية من ملف النص → عنصر درس
function quranWord(course, s, a, w) {
  const ayah = course.quranText.surahs[s]?.ayat[a - 1];
  const word = ayah?.words[w - 1];
  if (!word) throw new Error(`كلمة غير موجودة ${s}:${a}:${w}`);
  // الإجابات المقبولة: الإملائي، وكتابة الرسم العثماني بالحروف العادية
  const rasm = word.u.replace(/ٱ/g, 'ا');
  return {
    text: word.c,
    show: word.s,
    uthmani: word.u,
    accept: [rasm, rasm.replace(/ٰ/g, 'ا')],
    say: word.s,
    audio: course.wordAudio ? fillTemplate(course.wordAudio, s, a, w) : null,
    ref: `${s}:${a}:${w}`,
  };
}

function prepareCourse(c) {
  c.instructions = { ...DEFAULT_INSTRUCTIONS, ...(c.instructions || {}) };
  for (const u of c.units) {
    for (const l of u.lessons) {
      l.course = c; l.unit = u;
      if (l.words) {
        l.items = l.words.map(ref => quranWord(c, ...ref.split(':').map(Number)));
      }
      if (l.ayat) {
        const { surah, from, to } = l.ayat;
        const sur = c.quranText.surahs[surah];
        l.items = [];
        l.ayahList = [];
        for (let a = from; a <= to; a++) {
          const ay = sur.ayat[a - 1];
          const words = ay.words.map((_, i) => quranWord(c, surah, a, i + 1));
          l.items.push(...words);
          l.ayahList.push({ surah, n: a, name: sur.name, uthmani: ay.uthmani, words,
                            audio: c.ayahAudio ? fillTemplate(c.ayahAudio, surah, a) : null });
        }
      }
      for (const it of l.items || []) if (it.lang == null) it.lang = c.lang;
    }
  }
}

// ---------------------------------------------------------------- توليد الأسئلة
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const isLetterItem = it => graphemes(it.text).length === 1 && !/\s/.test(it.text);
const baseLetters = it => graphemes(it.text).filter(g => g.trim());

function choicePool(lesson, item) {
  const sameKind = x => !!x.emoji === !!item.emoji && x.text !== item.text;
  let pool = lesson.items.filter(sameKind);
  if (pool.length < 3) {
    const extra = lesson.unit.lessons.flatMap(l => l.items || []).filter(sameKind);
    pool = [...new Map([...pool, ...extra].map(x => [x.text, x])).values()];
  }
  if (pool.length < 3) {
    const extra = lesson.course.units.flatMap(u => u.lessons.flatMap(l => l.items || [])).filter(sameKind);
    pool = [...new Map([...pool, ...extra].map(x => [x.text, x])).values()];
  }
  return pool;
}

function compatible(type, item, lesson) {
  switch (type) {
    case 'complete': return lesson.mode !== 'harakat' && baseLetters(item).filter(g => g !== ' ').length >= 2;
    case 'arrange': {
      const units = /\s/.test(item.text) ? item.text.split(/\s+/) : baseLetters(item);
      return units.length >= 2 && new Set(units).size >= 2;
    }
    case 'choose': return choicePool(lesson, item).length >= 3;
    case 'see_write': return !!item.emoji;
    default: return true;
  }
}

export function buildQuestion(type, item, lesson) {
  const q = { type, item, lesson };
  if (type === 'letter' || (type === 'copy' && isLetterItem(item))) q.type = 'copy';
  if (type === 'complete') {
    const gs = baseLetters(item);
    const idxs = gs.map((g, i) => (g === ' ' ? -1 : i)).filter(i => i >= 0);
    q.blank = idxs[Math.floor(Math.random() * idxs.length)];
    q.letters = gs;
    q.answers = [gs[q.blank]];
    if (lesson.mode === 'loose' && 'أإآ'.includes(gs[q.blank])) q.answers.push('ا');
  }
  if (type === 'arrange') {
    q.byWords = /\s/.test(item.text);
    const units = q.byWords ? item.text.split(/\s+/) : baseLetters(item);
    let sh = shuffle(units);
    for (let k = 0; k < 6 && sh.join('') === units.join(''); k++) sh = shuffle(units);
    q.tiles = sh;
    q.answers = [item.text, ...(item.accept || [])];
  }
  if (type === 'choose') {
    const opts = shuffle(choicePool(lesson, item)).slice(0, 3);
    q.options = shuffle([item, ...opts]);
  }
  if (!q.answers) q.answers = [item.text, ...(item.accept || [])];
  return q;
}

export function makeQuestions(lesson) {
  if (lesson.ayahList) return makeAyahQuestions(lesson);
  const types = lesson.types || ['copy', 'choose', 'listen_write'];
  const count = Math.max(8, Math.min(12, lesson.count || 10));
  const items = shuffle(lesson.items);
  const out = [];
  for (let i = 0; i < count; i++) {
    const item = items[i % items.length];
    let type = types[i % types.length];
    if (!compatible(type, item, lesson)) type = isLetterItem(item) ? 'letter' : 'copy';
    out.push(buildQuestion(type, item, lesson));
  }
  return out;
}

// دروس الآيات: كل كلمة سؤال بالترتيب، ونكمل حتى 8 أسئلة بأسئلة "اختر"
function makeAyahQuestions(lesson) {
  const out = [];
  for (const ay of lesson.ayahList) {
    ay.words.forEach((w, idx) => {
      out.push({ type: 'ayah_word', item: w, lesson, ayah: ay, idx, firstOfAyah: idx === 0,
                 answers: [w.text, ...w.accept] });
    });
  }
  const all = lesson.items;
  let k = 0;
  while (out.length < 8 && all.length) {
    out.push(buildQuestion('choose', all[k++ % all.length], lesson));
  }
  return out;
}

// نسخة جديدة من السؤال لإعادته في المراجعة (خيارات وترتيب جديد)
export function freshCopy(q) {
  if (q.type === 'ayah_word') return { ...q, firstOfAyah: true };
  return buildQuestion(q.type, q.item, q.lesson);
}
