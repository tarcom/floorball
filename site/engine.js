/* engine.js — tidslinje, interpolation og afspilning.
 *
 * En scene beskrives som keyframes: hver spiller har en liste af
 * [tid, x, y] og bolden en liste af [tid, x, y] eller [tid, 'spillerId'].
 * Motoren regner positionen ud på et vilkårligt tidspunkt, så man kan
 * spole frit frem og tilbage uden at afspille sig frem til det.
 */

const LABELS = { MV: 'MV', B1: 'B1', B2: 'B2', C: 'C', W1: 'W1', W2: 'W2' };
const ROLES = {
  MV: 'Målmand', B1: 'Venstre back', B2: 'Højre back',
  C: 'Center', W1: 'Venstre wing', W2: 'Højre wing',
};

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/* Slår keyframes op og interpolerer. Er de to keyframes lige lange i tid,
   sker der et hårdt klip — det bruges når en scene starter forfra i fase 2. */
function sampleKeys(keys, t) {
  if (!keys.length) return [0, 0];
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return [last[1], last[2]];
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
  const a = keys[i], b = keys[i + 1];
  const span = b[0] - a[0];
  if (span <= 0) return [b[1], b[2]];
  const raw = (t - a[0]) / span;
  const k = b[3] === 'l' ? raw : easeInOut(raw);
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

class Scene {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.title = def.title;
    this.category = def.category;
    this.summary = def.summary;
    this.points = def.points || [];
    this.duration = def.duration;
    this.steps = (def.steps || []).slice().sort((a, b) => a.t - b.t);
    this.events = (def.events || []).slice().sort((a, b) => a.t - b.t);

    this.players = [];
    for (const [key, keys] of Object.entries(def.home || {})) {
      this.players.push({
        id: key, team: 'home', label: LABELS[key] || key,
        role: ROLES[key] || '', keys, from: -1, to: 1e9,
      });
    }
    for (const [key, keys] of Object.entries(def.away || {})) {
      this.players.push({
        id: 'a' + key, team: 'away', label: def.labelAway ? (LABELS[key] || key) : '',
        role: '', keys, from: -1, to: 1e9,
      });
    }
    // Ekstra spillere med begrænset levetid (bruges til udskiftning).
    for (const extra of def.extras || []) {
      this.players.push({
        id: extra.id, team: extra.team || 'home', label: extra.label ?? (LABELS[extra.id] || extra.id),
        role: extra.role || '', keys: extra.keys,
        from: extra.from ?? -1, to: extra.to ?? 1e9,
      });
    }
    this.byId = Object.fromEntries(this.players.map(p => [p.id, p]));
  }

  posOf(id, t) {
    const p = this.byId[id];
    return p ? sampleKeys(p.keys, t) : [0, 0];
  }

  activePlayers(t) {
    return this.players.filter(p => t >= p.from && t <= p.to);
  }

  /* Bolden ligger ikke oven i spilleren, men et stykke foran ham — ellers
     dækker prikken bolden helt. Retningen er den vej han bevæger sig, og
     står han stille, den vej hans hold angriber. */
  stickOffset(id, t) {
    const a = this.posOf(id, Math.max(0, t - 0.12));
    const b = this.posOf(id, t + 0.12);
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.04) {
      dx = this.byId[id] && this.byId[id].team === 'away' ? -1 : 1;
      dy = 0;
    } else {
      dx /= len; dy /= len;
    }
    return [dx * 0.85, dy * 0.85];
  }

  /* Bolden: et keyframe er enten faste koordinater eller et spiller-id.
     Følger den en spiller, aflæses spillerens position på NUVÆRENDE tid —
     så bliver bolden hængende på staven mens spilleren løber. */
  ballAt(t) {
    const keys = this.def.ball || [];
    if (!keys.length) return null;
    const resolve = (k) => {
      if (typeof k[1] !== 'string') return [k[1], k[2]];
      const p = this.posOf(k[1], t);
      const o = this.stickOffset(k[1], t);
      return [p[0] + o[0], p[1] + o[1]];
    };
    if (t <= keys[0][0]) return resolve(keys[0]);
    const last = keys[keys.length - 1];
    if (t >= last[0]) return resolve(last);
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
    const a = keys[i], b = keys[i + 1];
    const span = b[0] - a[0];
    const pa = resolve(a), pb = resolve(b);
    if (span <= 0) return pb;
    const k = (t - a[0]) / span;   // afleveringer går lige og hurtigt
    return [pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k];
  }

  /* Hvem har bolden lige nu? Kun den, der faktisk fører den — mens en
     aflevering er undervejs, har ingen den, og så markeres ingen. */
  carrierAt(t) {
    const keys = this.def.ball || [];
    if (!keys.length) return null;
    const last = keys[keys.length - 1];
    if (t >= last[0]) return typeof last[1] === 'string' ? last[1] : null;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
    const a = keys[i], b = keys[i + 1];
    return (typeof a[1] === 'string' && a[1] === b[1]) ? a[1] : null;
  }

  stepAt(t) {
    let idx = -1;
    for (let i = 0; i < this.steps.length; i++) {
      if (this.steps[i].t <= t + 1e-6) idx = i; else break;
    }
    return idx;
  }

  activeEvents(t) {
    return this.events.filter(e => {
      const end = e.until ?? (e.t + (e.type === 'pass' || e.type === 'shot' ? 1.6 : 2.2));
      return t >= e.t && t <= end;
    });
  }

  /* Punkter til bevægelsesspor: hvor har spilleren været de sidste sekunder. */
  trailOf(id, t, seconds = 2.6, samples = 22) {
    const pts = [];
    const start = Math.max(0, t - seconds);
    for (let i = 0; i <= samples; i++) {
      const tt = start + (t - start) * (i / samples);
      pts.push(this.posOf(id, tt));
    }
    // Drop sporet helt hvis spilleren stort set ikke har flyttet sig.
    const d = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    return d < 0.9 ? [] : pts;
  }
}

