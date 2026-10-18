// الشاشات: البداية ← اختيار المادة ← المسار ← الدرس ← الاحتفال
import { loadCourses } from './content.js';
import { runLesson } from './lesson.js';
import * as store from './storage.js';
import * as speech from './speech.js';
import * as sfx from './sounds.js';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let courses = [];

// ---------------------------------------------------------------- الكيبورد: نجعل الصفحة بطول الجزء الظاهر فقط
let maxH = 0;
function fitViewport() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  maxH = Math.max(maxH, h);
  document.documentElement.style.setProperty('--app-h', `${h}px`);
  document.body.classList.toggle('kb-open', h < maxH * 0.78);
  if (vv && vv.offsetTop) window.scrollTo(0, 0);
}
window.visualViewport?.addEventListener('resize', fitViewport);
window.visualViewport?.addEventListener('scroll', fitViewport);
window.addEventListener('resize', fitViewport);
window.addEventListener('orientationchange', () => { maxH = 0; setTimeout(fitViewport, 300); });
fitViewport();

// ---------------------------------------------------------------- التنقل (زر الرجوع في أندرويد يعمل)
function go(state, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](state, '', state.hash || '#');
  show(state);
}
window.addEventListener('popstate', e => show(e.state || { screen: 'home' }));

function show(state) {
  speech.stop();
  if (state.screen === 'course') return renderPath(courseById(state.course));
  if (state.screen === 'lesson') return renderPath(courseById(state.course)); // لا نعيد فتح درس من زر الرجوع
  renderHome();
}
const courseById = id => courses.find(c => c.id === id) || courses[0];

function topBar(back) {
  return `<header class="top">
      ${back ? `<button class="icon-btn back" aria-label="رجوع">→</button>` : '<span class="logo">✍️ حروفي</span>'}
      <div class="stats">
        <span class="stat" title="أيام متتالية">🔥 ${store.streak()}</span>
        <span class="stat" title="نقاط">⭐ ${store.points()}</span>
      </div>
    </header>`;
}

// ---------------------------------------------------------------- الشاشة الأولى
function renderHome() {
  app.innerHTML = `${topBar(false)}
    <main class="home">
      <button class="instr home-instr"><span class="speak-btn">🔊</span><span class="instr-text">ماذا تريد أن تتعلّم؟</span></button>
      <div class="course-list">
        ${courses.map(c => {
          const lessons = c.units.flatMap(u => u.lessons);
          const done = lessons.filter(l => store.isDone(key(c, l))).length;
          return `<button class="course-card" data-id="${c.id}" style="--course:${c.color}">
              <span class="course-emoji">${c.emoji}</span>
              <span class="course-title">${esc(c.title)}${c.subtitle ? `<small>${esc(c.subtitle)}</small>` : ''}</span>
              <span class="course-progress"><span style="width:${Math.round(done / lessons.length * 100)}%"></span></span>
            </button>`;
        }).join('')}
      </div>
    </main>`;
  app.querySelector('.home-instr').addEventListener('click', () => speech.say('ماذا تريد أن تتعلّم؟ اضغط على الصورة'));
  app.querySelectorAll('.course-card').forEach(b => b.addEventListener('click', () => {
    const c = courseById(b.dataset.id);
    speech.say(c.lang === 'ku' ? 'اللغة الكردية' : c.title);
    go({ screen: 'course', course: c.id, hash: '#' + c.id });
  }));
}

const key = (c, l) => store.lessonKey(c.id, l.unit.id, l.id);

