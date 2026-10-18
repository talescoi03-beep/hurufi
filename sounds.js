// أصوات قصيرة تُولَّد بالكود (لا تحتاج ملفات)
let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', vol = 0.25) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export function correct() {
  try { tone(660, 0, 0.15); tone(880, 0.12, 0.3); } catch { /* no audio */ }
}

// صوت هادئ غير مخيف للخطأ
export function wrong() {
  try { tone(392, 0, 0.25, 'triangle', 0.18); tone(330, 0.2, 0.35, 'triangle', 0.15); } catch { /* no audio */ }
}

export function celebrate() {
  try {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.35));
    tone(1319, 0.6, 0.6);
  } catch { /* no audio */ }
}

export function unlock() { try { ac(); } catch { /* ignore */ } }