/* --- afspiller ------------------------------------------------------- */

class Player {
  constructor(onFrame) {
    this.t = 0;
    this.duration = 0;
    this.rate = 1;
    this.playing = false;
    this.stopAt = null;            // hold pause her — bruges af trin-knapperne
    this.shouldWait = () => false; // sættes af app.js: venter vi på oplæsningen?
    this.onFrame = onFrame;
    this._last = 0;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  load(duration) {
    this.duration = duration;
    this.t = 0;
    this.stopAt = null;
    this.playing = false;
  }

  get atEnd() { return this.t >= this.duration - 0.02; }

  /* `until` afspiller kun frem til et bestemt sekund og stopper der.
     Står vi på slutningen, starter play forfra i stedet for ikke at gøre noget. */
  play(until = null) {
    this.stopAt = until;
    if (until == null && this.atEnd) this.t = 0;
    if (!this.playing) { this.playing = true; this._last = performance.now(); }
  }

  pause() { this.playing = false; this.stopAt = null; }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t) { this.t = Math.max(0, Math.min(this.duration, t)); this.stopAt = null; }

  _tick(now) {
    const dt = Math.min(0.12, (now - this._last) / 1000);
    this._last = now;
    if (this.playing && !this.shouldWait()) {
      this.t += dt * this.rate;
      if (this.stopAt != null && this.t >= this.stopAt) {
        this.t = this.stopAt;
        this.playing = false;
        this.stopAt = null;
      } else if (this.t >= this.duration) {
        // Scenen kører ikke i ring — den stopper, og brugeren starter selv igen.
        this.t = this.duration;
        this.playing = false;
      }
    }
    this.onFrame(this.t, now / 1000);
    requestAnimationFrame(this._tick);
  }
}

/* --- oplæsning ------------------------------------------------------- */

/* Bruger browserens indbyggede talesyntese. Ingen lydfiler, ingen server.
   Har en scene et `audio`-felt på et trin, afspilles den fil i stedet —
   så kan rigtige indtalinger lægges ovenpå senere uden at ændre koden. */
class Speaker {
  constructor() {
    this.enabled = false;
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voice = null;
    this.rate = 0.98;
    this.audio = null;
    /* token tæller op ved hver stop() og hver ny oplæsning. Uden den opstår
       en grim fejl: speechSynthesis.cancel() udløser den FORRIGE oplæsnings
       end-event asynkront, og den callback slap tidligere den nye pause fri
       få millisekunder efter den var sat. Derfor virkede "vent på tale" kun
       nogle gange. Nu ignoreres events fra en forældet token. */
    this.token = 0;
    this.speaking = false;
    this.deadline = 0;
    if (this.supported) {
      const pick = () => { this.voice = this._pickDanish(); };
      pick();
      speechSynthesis.addEventListener('voiceschanged', pick);
    }
  }

  _pickDanish() {
    const voices = speechSynthesis.getVoices() || [];
    return voices.find(v => v.lang === 'da-DK')
        || voices.find(v => (v.lang || '').toLowerCase().startsWith('da'))
        || null;
  }

  get hasDanishVoice() { return !!this.voice; }

  /* iOS/Safari kræver at den første oplæsning kommer fra et klik. */
  unlock() {
    if (!this.supported) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (_) { /* ligegyldigt hvis det fejler */ }
  }

  /* Læses der stadig op lige nu? Afspilleren spørger om dette hvert billede
     i stedet for at blive sluppet fri af en callback — så er der ingen
     rækkefølge at tage fejl af. */
  get busy() {
    if (!this.speaking) return false;
    // Sikkerhedsnet: fyrer browseren aldrig 'end', må afspilningen ikke hænge.
    if (performance.now() > this.deadline) { this.speaking = false; return false; }
    return true;
  }

  stop() {
    this.token++;
    this.speaking = false;
    if (this.supported) { try { speechSynthesis.cancel(); } catch (_) {} }
    if (this.audio) { this.audio.pause(); this.audio = null; }
  }

  say(step) {
    this.stop();
    const text = (step.speech || step.text || '').replace(/\s+/g, ' ').trim();
    if (!this.enabled || !text) return;

    const my = this.token;
    const done = () => { if (my === this.token) this.speaking = false; };
    this.speaking = true;
    this.deadline = performance.now()
      + Math.min(30000, 1600 + text.split(' ').length * 430) + 8000;

    // Er der lagt en rigtig indtaling på trinnet, vinder den over den
    // syntetiske stemme. Koden skal ikke ændres for at skifte.
    if (step.audio) {
      this.audio = new Audio(step.audio);
      this.audio.addEventListener('ended', done);
      this.audio.addEventListener('error', done);
      this.audio.play().catch(done);
      return;
    }

    if (!this.supported) { this.speaking = false; return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'da-DK';
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    u.pitch = 1;
    u.addEventListener('end', done);
    u.addEventListener('error', done);
    speechSynthesis.speak(u);
  }

  softPause() {
    if (this.supported) { try { speechSynthesis.pause(); } catch (_) {} }
    if (this.audio) this.audio.pause();
  }

  softResume() {
    if (this.supported) { try { speechSynthesis.resume(); } catch (_) {} }
    if (this.audio) this.audio.play().catch(() => {});
  }
}
