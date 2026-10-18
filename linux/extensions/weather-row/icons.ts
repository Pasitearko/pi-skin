import type { Theme } from "@earendil-works/pi-coding-agent";
import { rgbColor } from "@earendil-works/pi-tui";

// Maple Mono NF CN already contains these single-column glyphs. No terminal
// font, global palette, or emoji rendering outside this widget is changed.
export const ICONS = {
  location: "", loading: "", warning: "",
  sun: "", moon: "", partlyCloudy: "󰖕", cloud: "", fog: "󰖑",
  showers: "󰼳", rain: "󰖗", snow: "󰖘", thunder: "󰖓",
  temperature: "", humidity: "", wind: "󰖝", time: "",
} as const;

const palette = {
  teal: [rgbColor(125, 211, 207), rgbColor(26, 125, 130)],
  gold: [rgbColor(224, 175, 104), rgbColor(145, 99, 20)],
  cloud: [rgbColor(155, 183, 205), rgbColor(71, 110, 140)],
  orange: [rgbColor(251, 163, 90), rgbColor(173, 85, 25)],
  blue: [rgbColor(93, 184, 235), rgbColor(25, 115, 167)],
  green: [rgbColor(144, 205, 133), rgbColor(57, 125, 52)],
  purple: [rgbColor(185, 156, 235), rgbColor(119, 83, 172)],
} as const;
const categories: Record<keyof typeof ICONS, keyof typeof palette> = {
  location: "teal", loading: "gold", warning: "gold",
  sun: "gold", moon: "purple", partlyCloudy: "cloud", cloud: "cloud", fog: "cloud",
  showers: "blue", rain: "blue", snow: "teal", thunder: "orange",
  temperature: "orange", humidity: "blue", wind: "green", time: "purple",
};
const colors = new Map(Object.entries(ICONS).map(([name, glyph]) =>
  [glyph as string, palette[categories[name as keyof typeof ICONS]]] as const));

/** Style the icon alone; adjacent text retains its existing semantic color. */
export function paintIcon(theme: Theme, glyph: string): string {
  const pair = colors.get(glyph);
  return pair ? theme.style(glyph, { fg: pair[theme.appearance === "light" ? 1 : 0] }) : glyph;
}
