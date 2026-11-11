/**
 * Try-it-yourself ink for the QuiteHandy sheets.
 *
 * Each `[data-sheet]` gets one behaviour, mirroring the app:
 *   draw     – drag to draw a line
 *   rainbow  – drag to draw a line that runs through every colour
 *   stamp    – click to put down numbered circles 1, 2, 3 …
 *   zoom     – the hand turns into a 3× loupe over the sheet
 *
 * Strokes are stored in sheet-relative units (fractions of the sheet width),
 * so they survive resizes. The sheet itself clips the canvas.
 */

type Feature = 'draw' | 'rainbow' | 'stamp' | 'zoom';
type Point = { x: number; y: number; hue: number };
type Stroke =
  | { kind: 'line'; rainbow: boolean; points: Point[] }
  | { kind: 'stamp'; x: number; y: number; n: number };

const INK = '#ff3b30';
const LINE_WIDTH = 6; // px at the sheet's current size … scaled by REF_WIDTH
const REF_WIDTH = 880; // sheet width the sizes above are designed for
const STAMP_RADIUS = 22;
const RAINBOW_DEG_PER_PX = 0.35;
/** Input smoothing: each new point moves this far towards the raw pointer (0..1, lower = smoother). */
const SMOOTHING = 0.4;

export function initSheets() {
  for (const sheet of document.querySelectorAll<HTMLElement>('[data-sheet]')) {
    const feature = sheet.dataset.sheet as Feature;
    if (feature === 'zoom') setUpLoupe(sheet);
    else setUpSheet(sheet, feature);
  }
}

