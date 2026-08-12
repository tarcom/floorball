/* court.js — banens geometri og tegning.
 *
 * Alle taktik-koordinater er i METER på en 40 x 20 m bane:
 *   x = 0 ved vores egen kortside, x = 40 ved modstanderens.
 *   y = 0 er "venstre" side set i vores angrebsretning, y = 20 er højre.
 * Vores hold forsvarer altid målet ved x = 2,85 og angriber mod høje x.
 * Det er med vilje ens i ALLE scener, så billedet er til at genkende.
 *
 * Banemarkeringer er tegnet efter de officielle mål, men er en illustration
 * — ikke en opmålingstegning. Bullypunkternes præcise placering er vejledende.
 */

const COURT = {
  L: 40,          // længde
  W: 20,          // bredde
  R: 1,           // hjørneradius
  GL: 2.85,       // mållinje målt fra kortsiden
  GOAL_W: 1.6,    // målets bredde
  GOAL_D: 0.4,    // målets dybde (bagud mod banden)
  // Betegnelserne følger den danske regelbog: MÅLFELTET er det STØRSTE af de
  // to rektangler foran målet, og målvogterfeltet er det lille indeni.
  AREA_W: 5,      // målfelt, bredde
  AREA_D: 4,      // målfelt, dybde ind mod midten
  CREASE_W: 2.5,  // målvogterfelt, bredde
  CREASE_D: 1,    // målvogterfelt, dybde
};

/* Vores hold har VHG-logoets lilla-blå, modstanderen rød og bolden logoets
   gule. Fremhævninger bruger floorball-afdelingens grønne. */
const COLORS = {
  boards:   '#2b2a44',
  surface:  '#e7eaf3',
  line:     '#9a9cbb',
  lineSoft: '#c6c8dd',
  area:     '#d6d9ea',
  crease:   '#c2c5de',
  helper:   '#b0b2cc',
  home:     '#3B3573',
  homeDark: '#211C46',
  away:     '#D9443A',
  awayDark: '#8E2318',
  ball:     '#FFCC1F',
  ballDark: '#8a6a00',
  focus:    '#00A08A',
};

