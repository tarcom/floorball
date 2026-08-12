/* app.js — binder scener, bane og afspiller sammen med brugerfladen. */

const $ = (sel) => document.querySelector(sel);

const el = {
  nav: $('#nav'),
  title: $('#sceneTitle'),
  summary: $('#sceneSummary'),
  canvas: $('#court'),
  stage: $('#stage'),
  caption: $('#caption'),
  steps: $('#steps'),
  points: $('#points'),
  play: $('#play'),
  restart: $('#restart'),
  prevStep: $('#prevStep'),
  nextStep: $('#nextStep'),
  scrub: $('#scrub'),
  ticks: $('#ticks'),
  time: $('#time'),
  rate: $('#rate'),
  speech: $('#speech'),
  speechNote: $('#speechNote'),
  optTrails: $('#optTrails'),
  optHelpers: $('#optHelpers'),
  optWait: $('#optWait'),
  prev: $('#prevScene'),
  next: $('#nextScene'),
  prevName: $('#prevSceneName'),
  nextName: $('#nextSceneName'),
  commentList: $('#commentList'),
  commentEmpty: $('#commentEmpty'),
  commentForm: $('#commentForm'),
  cName: $('#cName'),
  cText: $('#cText'),
  cHoney: $('#cHoney'),
  cSend: $('#cSend'),
  cStatus: $('#cStatus'),
};

const view = new CourtView(el.canvas);
const speaker = new Speaker();

let scene = null;
let sceneIndex = 0;
let lastStepIdx = -2;
let showTrails = true;
let waitForSpeech = true;

const player = new Player(render);

/* Vent på tale: vi holder IKKE pause i starten af et trin — så ville
   billedet stå stille mens der blev talt. Vi lader trinnet spille færdig
   og venter først ved trinnets slutning, hvis oplæsningen ikke er nået i mål.
   Så følges bevægelse og tale ad, og næste trin begynder aldrig for tidligt. */
player.shouldWait = () => {
  if (!waitForSpeech || !speaker.enabled || !scene || !speaker.busy) return false;
  const i = scene.stepAt(player.t);
  if (i < 0) return false;
  const next = scene.steps[i + 1];
  const end = next ? next.t : scene.duration;
  return player.t >= end - 0.06;
};

/* ------------------------------------------------------------------ menu */

function buildNav() {
  el.nav.innerHTML = '';
  for (const cat of CATEGORIES) {
    const group = document.createElement('div');
    group.className = 'nav-group';
    const h = document.createElement('h2');
    h.textContent = cat;
    group.appendChild(h);
    SCENES.forEach((s, i) => {
      if (s.category !== cat) return;
      const b = document.createElement('button');
      b.className = 'nav-item';
      b.dataset.index = i;
      b.innerHTML = `<span class="nav-title">${s.title}</span><span class="nav-sub">${s.summary}</span>`;
      b.addEventListener('click', () => { loadScene(i); closeNavOnMobile(); });
      group.appendChild(b);
    });
    el.nav.appendChild(group);
  }
}

function markNav() {
  el.nav.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('is-active', Number(b.dataset.index) === sceneIndex);
  });
}

function closeNavOnMobile() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.body.classList.remove('nav-open');
  }
}

/* --------------------------------------------------------------- indlæs */

function loadScene(i, autoplay = true) {
  sceneIndex = (i + SCENES.length) % SCENES.length;
  scene = new Scene(SCENES[sceneIndex]);
  lastStepIdx = -2;
  speaker.stop();

  el.title.textContent = scene.title;
  el.summary.textContent = scene.summary;
  el.scrub.max = String(scene.duration);
  el.scrub.value = '0';

  el.steps.innerHTML = '';
  el.ticks.innerHTML = '';
  scene.steps.forEach((s, idx) => {
    const li = document.createElement('li');
    li.className = 'step';
    li.dataset.idx = idx;
    li.innerHTML = `<span class="step-time">${fmt(s.t)}</span><span class="step-text">${s.text}</span>`;
    li.addEventListener('click', () => gotoStep(idx));
    el.steps.appendChild(li);

    // hak på tidslinjen, så man kan se hvor trinnene ligger
    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.style.left = `${(s.t / scene.duration) * 100}%`;
    el.ticks.appendChild(tick);
  });

  el.points.innerHTML = '';
  (scene.points || []).forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    el.points.appendChild(li);
  });

  const prev = SCENES[(sceneIndex - 1 + SCENES.length) % SCENES.length];
  const next = SCENES[(sceneIndex + 1) % SCENES.length];
  el.prevName.textContent = prev.title;
  el.nextName.textContent = next.title;

  loadComments(scene.id);

  player.load(scene.duration);
  if (autoplay) player.play();
  markNav();
  history.replaceState(null, '', '#' + scene.id);
  layout();
}

