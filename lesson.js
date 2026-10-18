// محرّك الدرس: عرض الأسئلة، التحقق، قائمة الأخطاء والمراجعة
import { makeQuestions, freshCopy } from './content.js';
import { isCorrect } from './compare.js';
import * as speech from './speech.js';
import * as sfx from './sounds.js';

const PRAISE = ['أحسنت!', 'ممتاز!', 'رائع!', 'صحيح!', 'بارك الله فيك!'];
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function runLesson(root, lesson, { onFinish, onExit }) {
  const course = lesson.course;
  const main = makeQuestions(lesson);
  const S = {
    phase: 'main', idx: 0, q: null, answered: false,
    wrong: [], review: [], fixed: 0, firstTryRight: 0,
    arrange: [],
  };

  root.innerHTML = `
    <div class="lesson" style="--course:${course.color}">
      <header class="lesson-top">
        <button class="icon-btn close" aria-label="خروج">✕</button>
        <div class="bar"><div class="bar-fill"></div></div>
        <span class="review-badge" hidden>🔁</span>
      </header>
      <main class="q-body"></main>
      <footer class="q-foot">
        <div class="feedback" hidden></div>
        <div class="answer-row">
          <input class="answer target ${course.font === 'quran' ? 'quran-input' : ''}" type="text" dir="rtl" lang="${course.lang === 'ku' ? 'ckb' : 'ar'}"
                 name="a${Math.random().toString(36).slice(2)}" autocomplete="off" autocorrect="off"
                 autocapitalize="off" spellcheck="false" enterkeyhint="go" inputmode="text" aria-label="اكتب هنا">
        </div>
        <button class="btn main-btn">تحقّق</button>
      </footer>
    </div>`;

  const body = $('.q-body', root), foot = $('.q-foot', root), input = $('.answer', root);
  const btn = $('.main-btn', root), fb = $('.feedback', root), fill = $('.bar-fill', root);

  // نمنع الزر من سحب التركيز من حقل الكتابة حتى يبقى الكيبورد مفتوحاً
  btn.addEventListener('pointerdown', e => { if (document.activeElement === input) e.preventDefault(); });
  btn.addEventListener('click', () => (S.answered ? next() : check()));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); S.answered ? next() : check(); }
  });
  $('.close', root).addEventListener('click', () => {
    if (confirm('هل تريد الخروج من الدرس؟')) { speech.stop(); onExit(); }
  });

  function progress() {
    const total = main.length + S.wrong.length;
    const done = S.phase === 'main' ? S.idx : main.length + S.fixed;
    fill.style.width = `${Math.round((done / Math.max(total, 1)) * 100)}%`;
    $('.review-badge', root).hidden = S.phase !== 'review';
  }

  function instr(type) {
    const t = type === 'arrange' && S.q.byWords ? 'arrange_words' : type;
    return course.instructions[t] || course.instructions.copy;
  }
  function itemPart(item) { return { audio: item.audio, say: item.say, text: item.text, lang: item.lang }; }

  function playQuestion() {
    const q = S.q, ins = instr(q.type);
    const parts = [{ audio: ins.audio, say: ins.say, pause: 250 }];
    if (q.type === 'ayah_word' && q.firstOfAyah && q.ayah.audio) parts.push({ audio: q.ayah.audio, say: q.ayah.uthmani, pause: 300 });
    parts.push(itemPart(q.item));
    speech.sequence(parts);
  }

  // ------------------------------------------------------------ عرض السؤال
  function render() {
    const q = S.q, it = q.item;
    window.__hurufiQ = q; // للاختبار الآلي فقط
    S.answered = false;
    S.arrange = [];
    foot.className = 'q-foot';
    fb.hidden = true;
    btn.textContent = 'تحقّق';
    btn.hidden = false;
    input.value = '';
    const ins = instr(q.type);
    const showText = it.show || it.text;
    const fontCls = course.font === 'quran' ? 'quran' : '';
    let html = `
      <div class="instr">
        <button class="speak-btn" aria-label="استمع">🔊</button>
        <span class="instr-text">${esc(ins.text)}</span>
      </div>`;

    switch (q.type) {
      case 'copy':
        html += `<div class="visual">${it.emoji ? `<div class="big-emoji">${it.emoji}</div>` : ''}
                 <div class="target big-target ${fontCls}">${esc(showText)}</div></div>`;
        break;
      case 'see_write':
        html += `<div class="visual"><div class="big-emoji huge">${it.emoji}</div></div>`;
        break;
      case 'listen_write':
        html += `<div class="visual"><button class="listen-big" aria-label="استمع مرة أخرى">🔊</button></div>`;
        break;
      case 'complete':
        html += `<div class="visual">${it.emoji ? `<div class="big-emoji">${it.emoji}</div>` : ''}
                 <div class="target spaced ${fontCls}" dir="rtl">${q.letters.map((g, i) =>
                   i === q.blank ? '<span class="blank">؟</span>' : g === ' ' ? '<span class="gap"></span>' : `<span>${esc(g)}</span>`).join('')}</div></div>`;
        break;
      case 'choose':
        html += `<div class="choices ${q.options.some(o => o.emoji) ? 'emoji' : 'text'}">${q.options.map((o, i) =>
          `<button class="choice ${o.emoji ? '' : 'target ' + fontCls}" data-i="${i}">${o.emoji ? o.emoji : esc(o.show || o.text)}</button>`).join('')}</div>`;
        break;
      case 'arrange':
        html += `<div class="visual compact">${it.emoji ? `<div class="big-emoji small">${it.emoji}</div>` : ''}
                 <div class="arrange-preview target ${fontCls}"></div>
                 <div class="tiles answer-tiles"></div>
                 <div class="tiles bank">${q.tiles.map((t, i) => `<button class="tile target ${fontCls}" data-i="${i}">${esc(t)}</button>`).join('')}</div></div>`;
        break;
      case 'ayah_word': {
        const ay = q.ayah;
        html += `<div class="ayah-card">
            <div class="ayah-name">سورة ${esc(ay.name)} — آية ${ay.n}</div>
            <div class="ayah quran">${ay.words.map((w, i) =>
              `<span class="${i === q.idx ? 'cur' : i < q.idx ? 'past' : ''}">${esc(w.uthmani)}</span>`).join(' ')}</div>
            <div class="ayah-tools">
              <button class="btn small ayah-play">🔊 الآية</button>
              <button class="btn small hint-btn">💡 كيف تُكتب؟</button>
            </div>
            <div class="hint target" hidden>${esc(showText)}</div>
          </div>`;
        break;
      }
    }
    if (lesson.hint && (q.type === 'copy' || q.type === 'listen_write')) html += `<p class="lesson-hint">${esc(lesson.hint)}</p>`;
    body.innerHTML = html;

    $('.speak-btn', body).addEventListener('click', playQuestion);
    $('.listen-big', body)?.addEventListener('click', () => speech.sequence([itemPart(it)]));
    $('.ayah-play', body)?.addEventListener('click', () => speech.sequence([{ audio: q.ayah.audio, say: q.ayah.uthmani }]));
    $('.hint-btn', body)?.addEventListener('click', () => { $('.hint', body).hidden = false; speech.sequence([itemPart(it)]); });
    body.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => choose(+b.dataset.i)));
    if (q.type === 'arrange') setupArrange();

    const typed = !['choose', 'arrange'].includes(q.type);
    $('.answer-row', root).hidden = !typed;
    if (q.type === 'choose') btn.hidden = true;
    if (typed) input.focus(); else input.blur();
    progress();
    playQuestion();
  }

  // ------------------------------------------------------------ ترتيب الحروف
  function setupArrange() {
    const q = S.q, bank = $('.bank', body), ans = $('.answer-tiles', body), prev = $('.arrange-preview', body);
    const sep = q.byWords ? ' ' : '';
    const draw = () => {
      ans.innerHTML = S.arrange.map((i, k) => `<button class="tile placed target" data-k="${k}">${esc(q.tiles[i])}</button>`).join('');
      bank.querySelectorAll('.tile').forEach(b => { b.disabled = S.arrange.includes(+b.dataset.i); });
      prev.textContent = S.arrange.map(i => q.tiles[i]).join(sep) || ' ';
      ans.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
        if (S.answered) return;
        S.arrange.splice(+b.dataset.k, 1); draw();
      }));
    };
    bank.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
      if (S.answered) return;
      S.arrange.push(+b.dataset.i); draw();
    }));
    draw();
  }

  // ------------------------------------------------------------ التحقق
  function currentAnswer() {
    if (S.q.type === 'arrange') return S.arrange.map(i => S.q.tiles[i]).join(S.q.byWords ? ' ' : '');
    return input.value;
  }

  function check() {
    const value = currentAnswer();
    if (!value.trim()) {
      body.classList.remove('nudge'); void body.offsetWidth; body.classList.add('nudge');
      playQuestion();
      if (S.q.type !== 'arrange') input.focus();
      return;
    }
    grade(isCorrect(value, S.q.answers, lesson.mode, course.lang));
  }

  function choose(i) {
    if (S.answered) return;
    const q = S.q, picked = q.options[i];
    const ok = picked.text === q.item.text;
    body.querySelectorAll('.choice').forEach((b, k) => {
      if (q.options[k].text === q.item.text) b.classList.add('right');
      else if (k === i) b.classList.add('wrong');
      b.disabled = true;
    });
    btn.hidden = false;
    grade(ok);
  }

  function grade(ok) {
    S.answered = true;
    const q = S.q, it = q.item;
    if (S.phase === 'main') {
      if (ok) S.firstTryRight++; else S.wrong.push(q);
    } else if (ok) {
      S.fixed++;
    } else {
      S.review.push(freshCopy(q)); // يعود لآخر القائمة
    }

    foot.className = `q-foot ${ok ? 'ok' : 'bad'}`;
    fb.hidden = false;
    const shown = it.show || it.text;
    const fontCls = course.font === 'quran' ? 'quran' : '';
    if (ok) {
      const p = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      fb.innerHTML = `<div class="fb-title">✓ ${p}</div>`;
      sfx.correct();
      speech.sequence([{ say: p }]);
    } else {
      fb.innerHTML = `<div class="fb-title">الجواب الصحيح:</div>
        <div class="fb-answer target ${fontCls}">${it.emoji ? `<span class="fb-emoji">${it.emoji}</span>` : ''}${esc(shown)}</div>`;
      sfx.wrong();
      speech.sequence([{ say: 'الجواب الصحيح', pause: 150 }, itemPart(it)]);
      if (q.type === 'ayah_word') { const h = $('.hint', body); if (h) h.hidden = false; }
    }
    if (q.type === 'ayah_word') body.querySelector('.ayah .cur')?.classList.add(ok ? 'done-ok' : 'done-bad');
    btn.textContent = 'التالي ←';
    progress();
  }

  // ------------------------------------------------------------ الانتقال
  function next() {
    speech.stop();
    if (S.phase === 'main') {
      S.idx++;
      if (S.idx < main.length) { S.q = main[S.idx]; return render(); }
      if (!S.wrong.length) return finish();
      S.phase = 'review';
      S.review = S.wrong.map(freshCopy);
      return reviewIntro();
    }
    if (S.review.length) { S.q = S.review.shift(); return render(); }
    finish();
  }

  function reviewIntro() {
    progress();
    foot.className = 'q-foot';
    fb.hidden = true;
    $('.answer-row', root).hidden = true;
    input.blur();
    body.innerHTML = `<div class="interstitial"><div class="big-emoji huge">💪</div>
      <p class="inter-text">لنصحّح الأخطاء معاً</p></div>`;
    btn.hidden = false;
    btn.textContent = 'هيّا ←';
    S.answered = true; // الزر يعمل كـ "التالي"
    speech.say('لنصحّح الأخطاء معاً');
  }

  function finish() {
    speech.stop();
    const firstPassWrong = S.wrong.length;
    const stars = firstPassWrong === 0 ? 3 : firstPassWrong <= 2 ? 2 : 1;
    onFinish({ stars, points: 10 + S.firstTryRight * 2 + (stars === 3 ? 5 : 0), total: main.length, firstPassWrong });
  }

  S.q = main[0];
  render();
}
