/* check.js — kontrollerer scenedata uden at åbne en browser.
 *
 *     node check.js
 *
 * Kør den hver gang du har rettet i site/scenes.js. Den fanger de fejl der
 * ellers først opdages ved at sidde og kigge på en 30 sekunders animation:
 * tastefejl i spillernavne, keyframes i forkert rækkefølge, spillere uden
 * for banen, og prikker der lægger sig oven på hinanden.
 *
 * Afslutter med kode 1 hvis der er fejl, så den kan bruges i et hook.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = path.join(__dirname, 'site');

// `const` på topniveau bliver ikke egenskaber på vm-konteksten, så de
// eksporteres eksplicit til sidst.
const src = ['court.js', 'engine.js', 'scenes.js']
  .map(f => fs.readFileSync(path.join(SITE, f), 'utf8')).join('\n;\n')
  + '\n;Object.assign(globalThis, { SCENES, Scene, CATEGORIES, COURT });';

const ctx = { console, performance: { now: () => 0 }, requestAnimationFrame: () => {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);

const { SCENES, Scene, CATEGORIES, COURT } = ctx;
let errors = 0, warns = 0;
const err = (m) => { console.log('  FEJL  ' + m); errors++; };
const warn = (m) => { console.log('  advar ' + m); warns++; };

const ids = new Set();
console.log(`${SCENES.length} scener\n`);

for (const def of SCENES) {
  console.log(`— ${def.id} (${def.category}) "${def.title}" ${def.duration}s`);
  if (ids.has(def.id)) err(`dobbelt id: ${def.id}`);
  ids.add(def.id);
  if (!CATEGORIES.includes(def.category)) err(`ukendt kategori: ${def.category}`);

  const sc = new Scene(def);
  const known = new Set(sc.players.map(p => p.id));

  // keyframes: stigende tid, inden for banen, inden for scenens længde
  for (const p of sc.players) {
    if (!p.keys || !p.keys.length) { err(`${p.id} har ingen keyframes`); continue; }
    let prev = -Infinity;
    for (const k of p.keys) {
      const [t, x, y] = k;
      if (typeof t !== 'number' || typeof x !== 'number' || typeof y !== 'number')
        err(`${p.id} har et keyframe der ikke er tal: ${JSON.stringify(k)}`);
      if (t < prev) err(`${p.id} keyframes er ikke i tidsrækkefølge ved t=${t}`);
      prev = t;
      if (x < 0.3 || x > COURT.L - 0.3 || y < 0.3 || y > COURT.W - 0.3)
        err(`${p.id} står uden for banen ved t=${t}: (${x}, ${y})`);
      if (t > def.duration + 0.01) warn(`${p.id} har keyframe efter scenen slutter (t=${t} > ${def.duration})`);
    }
    if (p.keys[p.keys.length - 1][0] < def.duration - 6 && p.to > 1e8)
      warn(`${p.id} står stille de sidste ${(def.duration - p.keys[p.keys.length - 1][0]).toFixed(1)}s`);
  }

  // bold: referencer skal findes, tiden skal stige
  let prev = -Infinity;
  for (const k of (def.ball || [])) {
    if (k[0] < prev) err(`bold-keyframes er ikke i tidsrækkefølge ved t=${k[0]}`);
    prev = k[0];
    if (typeof k[1] === 'string') {
      if (!known.has(k[1])) err(`bolden peger på ukendt spiller "${k[1]}" ved t=${k[0]}`);
    } else if (k[1] < 0.2 || k[1] > COURT.L - 0.2 || k[2] < 0.2 || k[2] > COURT.W - 0.2) {
      err(`bolden er uden for banen ved t=${k[0]}: (${k[1]}, ${k[2]})`);
    }
  }

  // events
  for (const e of (def.events || [])) {
    if (!['zone', 'arrow', 'marker'].includes(e.type)) err(`ukendt event-type "${e.type}"`);
    if (e.until != null && e.until <= e.t) err(`event "${e.label}" slutter før den starter`);
    for (const f of ['from', 'to', 'at']) {
      if (typeof e[f] === 'string' && !known.has(e[f])) err(`event "${e.label}" peger på ukendt spiller "${e[f]}"`);
    }
    if (e.t > def.duration) warn(`event "${e.label}" starter efter scenen slutter`);
  }

  // trin
  if (!sc.steps.length) err('ingen trin');
  sc.steps.forEach((s, i) => {
    if (!s.text || s.text.length < 20) err(`trin ${i} har ingen rigtig tekst`);
    if (s.t > def.duration) err(`trin ${i} starter efter scenen slutter (${s.t} > ${def.duration})`);
    if (s.focus) for (const id of s.focus) if (!known.has(id)) err(`trin ${i} fokuserer på ukendt spiller "${id}"`);
  });
  if (sc.steps.length && sc.steps[0].t > 0.15) warn('første trin starter ikke ved t=0');

  // Målmand plus mindst fire markspillere. Undertalsscener har kun fire.
  const homeLabels = new Set(sc.players.filter(p => p.team === 'home').map(p => p.label));
  if (!homeLabels.has('MV')) err('vores hold mangler målmand');
  const outfield = sc.players.filter(p => p.team === 'home' && p.label !== 'MV').length;
  if (outfield < 4) err(`vores hold har kun ${outfield} markspillere`);

  /* Prikkerne har ~0,62 m radius, så de dækker hinanden under 1,25 m.
     Et kort sammenstød er realistisk — det er det vedvarende overlap, der
     ser ud som en fejl. Der advares først ved 1 s under 0,75 m. */
  const streak = {};
  const stacked = new Set();
  for (let t = 0; t <= def.duration; t += 0.25) {
    const seen = [];
    const near = new Set();
    for (const p of sc.activePlayers(t)) {
      const pos = sc.posOf(p.id, t);
      for (const [oid, o] of seen) {
        const d = Math.hypot(pos[0] - o[0], pos[1] - o[1]);
        if (d < 0.75) near.add(`${oid}+${p.id}`);
        // Helt oven i hinanden er altid en fejl, uanset hvor kort det varer.
        if (d < 0.3 && !stacked.has(`${oid}+${p.id}`)) {
          stacked.add(`${oid}+${p.id}`);
          warn(`${oid}+${p.id} står helt oven i hinanden ved t=${t.toFixed(2)}`);
        }
      }
      seen.push([p.id, pos]);
    }
    for (const k of Object.keys(streak)) if (!near.has(k)) delete streak[k];
    for (const k of near) {
      streak[k] = (streak[k] || 0) + 1;
      if (streak[k] === 3) warn(`${k} dækker hinanden i mindst 0,75 s fra t=${(t - 0.5).toFixed(2)}`);
    }
  }

  // bolden skal kunne beregnes hele vejen igennem
  for (let t = 0; t <= def.duration; t += 0.1) {
    const b = sc.ballAt(t);
    if (!b || !isFinite(b[0]) || !isFinite(b[1])) { err(`bolden kan ikke beregnes ved t=${t.toFixed(1)}`); break; }
    if (b[0] < -0.5 || b[0] > COURT.L + 0.5 || b[1] < -0.5 || b[1] > COURT.W + 0.5) {
      err(`bolden havner uden for banen ved t=${t.toFixed(1)}: (${b[0].toFixed(1)}, ${b[1].toFixed(1)})`); break;
    }
  }
}

console.log(`\n${errors} fejl, ${warns} advarsler`);
process.exit(errors ? 1 : 0);