/* --------------------------------------------------------- kommentarer */

/* Serveren gemmer og sender UTC (…Z). Vi viser dansk lokaltid, så en
   kommentar skrevet efter træning ikke ser ud til at være fra to timer siden. */
function formatWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('da-DK', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function renderComments(list) {
  el.commentList.innerHTML = '';
  el.commentEmpty.hidden = list.length > 0;
  for (const c of list) {
    const li = document.createElement('li');
    li.className = 'comment';
    const head = document.createElement('div');
    head.className = 'comment-head';
    const b = document.createElement('b');
    b.textContent = c.name;                 // textContent, ikke innerHTML —
    head.appendChild(b);                    // navne og tekst kommer udefra
    head.append(' · ' + formatWhen(c.created));
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.textContent = c.text;
    li.append(head, body);
    el.commentList.appendChild(li);
  }
}

async function loadComments(sceneId) {
  renderComments([]);
  el.cStatus.textContent = '';
  try {
    const r = await fetch(`api/comments.php?scene=${encodeURIComponent(sceneId)}`, { cache: 'no-store' });
    const data = await r.json();
    if (data.ok && sceneId === scene.id) renderComments(data.comments);
  } catch (_) {
    // Lokalt uden PHP findes der ingen backend. Så viser vi bare formularen
    // og lader være med at genere brugeren med en fejl.
  }
}

el.commentForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = el.cName.value.trim();
  const text = el.cText.value.trim();
  if (!name || !text) return;

  el.cSend.disabled = true;
  el.cStatus.className = 'note';
  el.cStatus.textContent = 'Sender…';
  try {
    const r = await fetch('api/comments.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene: scene.id, name, text, hp: el.cHoney.value }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Det gik galt.');
    renderComments(data.comments);
    el.cText.value = '';
    el.cStatus.className = 'note is-ok';
    el.cStatus.textContent = 'Tak — den er på.';
  } catch (err) {
    el.cStatus.className = 'note is-error';
    el.cStatus.textContent = err.message || 'Kunne ikke sende. Prøv igen om lidt.';
  } finally {
    el.cSend.disabled = false;
  }
});

function fmt(t) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------- tegning */

/* På en telefon i højformat drejes banen 90 grader, så vi angriber opad.
   En liggende 2:1-bane bliver alt for lav til at man kan skelne seks prikker.
   På en telefon i landskab er der omvendt ikke højde nok — der bliver den liggende. */
function wantVertical() {
  const w = el.stage.clientWidth;
  return w < 620 && window.innerHeight / Math.max(1, w) > 1.15;
}

function layout() {
  view.resize(wantVertical());
}

function alphaFor(e, t) {
  const end = e.until ?? (e.t + 2.2);
  const inFade = Math.min(1, (t - e.t) / 0.25);
  const outFade = Math.min(1, (end - t) / 0.4);
  return Math.max(0, Math.min(1, Math.min(inFade, outFade)));
}