function setUpSheet(sheet: HTMLElement, feature: Feature) {
  const canvas = sheet.querySelector<HTMLCanvasElement>('.sheet__ink')!;
  const ctx = canvas.getContext('2d')!;
  const strokes: Stroke[] = [];
  let current: Extract<Stroke, { kind: 'line' }> | null = null;
  let hue = 0;
  let stampCount = 0;

  // Size the backing store to the element (untransformed size × DPR).
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.offsetWidth * dpr);
    canvas.height = Math.round(canvas.offsetHeight * dpr);
    redraw();
  };
  new ResizeObserver(resize).observe(canvas);
  // the stamp font is only used on the canvas, so load it explicitly
  if (feature === 'stamp') document.fonts.load('600 24px "Playpen Sans Variable"').then(redraw, () => {});

  /** Sheet width in CSS px, and the scale factor for line/stamp sizes */
  const width = () => canvas.offsetWidth || 1;
  const unit = () => width() / REF_WIDTH;

  /** offsetX/Y are in the canvas' own (untransformed) coordinates. */
  const toSheet = (event: PointerEvent): Point => ({
    x: event.offsetX / width(),
    y: event.offsetY / width(),
    hue,
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const p = toSheet(event);

    if (feature === 'stamp') {
      strokes.push({ kind: 'stamp', x: p.x, y: p.y, n: ++stampCount });
      redraw();
      return;
    }

    canvas.setPointerCapture(event.pointerId);
    current = { kind: 'line', rainbow: feature === 'rainbow', points: [p] };
    strokes.push(current);
  });

  /** Adds one input sample to the current line, eased towards the raw pointer. */
  const addSample = (raw: Point) => {
    if (!current) return;
    const last = current.points[current.points.length - 1];
    // ease each point towards the pointer, which irons out jitter and corners
    const p = { x: last.x + (raw.x - last.x) * SMOOTHING, y: last.y + (raw.y - last.y) * SMOOTHING, hue };
    const dist = Math.hypot(p.x - last.x, p.y - last.y) * width();
    if (dist < 0.5) return;
    if (current.rainbow) hue += dist * RAINBOW_DEG_PER_PX;
    p.hue = hue;
    current.points.push(p);
  };

  let lastRaw: Point | null = null;

  canvas.addEventListener('pointermove', (event) => {
    if (!current) return;
    // use every sample the browser collected since the last frame, not just the latest
    const samples = event.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [event]) {
      lastRaw = toSheet(sample);
      addSample(lastRaw);
    }
    redraw();
  });

  const end = () => {
    // let the smoothed line catch up with where the pointer was released
    if (current && lastRaw) for (let i = 0; i < 8; i++) addSample(lastRaw);
    if (current && current.points.length < 2) strokes.pop();
    current = null;
    lastRaw = null;
    redraw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function redraw() {
    const dpr = canvas.width / width();
    const w = width();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.kind === 'stamp') drawStamp(stroke, w);
      else drawLine(stroke, w);
    }
  }

  function drawLine(stroke: Extract<Stroke, { kind: 'line' }>, w: number) {
    const pts = stroke.points;
    ctx.lineWidth = LINE_WIDTH * unit();

    if (stroke.rainbow) {
      // every segment blends from the previous colour to the next one,
      // so the hue changes continuously instead of in visible steps
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const gradient = ctx.createLinearGradient(a.x * w, a.y * w, b.x * w, b.y * w);
        gradient.addColorStop(0, hueColor(a.hue));
        gradient.addColorStop(1, hueColor(b.hue));
        ctx.strokeStyle = gradient;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * w);
        ctx.lineTo(b.x * w, b.y * w);
        ctx.stroke();
        // round joint without colour seams
        ctx.fillStyle = hueColor(b.hue);
        ctx.beginPath();
        ctx.arc(b.x * w, b.y * w, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineCap = 'round';
    } else {
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * w);
      // smooth with quadratic curves through the midpoints
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = ((pts[i].x + pts[i + 1].x) / 2) * w;
        const my = ((pts[i].y + pts[i + 1].y) / 2) * w;
        ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * w, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * w, last.y * w);
      ctx.stroke();
    }

  }

  function drawStamp(stamp: Extract<Stroke, { kind: 'stamp' }>, w: number) {
    // scales with the sheet, but stays big enough to read on small screens
    const r = Math.max(STAMP_RADIUS * unit(), 16);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(stamp.x * w, stamp.y * w, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(r * 1.15)}px "Playpen Sans Variable", sans-serif`;
    // Centre the digits on their measured glyph box, not on a text baseline:
    // browsers place "middle" differently (Safari sat the digits ~2px low).
    const text = String(stamp.n);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(text);
    const cx = stamp.x * w;
    const cy = stamp.y * w;
    // optical tweak: the "1" a little further left (1px at the full 22px size)
    const nudgeX = stamp.n === 1 ? -r / STAMP_RADIUS : 0;
    const x = cx - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 + nudgeX;
    const y = cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(text, x, y);
  }
}

/** Rainbow colour for a hue; hue may exceed 360 (it keeps counting along the line). */
function hueColor(hue: number) {
  return `hsl(${hue % 360} 95% 55%)`;
}

/**
 * Zoom sheet: while the pointer is over the sheet, the hand is hidden
 * (html[data-hand-loupe]) and a round loupe shows the sheet 3× magnified.
 */
function setUpLoupe(sheet: HTMLElement) {
  const loupe = sheet.querySelector<HTMLElement>('.loupe')!;
  const root = document.documentElement;
  const zoom = () => parseFloat(getComputedStyle(loupe).getPropertyValue('--zoom')) || 3;

  const show = (event: PointerEvent) => {
    const rect = sheet.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const r = loupe.offsetWidth / 2;
    const z = zoom();
    loupe.style.translate = `${x - r}px ${y - r}px`;
    loupe.dataset.on = '';
    root.setAttribute('data-hand-loupe', '');
  };
  const hide = () => {
    ants.focus = null;
    delete loupe.dataset.on;
    root.removeAttribute('data-hand-loupe');
  };

  const ants = setUpAnts(sheet, loupe, zoom);
  const showAndTrack = (event: PointerEvent) => {
    show(event);
    const rect = sheet.getBoundingClientRect();
    ants.focus = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  sheet.addEventListener('pointermove', showAndTrack);
  sheet.addEventListener('pointerdown', showAndTrack);
  sheet.addEventListener('pointerleave', hide);
  sheet.addEventListener('pointercancel', hide);
}

// --- Ants: tiny ants wandering slowly over the zoom sheet ------------------

type Accessory = 'none' | 'leaf' | 'eyes' | 'crumb' | 'hat' | 'stripes';
type Ant = {
  x: number;
  y: number;
  heading: number;
  speed: number;
  turn: number;
  phase: number;
  /** body length factor */
  size: number;
  /** abdomen width factor: skinny … chubby */
  fat: number;
  /** leg length factor */
  legs: number;
  /** antenna curl */
  curl: number;
  /** pairs of legs: 2 to 8 legs */
  legPairs: number;
  shape: Shape;
  accessory: Accessory;
};
type Shape = 'classic' | 'round' | 'square' | 'long' | 'triangle';
const SHAPES: Shape[] = ['classic', 'round', 'square', 'long', 'triangle', 'round', 'classic', 'square', 'long'];
const LEG_PAIRS = [3, 1, 4, 2, 3, 4, 1, 3, 2];

// every ant looks a bit different; some carry something or wear something
const ACCESSORIES: Accessory[] = ['leaf', 'eyes', 'none', 'crumb', 'hat', 'none', 'stripes', 'eyes', 'stripes'];

/**
 * The "moving photo": a cross-section of soil in the wireframe style of the
 * other sheets – wavy layers with small stones and pebbles. Coordinates on a
 * 1000 × 707 sheet; drawn on the sheet and, magnified, inside the loupe.
 */
const LANDSCAPE_W = 1000;
const SURFACE_Y = 0.04; // fraction of the height the ants keep from the top
const STONE = 'rgba(0,0,0,0.06)';

type Pt = [number, number];

// smooth line through the points (Catmull-Rom as Bézier curves)
const smooth = (pts: Pt[]) => {
  const p = new Path2D();
  p.moveTo(...pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    p.bezierCurveTo(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2);
  }
  return p;
};

// [x, y, r, alpha]: every stone and grain a little lighter or darker
type Dot = [number, number, number, number];
let soil: { layers: [Path2D, number][]; pebbles: Dot[]; grains: Dot[] } | null = null;
const buildSoil = () => {
  // completely random: a new picture on every visit
  const rnd = Math.random;
  const alpha = () => 0.1 + rnd() * 0.5; // 10–60 %
  // wavy layers across the sheet
  const layers = [120, 240, 360, 480, 600].map((y0, i) => {
    const pts: Pt[] = [];
    for (let x = -20; x <= 1020; x += 80) {
      pts.push([x, y0 + Math.sin(x / 140 + i * 1.7) * 14 + (rnd() - 0.5) * 12]);
    }
    return [smooth(pts), alpha()] as [Path2D, number];
  });
  // small stones (outlined circles) and grains (dots)
  const pebbles: Dot[] = [];
  const grains: Dot[] = [];
  while (pebbles.length < 34) {
    const r = 3 + rnd() * 20;
    const x = 20 + rnd() * 960;
    const y = 20 + rnd() * 667;
    if (pebbles.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + r + 10)) pebbles.push([x, y, r, alpha()]);
  }
  while (grains.length < 110) {
    const x = rnd() * 1000;
    const y = rnd() * 707;
    if (pebbles.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + 4)) grains.push([x, y, 1 + rnd() * 1.8, alpha()]);
  }
  return { layers, pebbles, grains };
};

const drawLandscape = (ctx: CanvasRenderingContext2D, w: number) => {
  soil ??= buildSoil();
  const s = w / LANDSCAPE_W;
  const hair = 2 / s; // 2 CSS px on the sheet (like the other wireframes), magnified in the loupe
  ctx.save();
  ctx.scale(s, s);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = hair;
  ctx.lineCap = 'round';
  for (const [p, a] of soil.layers) {
    ctx.globalAlpha = a;
    ctx.stroke(p);
  }
  for (const [x, y, r, a] of soil.pebbles) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; // covers the layer lines behind the stone
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.fillStyle = STONE;
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#000';
  for (const [x, y, r, a] of soil.grains) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const ANT_COUNT = 9;
const ANT_LENGTH = 7; // px at 1×

/**
 * Small ants walking at random over the sheet. Drawn twice: tiny on the sheet,
 * and sharp at the loupe's magnification inside the loupe.
 */
function setUpAnts(sheet: HTMLElement, loupe: HTMLElement, zoom: () => number) {
  const sheetCanvas = sheet.querySelector<HTMLCanvasElement>('.sheet__ants')!;
  const loupeCanvas = loupe.querySelector<HTMLCanvasElement>('.loupe__ants')!;
  const sheetCtx = sheetCanvas.getContext('2d')!;
  const loupeCtx = loupeCanvas.getContext('2d')!;
  const state = { focus: null as { x: number; y: number } | null };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let w = 0;
  let h = 0;
  const resize = () => {
    w = sheet.offsetWidth;
    h = sheet.offsetHeight;
    sheetCanvas.width = Math.round(w * dpr);
    sheetCanvas.height = Math.round(h * dpr);
    loupeCanvas.width = Math.round(loupeCanvas.offsetWidth * dpr);
    loupeCanvas.height = Math.round(loupeCanvas.offsetHeight * dpr);
  };
  new ResizeObserver(resize).observe(sheet);
  resize();

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const ants: Ant[] = Array.from({ length: ANT_COUNT }, (_, i) => ({
    x: rand(0.1, 0.9) * (w || 800),
    y: rand(0.25, 0.9) * (h || 560), // underground
    heading: rand(0, Math.PI * 2),
    speed: rand(6, 14), // px per second: slow
    turn: 0,
    phase: rand(0, Math.PI * 2),
    size: rand(0.7, 1.8),
    fat: rand(0.75, 1.5),
    legs: rand(0.8, 1.35),
    curl: rand(-0.25, 0.45),
    legPairs: LEG_PAIRS[i % LEG_PAIRS.length],
    shape: SHAPES[i % SHAPES.length],
    accessory: ACCESSORIES[i % ACCESSORIES.length],
  }));

  const step = (ant: Ant, dt: number) => {
    // wander: the turn rate drifts randomly, and ants steer away from the edges
    ant.turn += rand(-1, 1) * 2 * dt;
    ant.turn *= 0.97;
    const margin = 24;
    const ground = h * SURFACE_Y + 20; // below the surface
    if (ant.x < margin || ant.x > w - margin || ant.y < ground || ant.y > h - margin) {
      const toCentre = Math.atan2((ground + h) / 2 - ant.y, w / 2 - ant.x);
      let diff = toCentre - ant.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      ant.turn += diff * 1.5 * dt;
    }
    ant.heading += ant.turn * dt * 3;
    ant.x += Math.cos(ant.heading) * ant.speed * dt;
    ant.y += Math.sin(ant.heading) * ant.speed * dt;
    ant.phase += ant.speed * dt * 0.9;
  };

  // The body outline per shape, in the ant's frame (x points forward)
  const bodyPath = (ctx: CanvasRenderingContext2D, ant: Ant, l: number) => {
    const f = ant.fat;
    ctx.beginPath();
    switch (ant.shape) {
      case 'round':
        ctx.arc(-l * 0.08, 0, l * 0.24 * Math.sqrt(f), 0, Math.PI * 2);
        ctx.moveTo(l * 0.38, 0);
        ctx.arc(l * 0.28, 0, l * 0.1, 0, Math.PI * 2);
        break;
      case 'square': {
        const hw = l * 0.18 * f;
        ctx.roundRect(-l * 0.45, -hw, l * 0.6, hw * 2, l * 0.04);
        ctx.roundRect(l * 0.2, -l * 0.09, l * 0.18, l * 0.18, l * 0.02);
        break;
      }
      case 'long':
        ctx.ellipse(-l * 0.38, 0, l * 0.3, l * 0.08 * f, 0, 0, Math.PI * 2);
        ctx.moveTo(l * 0.1, 0);
        ctx.ellipse(0, 0, l * 0.1, l * 0.05, 0, 0, Math.PI * 2);
        ctx.moveTo(l * 0.38, 0);
        ctx.ellipse(l * 0.3, 0, l * 0.08, l * 0.07, 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(l * 0.42, 0);
        ctx.lineTo(-l * 0.4, -l * 0.24 * f);
        ctx.lineTo(-l * 0.4, l * 0.24 * f);
        ctx.closePath();
        break;
      default:
        ctx.ellipse(-l * 0.32, 0, l * 0.2 * Math.min(f, 1.2), l * 0.14 * f, 0, 0, Math.PI * 2);
        ctx.moveTo(l * 0.14, 0);
        ctx.ellipse(0, 0, l * 0.14, l * 0.07, 0, 0, Math.PI * 2);
        ctx.moveTo(l * 0.4, 0);
        ctx.ellipse(l * 0.3, 0, l * 0.1, l * 0.09, 0, 0, Math.PI * 2);
    }
  };

  // Every ant is symmetric: legs, antennae and extras mirror left and right.
  const drawAnt = (ctx: CanvasRenderingContext2D, ant: Ant) => {
    const l = ANT_LENGTH * ant.size;
    ctx.save();
    ctx.translate(ant.x, ant.y);
    ctx.rotate(ant.heading);
    ctx.fillStyle = '#1a1410';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = l * 0.06;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // legs: 1 to 4 pairs, both sides of a pair swing together
    const n = ant.legPairs;
    for (let i = 0; i < n; i++) {
      const base = n === 1 ? -l * 0.05 : -l * 0.22 + (i * l * 0.32) / (n - 1);
      const swing = Math.sin(ant.phase + i * 1.3) * l * 0.1;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(base, 0);
        ctx.lineTo(base + l * 0.06 + swing, side * l * 0.22 * ant.legs);
        ctx.lineTo(base + swing * 1.4, side * l * 0.38 * ant.legs);
        ctx.stroke();
      }
    }
    // antennae
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(l * 0.38, 0);
      ctx.quadraticCurveTo(
        l * 0.56,
        side * l * (0.12 + ant.curl * 0.1),
        l * (0.66 - ant.curl * 0.08),
        side * l * (0.22 + ant.curl * 0.12),
      );
      ctx.stroke();
    }
    bodyPath(ctx, ant, l);
    ctx.fill();
    drawAccessory(ctx, ant, l);
    ctx.restore();
  };

  // small symmetric extras; they only really show inside the loupe
  const drawAccessory = (ctx: CanvasRenderingContext2D, ant: Ant, l: number) => {
    ctx.lineWidth = l * 0.04;
    const outlined = (draw: () => void) => {
      ctx.beginPath();
      draw();
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.stroke();
    };
    switch (ant.accessory) {
      case 'leaf':
        // a leafcutter ant: a leaf held up over its back
        outlined(() => {
          ctx.moveTo(-l * 0.5, 0);
          ctx.quadraticCurveTo(0, -l * 0.42, l * 0.5, 0);
          ctx.quadraticCurveTo(0, l * 0.42, -l * 0.5, 0);
        });
        ctx.beginPath();
        ctx.moveTo(-l * 0.45, 0);
        ctx.lineTo(l * 0.45, 0);
        ctx.stroke();
        break;
      case 'crumb':
        outlined(() => ctx.arc(l * 0.6, 0, l * 0.16, 0, Math.PI * 2));
        break;
      case 'eyes':
        for (const side of [-1, 1]) {
          outlined(() => ctx.arc(l * 0.32, side * l * 0.07, l * 0.065, 0, Math.PI * 2));
          ctx.beginPath();
          ctx.arc(l * 0.35, side * l * 0.07, l * 0.03, 0, Math.PI * 2);
          ctx.fillStyle = '#1a1410';
          ctx.fill();
        }
        break;
      case 'hat':
        outlined(() => {
          ctx.moveTo(l * 0.22, -l * 0.1);
          ctx.lineTo(l * 0.6, 0);
          ctx.lineTo(l * 0.22, l * 0.1);
          ctx.closePath();
        });
        outlined(() => ctx.arc(l * 0.62, 0, l * 0.045, 0, Math.PI * 2));
        break;
      case 'stripes':
        // white body with black stripes across
        ctx.save();
        bodyPath(ctx, ant, l);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.stroke();
        ctx.clip();
        ctx.fillStyle = '#1a1410';
        for (let x = -l * 0.6; x < l * 0.5; x += l * 0.12) ctx.fillRect(x, -l, l * 0.05, l * 2);
        ctx.restore();
        break;
    }
  };

  const render = () => {
    sheetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sheetCtx.clearRect(0, 0, w, h);
    drawLandscape(sheetCtx, w);
    for (const ant of ants) drawAnt(sheetCtx, ant);

    if (state.focus) {
      // the lens is centred in the loupe, so its centre is the focus point
      const lens = loupeCanvas.offsetWidth;
      const r = lens / 2;
      const z = zoom();
      if (loupeCanvas.width !== Math.round(lens * dpr)) resize();
      loupeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      loupeCtx.clearRect(0, 0, lens, lens);
      loupeCtx.translate(r - state.focus.x * z, r - state.focus.y * z);
      loupeCtx.scale(z, z);
      drawLandscape(loupeCtx, w);
      for (const ant of ants) drawAnt(loupeCtx, ant);
    }
  };

  // run only while the sheet is on screen
  let running = false;
  let last = 0;
  const frame = (t: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    for (const ant of ants) step(ant, dt);
    render();
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting;
    if (visible && !running) {
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    } else if (!visible) {
      running = false;
    }
  }).observe(sheet);

  return state;
}
