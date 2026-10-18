// Pure tick-rail geometry, shared by the pi extension and the terminal demo.
//
// The rail is a vertical column of thin ticks fixed at the middle of the right
// edge, one prompt per row. Ticks are right-aligned and grow left; a tick's length
// and clarity depend only on its distance from the previewed prompt. `rot` is the
// fractional prompt ordinal at the middle row; the wheel scrolls it, so any
// number of prompts fit. Ticks are one-eighth-cell bars that kitty draws itself,
// placed at eight vertical positions per row, so scrolling moves them smoothly.

export const MIN_PROMPTS = 3;
export const TICK_MIN = 1;          // cells
export const TICK_MAX = 6;
export const LENGTH_RADIUS = 4.5;   // ticks over which length falls to TICK_MIN
export const CLARITY_RADIUS = 9;    // ticks over which clarity falls to its floor
export const HOT_ZONE = 2;          // rightmost columns that reveal the rail
export const RAIL_COLS = TICK_MAX + 1;

export interface Rail {
  rows: number;   // height in cells
  mid: number;    // the middle row; `rot` sits here (rows above: mid, below: rows - 1 - mid)
}

/** Rail sized to the chat viewport, at most `maxRows` ticks tall; the wheel reaches the rest. */
export function makeRail(viewRows: number, maxRows = 10): Rail {
  const rows = Math.max(3, Math.min(maxRows, viewRows - 4));
  return { rows, mid: Math.floor(rows / 2) };
}

/** Keep the rail full: with fewer prompts than rows, centre them and do not scroll. */
export function clampRot(r: Rail, count: number, rot: number): number {
  if (count <= r.rows) return Math.floor((count - 1) / 2);   // whole rows keep bars centred in their cells
  return Math.max(r.mid, Math.min(count - 1 - (r.rows - 1 - r.mid), rot));
}

export interface TickShape { ordinal: number; offset: number; length: number; clarity: number; peak: boolean }

/** Ticks on the rail. `peak` = previewed ordinal (null: rail at rest). */
export function visibleTicks(r: Rail, count: number, rot: number, peak: number | null): TickShape[] {
  const ticks: TickShape[] = [];
  const below = r.rows - 1 - r.mid;
  for (let i = Math.max(0, Math.ceil(rot - r.mid - 0.5)); i <= Math.min(count - 1, Math.floor(rot + below + 0.5)); i++) {
    const distance = peak === null ? Infinity : Math.abs(i - peak);
    const grow = Math.max(0, 1 - distance / LENGTH_RADIUS) ** 1.2;
    const clear = Math.max(0, 1 - distance / CLARITY_RADIUS) ** 1.3;
    ticks.push({
      ordinal: i, offset: i - rot, peak: distance < 0.5,
      length: Math.round(TICK_MIN + (TICK_MAX - TICK_MIN) * grow),
      clarity: 0.3 + 0.7 * clear,
    });
  }
  return ticks;
}

/** One-eighth-cell horizontal bars, top (0) to bottom (7). */
const BARS = ["▔", "\u{1fb76}", "\u{1fb77}", "\u{1fb78}", "\u{1fb79}", "\u{1fb7a}", "\u{1fb7b}", "▁"];

/** Where a tick lands: its row and bar glyph; cells span [RAIL_COLS - length, RAIL_COLS). */
export function placeTick(r: Rail, t: TickShape): { row: number; glyph: string } | undefined {
  const eighths = Math.round((r.mid + t.offset) * 8) + 4;
  const row = Math.floor(eighths / 8);
  if (row < 0 || row >= r.rows) return undefined;
  return { row, glyph: BARS[eighths % 8] };
}

/** Prompt under a rail row (pointer hover), or undefined past either end. */
export function tickAt(r: Rail, count: number, rot: number, row: number): number | undefined {
  if (row < 0 || row >= r.rows) return undefined;
  const i = Math.round(rot + row - r.mid);
  return i >= 0 && i < count ? i : undefined;
}

/** Ordinal of the prompt the reader is in: last prompt starting above the upper third. */
export function activePrompt(lines: number[], scrollTop: number, viewport: number): number {
  const anchor = scrollTop + Math.floor(viewport / 3);
  let active = 0;
  for (let i = 0; i < lines.length; i++) if (lines[i] <= anchor) active = i;
  return active;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

// ---------- colours ----------

export interface Rgb { r: number; g: number; b: number }
export const hex = (h: string): Rgb => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
export const toHex = ({ r, g, b }: Rgb) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
export const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
};

/** Per-cell background colours of a pill bar: a gradient fill, then the track. */
export function pillCells(percent: number, width: number, tone: string, track: string): { bg: string; filled: boolean }[] {
  const filled = Math.max(0, Math.min(width, Math.round(percent / 100 * width)));
  return Array.from({ length: width }, (_, i) => i < filled
    ? { bg: mix(mix(tone, track, 0.55), tone, filled === 1 ? 1 : i / (filled - 1)), filled: true }
    : { bg: track, filled: false });
}