function render(t, wallClock) {
  if (!scene) return;
  if (!view.resize(wantVertical())) return;

  view.showHelpers = el.optHelpers.checked;
  view.begin();
  view.drawRink();

  const stepIdx = scene.stepAt(t);
  const step = stepIdx >= 0 ? scene.steps[stepIdx] : null;
  const focus = new Set((step && step.focus) || []);
  const events = scene.activeEvents(t);
  const ctx = view.ctx;

  // Mærkater samles op undervejs og tegnes til allersidst, så hverken
  // spillere eller bold kan lægge sig oven på teksten.
  const labels = [];

  // 1) zoner nederst, så alt andet kan ses ovenpå
  for (const e of events) {
    if (e.type !== 'zone') continue;
    const a = alphaFor(e, t);
    ctx.save();
    ctx.globalAlpha = a;
    view.zone(e.poly, e.color || COLORS.home);
    ctx.restore();
    if (e.label) {
      labels.push({
        at: e.labelAt || [e.poly.reduce((s, p) => s + p[0], 0) / e.poly.length,
                          e.poly.reduce((s, p) => s + p[1], 0) / e.poly.length],
        text: e.label, color: e.color || COLORS.home, alpha: a,
      });
    }
  }

  // 2) bevægelsesspor
  if (showTrails) {
    for (const p of scene.activePlayers(t)) {
      // Sporet må ikke række længere tilbage end til det tidspunkt spilleren
      // kom på banen — ellers får en indskiftet spiller et spor fra bænken.
      const window = Math.min(2.6, Math.max(0, t - Math.max(0, p.from)));
      if (window < 0.2) continue;
      const pts = scene.trailOf(p.id, t, window);
      if (pts.length) view.trail(pts, p.team === 'away' ? COLORS.away : COLORS.home);
    }
  }

  // 3) pile og markeringer
  for (const e of events) {
    const a = alphaFor(e, t);
    const color = e.color || COLORS.focus;
    if (e.type === 'arrow') {
      const from = typeof e.from === 'string' ? scene.posOf(e.from, t) : e.from;
      const to = typeof e.to === 'string' ? scene.posOf(e.to, t) : e.to;
      view.arrow(from, to, color, { alpha: a, dash: e.dash });
      if (e.label) {
        // Uden labelAt lægges mærkaten vinkelret ud fra pilen, væk fra
        // midterlinjen, hvor der som regel er færrest spillere i vejen.
        let at = e.labelAt;
        if (!at) {
          const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
          const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
          let nx = -(to[1] - from[1]) / len, ny = (to[0] - from[0]) / len;
          if ((mid[1] - COURT.W / 2) * ny < 0) { nx = -nx; ny = -ny; }
          at = [mid[0] + nx * 1.3, mid[1] + ny * 1.3];
        }
        labels.push({ at, text: e.label, color, alpha: a });
      }
    } else if (e.type === 'marker') {
      const at = typeof e.at === 'string' ? scene.posOf(e.at, t) : e.at;
      ctx.save();
      ctx.globalAlpha = a;
      view.ring(at[0], at[1], view.playerRadiusPx() * 2.1, color,
                Math.max(2, view.m(0.12)), [view.m(0.4), view.m(0.35)]);
      ctx.restore();
      if (e.label) labels.push({ at: e.labelAt || at, text: e.label, color, alpha: a, lift: !e.labelAt });
    }
  }

  // 4) boldens hale, så afleveringer kan ses som streger
  const ball = scene.ballAt(t);
  if (ball) {
    const tail = [];
    for (let i = 6; i >= 0; i--) {
      const b = scene.ballAt(Math.max(0, t - i * 0.055));
      if (b) tail.push(b);
    }
    const moved = Math.hypot(tail[0][0] - ball[0], tail[0][1] - ball[1]);
    if (moved > 0.6) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < tail.length; i++) {
        const a = view.P(tail[i - 1][0], tail[i - 1][1]);
        const b = view.P(tail[i][0], tail[i][1]);
        ctx.globalAlpha = 0.12 + 0.5 * (i / tail.length);
        ctx.strokeStyle = COLORS.ball;
        ctx.lineWidth = Math.max(2, view.m(0.18)) * (i / tail.length);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 5) spillere — modstanderen først, så vores egne ligger øverst
  const carrier = scene.carrierAt(t);
  const actors = scene.activePlayers(t).sort((a, b) => (a.team === 'away' ? -1 : 1) - (b.team === 'away' ? -1 : 1));
  for (const p of actors) {
    const [x, y] = scene.posOf(p.id, t);
    view.drawPlayer(x, y, p.team, p.label, {
      focus: focus.has(p.id),
      phase: wallClock,
      hasBall: carrier === p.id,
    });
  }

  if (ball) view.drawBall(ball[0], ball[1]);

  // 6) mærkater øverst
  for (const l of labels) {
    const [px, py] = view.P(l.at[0], l.at[1]);
    ctx.save();
    ctx.globalAlpha = l.alpha;
    view.tag(px, py - (l.lift ? view.playerRadiusPx() * 2.9 : 0), l.text, l.color);
    ctx.restore();
  }

  // 7) brugerflade
  if (stepIdx !== lastStepIdx) {
    lastStepIdx = stepIdx;
    onStepChange(stepIdx);
  }
  if (document.activeElement !== el.scrub) el.scrub.value = String(t);
  el.time.textContent = `${fmt(t)} / ${fmt(scene.duration)}`;
  const label = player.playing ? '⏸' : (player.atEnd ? '↻' : '▶');
  if (el.play.textContent !== label) {
    el.play.textContent = label;
    el.play.setAttribute('aria-label',
      player.playing ? 'Pause' : (player.atEnd ? 'Spil igen' : 'Afspil'));
  }
  el.stage.classList.toggle('is-waiting', player.playing && player.shouldWait());
}

