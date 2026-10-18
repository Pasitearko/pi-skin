import { mix } from "./geometry.ts";

type ThemeLike = { getFgAnsi(color: string): string; getBgAnsi(color: string): string };

/** Hex of a truecolor SGR sequence; undefined for palette/default colours. */
function hexOf(ansi: string): string | undefined {
  const m = ansi.match(/\x1b\[(?:38|48);2;(\d+);(\d+);(\d+)m/);
  return m ? "#" + m.slice(1, 4).map(v => Number(v).toString(16).padStart(2, "0")).join("") : undefined;
}

export const fg = (hex: string) =>
  `\x1b[38;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(hex.slice(3, 5), 16)};${parseInt(hex.slice(5, 7), 16)}m`;
export const bg = (hex: string) =>
  `\x1b[48;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(hex.slice(3, 5), 16)};${parseInt(hex.slice(5, 7), 16)}m`;

/** Theme colours resolved to hex; undefined when the terminal reports no truecolor palette. */
export interface Palette {
  accent: string; muted: string; dim: string; border: string;
  warning: string; error: string; track: string;
  tick: string;   // non-peak tick at full clarity
  fade: string;   // what ticks fade toward with distance
  ink: string;    // text drawn on a filled pill
}

export function palette(theme: ThemeLike): Palette | undefined {
  const pick = (token: string) => hexOf(theme.getFgAnsi(token));
  const accent = pick("accent"), muted = pick("muted"), dim = pick("dim"), border = pick("borderMuted");
  const warning = pick("warning"), error = pick("error"), track = hexOf(theme.getBgAnsi("customMessageBg"));
  if (!accent || !muted || !dim || !border || !warning || !error || !track) return undefined;
  const lum = (h: string) => (parseInt(h.slice(1, 3), 16) * 0.2126 + parseInt(h.slice(3, 5), 16) * 0.7152 + parseInt(h.slice(5, 7), 16) * 0.0722) / 255;
  const dark = lum(muted) > 0.45;   // light text means a dark background
  const far = dark ? "#000000" : "#ffffff", near = dark ? "#ffffff" : "#000000";
  return {
    accent, muted, dim, border, warning, error, track,
    tick: mix(muted, near, 0.25), fade: mix(border, far, 0.5), ink: mix(track, far, 0.6),
  };
}
