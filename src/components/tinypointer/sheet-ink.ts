/**
 * Try-it-yourself ink for the TinyPointer sheets.
 *
 * Each `[data-sheet]` gets one behaviour, mirroring the app:
 *   draw     – drag to draw a line
 *   rainbow  – drag to draw a line that runs through every colour
 *   stamp    – click to put down numbered circles 1, 2, 3 …
 *   arrow    – drag to draw a line that ends in an open arrowhead
 *   zoom     – the hand turns into a 3× loupe over the sheet
 *
 * Strokes are stored in sheet-relative units (fractions of the sheet width),
 * so they survive resizes. The sheet itself clips the canvas.
 */

type Feature = 'draw' | 'rainbow' | 'stamp' | 'arrow' | 'zoom';
type Point = { x: number; y: number; hue: number };
type Stroke =
  | { kind: 'line'; rainbow: boolean; arrow: boolean; points: Point[] }
  | { kind: 'stamp'; x: number; y: number; n: number };

const INK = '#ff3b30';
const LINE_WIDTH = 6; // px at the sheet's current size … scaled by REF_WIDTH
const REF_WIDTH = 880; // sheet width the sizes above are designed for
const STAMP_RADIUS = 22;
const HEAD_LENGTH = 24;
const HEAD_ANGLE = (28 * Math.PI) / 180;
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
    current = { kind: 'line', rainbow: feature === 'rainbow', arrow: feature === 'arrow', points: [p] };
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

    if (stroke.arrow && pts.length > 1) drawArrowhead(pts, w);
  }

  /** Open chevron at the end, pointing the way the line was last going. */
  function drawArrowhead(pts: Point[], w: number) {
    const tip = pts[pts.length - 1];
    // look back far enough for a stable direction
    let from = pts[pts.length - 2];
    for (let i = pts.length - 2; i >= 0; i--) {
      from = pts[i];
      if (Math.hypot(tip.x - from.x, tip.y - from.y) * w > HEAD_LENGTH * unit()) break;
    }
    const angle = Math.atan2((tip.y - from.y) * w, (tip.x - from.x) * w);
    const len = HEAD_LENGTH * unit();
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(tip.x * w - len * Math.cos(angle - HEAD_ANGLE), tip.y * w - len * Math.sin(angle - HEAD_ANGLE));
    ctx.lineTo(tip.x * w, tip.y * w);
    ctx.lineTo(tip.x * w - len * Math.cos(angle + HEAD_ANGLE), tip.y * w - len * Math.sin(angle + HEAD_ANGLE));
    ctx.stroke();
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // optical centring, proportional to the stamp (1px at the full 22px size):
    // digits a little lower; the "1" a little further left
    const nudge = r / STAMP_RADIUS;
    const nudgeX = stamp.n === 1 ? -nudge : 0;
    ctx.fillText(String(stamp.n), stamp.x * w + nudgeX, stamp.y * w + r * 0.06 + nudge);
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

type Ant = { x: number; y: number; heading: number; speed: number; turn: number; phase: number };

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
  const ants: Ant[] = Array.from({ length: ANT_COUNT }, () => ({
    x: rand(0.1, 0.9) * (w || 800),
    y: rand(0.1, 0.9) * (h || 560),
    heading: rand(0, Math.PI * 2),
    speed: rand(6, 14), // px per second: slow
    turn: 0,
    phase: rand(0, Math.PI * 2),
  }));

  const step = (ant: Ant, dt: number) => {
    // wander: the turn rate drifts randomly, and ants steer away from the edges
    ant.turn += rand(-1, 1) * 2 * dt;
    ant.turn *= 0.97;
    const margin = 24;
    if (ant.x < margin || ant.x > w - margin || ant.y < margin || ant.y > h - margin) {
      const toCentre = Math.atan2(h / 2 - ant.y, w / 2 - ant.x);
      let diff = toCentre - ant.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      ant.turn += diff * 1.5 * dt;
    }
    ant.heading += ant.turn * dt * 3;
    ant.x += Math.cos(ant.heading) * ant.speed * dt;
    ant.y += Math.sin(ant.heading) * ant.speed * dt;
    ant.phase += ant.speed * dt * 0.9;
  };

  const drawAnt = (ctx: CanvasRenderingContext2D, ant: Ant) => {
    const l = ANT_LENGTH;
    ctx.save();
    ctx.translate(ant.x, ant.y);
    ctx.rotate(ant.heading);
    ctx.fillStyle = '#1a1410';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = l * 0.06;
    ctx.lineCap = 'round';
    // legs: three pairs, alternating gait
    for (let i = 0; i < 3; i++) {
      const base = -l * 0.08 + i * l * 0.08;
      const swing = Math.sin(ant.phase + (i % 2 ? Math.PI : 0)) * l * 0.12;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(base, 0);
        ctx.lineTo(base + l * 0.08 + swing * side, side * l * 0.2);
        ctx.lineTo(base + l * 0.02 + swing * side * 1.4, side * l * 0.36);
        ctx.stroke();
      }
    }
    // antennae
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(l * 0.42, 0);
      ctx.quadraticCurveTo(l * 0.58, side * l * 0.12, l * 0.66, side * l * 0.22);
      ctx.stroke();
    }
    // body: abdomen, thorax, head
    const ellipse = (x: number, rx: number, ry: number) => {
      ctx.beginPath();
      ctx.ellipse(x, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    ellipse(-l * 0.32, l * 0.2, l * 0.14);
    ellipse(0, l * 0.14, l * 0.07);
    ellipse(l * 0.3, l * 0.1, l * 0.09);
    ctx.restore();
  };

  const render = () => {
    sheetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sheetCtx.clearRect(0, 0, w, h);
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