/* --------------------------------------------------------------- trin */

function onStepChange(idx) {
  const step = idx >= 0 ? scene.steps[idx] : null;
  el.caption.textContent = step ? step.text : '';
  el.steps.querySelectorAll('.step').forEach(li => {
    li.classList.toggle('is-active', Number(li.dataset.idx) === idx);
  });
  if (!step) { speaker.stop(); return; }
  if (speaker.enabled) speaker.say(step);
}

/* ------------------------------------------------------------ kontroller */

/* Et trin afspilles frem til lige før det næste begynder, så teksten bliver
   stående i stedet for at hoppe videre i samme øjeblik man stopper. */
function gotoStep(target) {
  if (!scene || !scene.steps.length) return;
  target = Math.max(0, Math.min(scene.steps.length - 1, target));
  const next = scene.steps[target + 1];
  speaker.stop();
  speaker.unlock();
  lastStepIdx = -2;
  player.seek(scene.steps[target].t + 0.01);
  player.play(next ? next.t - 0.05 : scene.duration);
}

function currentStep() { return Math.max(0, scene ? scene.stepAt(player.t) : 0); }

el.play.addEventListener('click', () => {
  if (player.playing) {
    player.pause();
    speaker.softPause();
  } else {
    speaker.unlock();
    if (player.atEnd) { speaker.stop(); lastStepIdx = -2; }
    player.play();
    speaker.softResume();
  }
});

el.restart.addEventListener('click', () => {
  speaker.stop();
  lastStepIdx = -2;
  player.seek(0);
  player.play();
});

// Står vi et stykke inde i et trin, går "forrige" til trinnets start —
// samme opførsel som spring-tilbage på en musikafspiller.
el.prevStep.addEventListener('click', () => {
  const i = currentStep();
  gotoStep(player.t > scene.steps[i].t + 0.9 ? i : i - 1);
});
el.nextStep.addEventListener('click', () => gotoStep(currentStep() + 1));

el.scrub.addEventListener('input', () => { speaker.stop(); player.seek(Number(el.scrub.value)); });
el.rate.addEventListener('change', () => { player.rate = Number(el.rate.value); });
el.prev.addEventListener('click', () => loadScene(sceneIndex - 1));
el.next.addEventListener('click', () => loadScene(sceneIndex + 1));

el.optTrails.addEventListener('change', () => { showTrails = el.optTrails.checked; });
el.optWait.addEventListener('change', () => { waitForSpeech = el.optWait.checked; });

el.speech.addEventListener('click', () => {
  speaker.enabled = !speaker.enabled;
  el.speech.classList.toggle('is-on', speaker.enabled);
  el.speech.textContent = speaker.enabled ? '🔊 Tale til' : '🔇 Tale fra';
  if (speaker.enabled) {
    speaker.unlock();
    updateSpeechNote();
    lastStepIdx = -2;           // læs det aktuelle trin op med det samme
  } else {
    speaker.stop();
    el.speechNote.textContent = '';
  }
});

function updateSpeechNote() {
  if (!speaker.supported) {
    el.speechNote.textContent = 'Denne browser kan ikke læse op. Prøv Chrome, Edge eller Safari.';
  } else if (!speaker.hasDanishVoice) {
    el.speechNote.textContent = 'Der er ingen dansk stemme installeret på enheden — teksten læses op med en anden stemme og lyder mærkelig.';
  } else {
    el.speechNote.textContent = '';
  }
}

document.addEventListener('keydown', (ev) => {
  if (ev.target.matches('input, select, textarea')) return;
  if (ev.code === 'Space') { ev.preventDefault(); el.play.click(); }
  else if (ev.code === 'ArrowLeft') { ev.preventDefault(); el.prevStep.click(); }
  else if (ev.code === 'ArrowRight') { ev.preventDefault(); el.nextStep.click(); }
});

$('#navToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 120));

/* ------------------------------------------------------------------ start */

buildNav();
const fromHash = SCENES.findIndex(s => s.id === location.hash.replace('#', ''));
loadScene(fromHash >= 0 ? fromHash : 0, false);
layout();

/* ?t=5.4 hopper til et bestemt sekund og holder pause. Bruges til at
   kontrollere en scene billede for billede, mens man skriver den. */
const seekTo = Number(new URLSearchParams(location.search).get('t'));
if (isFinite(seekTo) && location.search.includes('t=')) {
  player.seek(seekTo);
  player.pause();
} else {
  player.play();
}
