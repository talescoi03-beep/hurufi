// حفظ التقدّم في localStorage (لا حسابات ولا خادم)
const KEY = 'hurufi.v1';

function blank() { return { done: {}, points: 0, streak: { count: 0, last: null } }; }

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch { return blank(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function lessonKey(courseId, unitId, lessonId) { return `${courseId}/${unitId}/${lessonId}`; }

export function isDone(key) { return !!state.done[key]; }
export function stars(key) { return state.done[key]?.stars || 0; }

export function finishLesson(key, starCount, points) {
  const prev = state.done[key];
  state.done[key] = { stars: Math.max(starCount, prev?.stars || 0), at: Date.now() };
  state.points += points;
  const t = today();
  if (state.streak.last !== t) {
    const gap = state.streak.last ? daysBetween(state.streak.last, t) : null;
    state.streak.count = gap === 1 ? state.streak.count + 1 : 1;
    state.streak.last = t;
  }
  save();
}

// السلسلة تبقى ظاهرة إن كان آخر يوم نشاط اليوم أو أمس
export function streak() {
  const { count, last } = state.streak;
  if (!last) return 0;
  return daysBetween(last, today()) <= 1 ? count : 0;
}
export function points() { return state.points; }

export function reset() { state = blank(); save(); }
