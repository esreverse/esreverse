/**
 * Try-it-yourself ink for the TinyPointer sheets.
 *
 * Each `[data-sheet]` gets one behaviour, mirroring the app:
 *   draw     – drag to draw a line
 *   rainbow  – drag to draw a line that runs through every colour
 *   stamp    – click to put down numbered circles 1, 2, 3 …
 *   arrow    – drag to draw a line that ends in an open arrowhead
 *
 * Strokes are stored in sheet-relative units (fractions of the sheet width),
 * so they survive resizes. The sheet itself clips the canvas.
 */

type Feature = 'draw' | 'rainbow' | 'stamp' | 'arrow';
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

export function initSheets() {
  for (const sheet of document.querySelectorAll<HTMLElement>('[data-sheet]')) {
    setUpSheet(sheet, sheet.dataset.sheet as Feature);
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

  canvas.addEventListener('pointermove', (event) => {
    if (!current) return;
    const last = current.points[current.points.length - 1];
    const p = toSheet(event);
    const dist = Math.hypot(p.x - last.x, p.y - last.y) * width();
    if (dist < 1.5) return;
    if (current.rainbow) hue += dist * RAINBOW_DEG_PER_PX;
    p.hue = hue;
    current.points.push(p);
    redraw();
  });

  const end = () => {
    if (current && current.points.length < 2) strokes.pop();
    current = null;
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
    const r = STAMP_RADIUS * unit();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(stamp.x * w, stamp.y * w, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(r * 1.15)}px "Playpen Sans Variable", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(stamp.n), stamp.x * w, stamp.y * w + r * 0.06);
  }
}

/** Rainbow colour for a hue; hue may exceed 360 (it keeps counting along the line). */
function hueColor(hue: number) {
  return `hsl(${hue % 360} 95% 55%)`;
}