class CourtView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.vertical = false;
    this.s = 10;
    this.ox = 0;
    this.oy = 0;
    this.showHelpers = true;
  }

  /* Vælg liggende eller stående bane ud fra hvor bred plads vi har.
     På en telefon i højformat er en 2:1-bane alt for lav til at man kan se
     seks prikker — der drejes banen 90 grader, så vi angriber opad. */
  resize(preferVertical) {
    const cv = this.canvas;
    this.vertical = preferVertical;
    cv.classList.toggle('is-vertical', preferVertical);
    cv.classList.toggle('is-horizontal', !preferVertical);

    const rect = cv.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }

    // Bredde/højde i meter i den valgte orientering, plus lidt luft til banden.
    const mw = this.vertical ? COURT.W : COURT.L;
    const mh = this.vertical ? COURT.L : COURT.W;
    this.s = Math.min(rect.width / (mw + 0.8), rect.height / (mh + 0.8));
    this.ox = (rect.width - mw * this.s) / 2;
    this.oy = (rect.height - mh * this.s) / 2;
    this.dpr = dpr;
    this.px = rect.width;
    this.py = rect.height;
    return true;
  }

  /* Meter -> skærmpixels. Den lodrette variant er en ægte rotation
     (ikke et spejlbillede), så venstre side bliver ved med at være venstre. */
  P(x, y) {
    return this.vertical
      ? [this.ox + y * this.s, this.oy + (COURT.L - x) * this.s]
      : [this.ox + x * this.s, this.oy + y * this.s];
  }

  m(meters) { return meters * this.s; }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.px, this.py);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  /* --- baneelementer ------------------------------------------------- */

  rinkPath() {
    const ctx = this.ctx;
    const r = this.m(COURT.R);
    const c = [this.P(0, 0), this.P(COURT.L, 0), this.P(COURT.L, COURT.W), this.P(0, COURT.W)];
    const mid = [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2];
    ctx.beginPath();
    ctx.moveTo(mid[0], mid[1]);
    for (let i = 1; i <= 4; i++) {
      const a = c[i % 4], b = c[(i + 1) % 4];
      ctx.arcTo(a[0], a[1], b[0], b[1], r);
    }
    ctx.closePath();
  }

  poly(points, close = true) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const [px, py] = this.P(x, y);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    if (close) ctx.closePath();
  }

  line(x1, y1, x2, y2, color, width, dash) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, this.m(width));
    const a = this.P(x1, y1), b = this.P(x2, y2);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }

  dot(x, y, rMeters, color) {
    const ctx = this.ctx;
    const [px, py] = this.P(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, this.m(rMeters), 0, Math.PI * 2);
    ctx.fill();
  }

  ring(x, y, rPx, color, width, dash) {
    const ctx = this.ctx;
    const [px, py] = this.P(x, y);
    ctx.save();
    ctx.setLineDash(dash || []);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(px, py, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  goalAt(side) {
    // side: -1 = vores mål (venstre), +1 = modstanderens (højre)
    const ctx = this.ctx;
    const gx = side < 0 ? COURT.GL : COURT.L - COURT.GL;
    const back = side < 0 ? gx - COURT.GOAL_D : gx + COURT.GOAL_D;
    const y0 = COURT.W / 2 - COURT.GOAL_W / 2;
    const y1 = COURT.W / 2 + COURT.GOAL_W / 2;

    // målområde og målfelt strækker sig fra mållinjen ind mod midten
    const aTo = side < 0 ? gx + COURT.AREA_D : gx - COURT.AREA_D;
    const cTo = side < 0 ? gx + COURT.CREASE_D : gx - COURT.CREASE_D;

    this.poly([
      [gx, COURT.W / 2 - COURT.AREA_W / 2], [aTo, COURT.W / 2 - COURT.AREA_W / 2],
      [aTo, COURT.W / 2 + COURT.AREA_W / 2], [gx, COURT.W / 2 + COURT.AREA_W / 2],
    ]);
    ctx.fillStyle = COLORS.area;
    ctx.fill();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = Math.max(1, this.m(0.09));
    ctx.stroke();

    this.poly([
      [gx, COURT.W / 2 - COURT.CREASE_W / 2], [cTo, COURT.W / 2 - COURT.CREASE_W / 2],
      [cTo, COURT.W / 2 + COURT.CREASE_W / 2], [gx, COURT.W / 2 + COURT.CREASE_W / 2],
    ]);
    ctx.fillStyle = COLORS.crease;
    ctx.fill();
    ctx.stroke();

    // selve målet
    this.poly([[gx, y0], [back, y0], [back, y1], [gx, y1]]);
    ctx.fillStyle = '#fbfdff';
    ctx.fill();
    ctx.strokeStyle = COLORS.boards;
    ctx.lineWidth = Math.max(1.5, this.m(0.14));
    ctx.stroke();
  }

  drawRink() {
    const ctx = this.ctx;

    this.rinkPath();
    ctx.fillStyle = COLORS.surface;
    ctx.fill();

    // Hjælpelinjer: banen har ikke tredjedelslinjer i virkeligheden, men de
    // gør det meget nemmere at tale om "egen zone / midterbane / angrebszone".
    if (this.showHelpers) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      this.line(COURT.L / 3, 0, COURT.L / 3, COURT.W, COLORS.helper, 0.07, [this.m(0.5), this.m(0.45)]);
      this.line(2 * COURT.L / 3, 0, 2 * COURT.L / 3, COURT.W, COLORS.helper, 0.07, [this.m(0.5), this.m(0.45)]);
      ctx.restore();
    }

    this.line(COURT.L / 2, 0, COURT.L / 2, COURT.W, COLORS.line, 0.1);
    this.dot(COURT.L / 2, COURT.W / 2, 0.22, COLORS.line);

    // bullypunkter (vejledende placering)
    for (const bx of [COURT.GL + COURT.AREA_D, COURT.L - COURT.GL - COURT.AREA_D]) {
      for (const by of [3.5, COURT.W - 3.5]) {
        this.ring(bx, by, this.m(0.5), COLORS.lineSoft, Math.max(1, this.m(0.07)));
      }
    }

    this.goalAt(-1);
    this.goalAt(1);

    this.rinkPath();
    ctx.strokeStyle = COLORS.boards;
    ctx.lineWidth = Math.max(2, this.m(0.22));
    ctx.stroke();
  }

  /* --- spillere og bold ---------------------------------------------- */

  playerRadiusPx() { return Math.max(9, this.m(0.62)); }

  drawPlayer(x, y, team, label, opts = {}) {
    const ctx = this.ctx;
    const [px, py] = this.P(x, y);
    const r = this.playerRadiusPx() * (team === 'away' ? 0.92 : 1);
    const fill = team === 'away' ? COLORS.away : COLORS.home;
    const edge = team === 'away' ? COLORS.awayDark : COLORS.homeDark;

    if (opts.focus) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(opts.phase * 4);
      ctx.strokeStyle = COLORS.focus;
      ctx.lineWidth = Math.max(2.5, r * 0.34);
      ctx.beginPath();
      ctx.arc(px, py, r * 1.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(10,20,35,.45)';
    ctx.shadowBlur = r * 0.6;
    ctx.shadowOffsetY = r * 0.18;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = opts.hasBall ? COLORS.ball : edge;
    ctx.lineWidth = opts.hasBall ? Math.max(2, r * 0.28) : Math.max(1, r * 0.14);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();

    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(r * (label.length > 2 ? 0.78 : 0.95))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, py + r * 0.04);
    }
  }

  drawBall(x, y) {
    const ctx = this.ctx;
    const [px, py] = this.P(x, y);
    const r = Math.max(5, this.m(0.36));
    ctx.save();
    ctx.shadowColor = 'rgba(10,20,35,.5)';
    ctx.shadowBlur = r * 1.1;
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = COLORS.ballDark;
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* --- overlays -------------------------------------------------------- */

  trail(points, color) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, this.m(0.13));
    ctx.setLineDash([this.m(0.32), this.m(0.34)]);
    for (let i = 1; i < points.length; i++) {
      const a = this.P(points[i - 1][0], points[i - 1][1]);
      const b = this.P(points[i][0], points[i][1]);
      ctx.globalAlpha = 0.06 + 0.34 * (i / points.length);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  arrow(from, to, color, opts = {}) {
    const ctx = this.ctx;
    const a = this.P(from[0], from[1]);
    const b = this.P(to[0], to[1]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const ux = dx / len, uy = dy / len;
    const head = Math.max(7, this.m(0.75));
    const tip = [b[0] - ux * head * 0.25, b[1] - uy * head * 0.25];
    const base = [tip[0] - ux * head, tip[1] - uy * head];

    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, this.m(opts.width ?? 0.16));
    ctx.setLineDash(opts.dash ? [this.m(0.6), this.m(0.4)] : []);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(base[0], base[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(base[0] - uy * head * 0.42, base[1] + ux * head * 0.42);
    ctx.lineTo(base[0] + uy * head * 0.42, base[1] - ux * head * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* Mærkater tegnes ikke her, men i et lag for sig efter spillerne —
     ellers lægger prikkerne sig oven på teksten. */
  zone(points, color) {
    const ctx = this.ctx;
    ctx.save();
    this.poly(points);
    ctx.globalAlpha = 0.17;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, this.m(0.1));
    ctx.setLineDash([this.m(0.55), this.m(0.4)]);
    ctx.stroke();
    ctx.restore();
  }

  /* Lille tekstmærkat i skærmkoordinater — den vender altid rigtigt,
     også når banen er drejet på højkant, og holdes inden for lærredet. */
  tag(px, py, text, color) {
    const ctx = this.ctx;
    const fs = Math.max(10, Math.min(15, this.m(0.62)));
    ctx.save();
    ctx.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + fs * 0.9;
    const h = fs * 1.65;
    px = Math.max(w / 2 + 2, Math.min(this.px - w / 2 - 2, px));
    py = Math.max(h / 2 + 2, Math.min(this.py - h / 2 - 2, py));
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(px - w / 2 + r, py - h / 2);
    ctx.arcTo(px + w / 2, py - h / 2, px + w / 2, py + h / 2, r);
    ctx.arcTo(px + w / 2, py + h / 2, px - w / 2, py + h / 2, r);
    ctx.arcTo(px - w / 2, py + h / 2, px - w / 2, py - h / 2, r);
    ctx.arcTo(px - w / 2, py - h / 2, px + w / 2, py - h / 2, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#16202c';
    ctx.fillText(text, px, py + 0.5);
    ctx.restore();
  }
}