// ---------------------------------------------------------------- المسار
function renderPath(c) {
  const all = c.units.flatMap(u => u.lessons);
  const firstOpen = all.findIndex(l => !store.isDone(key(c, l)));
  const unlocked = l => { const i = all.indexOf(l); return firstOpen === -1 || i <= firstOpen; };
  let n = 0;

  app.innerHTML = `${topBar(true)}
    <main class="path" style="--course:${c.color}">
      <h1 class="path-title">${c.emoji} ${esc(c.title)}</h1>
      ${c.units.map((u, ui) => {
        const uOpen = unlocked(u.lessons[0]);
        return `<section class="unit ${uOpen ? '' : 'locked'}">
          <button class="unit-head" data-say="${esc(u.title)}">
            <span class="unit-emoji">${uOpen ? u.emoji : '🔒'}</span>
            <span><small>الوحدة ${ui + 1}</small>${esc(u.title)}</span>
          </button>
          <div class="nodes">
            ${u.lessons.map(l => {
              const k = key(c, l), done = store.isDone(k), open = unlocked(l), cur = all.indexOf(l) === firstOpen;
              const off = Math.round(Math.sin(n++ * 1.1) * 70);
              return `<div class="node-wrap" style="--off:${off}px">
                <button class="node ${done ? 'done' : ''} ${cur ? 'current' : ''} ${open ? '' : 'locked'}"
                        data-u="${u.id}" data-l="${l.id}" aria-label="${esc(l.title)}">
                  <span class="node-emoji ${c.font === 'quran' ? 'quran' : ''}">${open ? esc(l.emoji || '★') : '🔒'}</span>
                </button>
                ${done ? `<span class="node-stars">${'★'.repeat(store.stars(k))}${'☆'.repeat(3 - store.stars(k))}</span>` : ''}
                ${cur ? '<span class="start-flag">ابدأ</span>' : ''}
              </div>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}
      ${c.textSource || c.audioSource ? `<footer class="sources">
          ${c.ayahAudio ? '<button class="btn small dl-audio">⬇️ حفظ التلاوة للاستماع بدون إنترنت</button>' : ''}
          <p>${esc(c.textSource || '')}</p><p>${esc(c.audioSource || '')}</p></footer>` : ''}
    </main>`;

  app.querySelector('.back').addEventListener('click', () => history.length > 1 ? history.back() : go({ screen: 'home' }, true));
  app.querySelectorAll('.unit-head').forEach(b => b.addEventListener('click', () => speech.say(b.dataset.say)));
  app.querySelectorAll('.node').forEach(b => b.addEventListener('click', () => {
    const lesson = c.units.find(u => u.id === b.dataset.u).lessons.find(l => l.id === b.dataset.l);
    if (!unlocked(lesson)) { sfx.wrong(); speech.say('أكمل الدرس السابق أولاً'); return; }
    startLesson(c, lesson); // مباشرة داخل اللمسة حتى يفتح الكيبورد
  }));
  app.querySelector('.dl-audio')?.addEventListener('click', e => downloadAudio(c, e.currentTarget));
  app.querySelector('.node.current')?.scrollIntoView({ block: 'center' });
}

// ---------------------------------------------------------------- الدرس
function startLesson(c, lesson) {
  history.pushState({ screen: 'lesson', course: c.id, hash: '#' + c.id }, '', '#' + c.id + '/lesson');
  runLesson(app, lesson, {
    onExit: () => history.back(),
    onFinish: r => {
      store.finishLesson(key(c, lesson), r.stars, r.points);
      celebrate(c, r);
    },
  });
}

function celebrate(c, r) {
  sfx.celebrate();
  speech.say(r.stars === 3 ? 'ممتاز! أنهيت الدرس بدون أخطاء' : 'أحسنت! أنهيت الدرس');
  const confetti = Array.from({ length: 24 }, (_, i) =>
    `<span style="--x:${Math.random() * 100}%;--d:${(Math.random() * 1.5 + 1.5).toFixed(2)}s;--t:${(i * 0.05).toFixed(2)}s">${['🎉', '⭐', '🌟', '🎊'][i % 4]}</span>`).join('');
  app.innerHTML = `<main class="celebrate" style="--course:${c.color}">
      <div class="confetti">${confetti}</div>
      <div class="cele-emoji">${r.stars === 3 ? '🏆' : '🎉'}</div>
      <div class="cele-stars">${[1, 2, 3].map(i => `<span class="${i <= r.stars ? 'on' : ''}">★</span>`).join('')}</div>
      <p class="cele-text">${r.stars === 3 ? 'ممتاز!' : 'أحسنت!'}</p>
      <p class="cele-points">⭐ +${r.points} &nbsp; 🔥 ${store.streak()}</p>
      <button class="btn main-btn cont">متابعة ←</button>
    </main>`;
  app.querySelector('.cont').addEventListener('click', () => history.back());
}

// ---------------------------------------------------------------- حفظ ملفات التلاوة
function downloadAudio(c, btn) {
  const urls = [];
  for (const u of c.units) for (const l of u.lessons) {
    for (const it of l.items || []) if (it.audio && /^https?:/.test(it.audio)) urls.push(it.audio);
    for (const a of l.ayahList || []) if (a.audio) urls.push(a.audio);
  }
  if (!navigator.serviceWorker?.controller) { speech.say('افتح التطبيق مرة أخرى ثم حاول'); return; }
  navigator.serviceWorker.controller.postMessage({ type: 'cache-audio', urls: [...new Set(urls)] });
  btn.textContent = '⏳ جارٍ الحفظ…';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = '✓ تم الحفظ'; }, 8000);
}

// ---------------------------------------------------------------- البداية
async function boot() {
  try {
    courses = await loadCourses();
  } catch (e) {
    app.innerHTML = `<main class="home"><p class="error">تعذّر تحميل المحتوى 😕<br><small>${esc(e.message)}</small></p></main>`;
    return;
  }
  // شاشة "ابدأ": أندرويد لا يسمح بالصوت قبل أول لمسة
  app.innerHTML = `<main class="splash">
      <div class="splash-logo">✍️</div>
      <h1>حروفي</h1>
      <button class="btn main-btn start">👆 ابدأ</button>
    </main>`;
  app.querySelector('.start').addEventListener('click', () => {
    speech.unlock(); sfx.unlock();
    const hashCourse = location.hash.slice(1).split('/')[0];
    const c = courses.find(x => x.id === hashCourse);
    history.replaceState({ screen: 'home' }, '', '#');
    if (c) go({ screen: 'course', course: c.id, hash: '#' + c.id });
    else renderHome();
    speech.say('أهلاً بك. ماذا تريد أن تتعلّم؟');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
boot();
