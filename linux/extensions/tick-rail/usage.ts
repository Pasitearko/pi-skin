import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { pillCells } from "./geometry.ts";
import { bg, fg, palette } from "./colors.ts";

// Same contract as pi-personalization's subscription-usage-row: working-timer docks
// `render()` into its row, and the subscription-usage patch hands its footer text
// to `setFallback()`. Queries and auth stay entirely in pi-subscription-usage.
const ROW_KEY = Symbol.for("pi.extensions.quota-row.v1");
const STATUS_EVENT = "subscription-usage/status/v1";
const WIDGET_KEY = "tick-rail-usage";
const BAR = 12;

type Window = { kind?: string; label: string; remainingPercent: number; resetCountdown?: string; windowMinutes?: number };
type Status = { v: 1; status: "ready"; windows: Window[] } | { v: 1; status: "unavailable" };

function readStatus(value: unknown): Status | undefined {
  const raw = value as Record<string, unknown> | undefined;
  if (!raw || raw.v !== 1) return undefined;
  if (raw.status === "unavailable") return { v: 1, status: "unavailable" };
  if (raw.status !== "ready" || !Array.isArray(raw.windows)) return undefined;
  const windows: Window[] = [];
  for (const w of raw.windows as Record<string, unknown>[]) {
    if (!w || typeof w.label !== "string" || typeof w.remainingPercent !== "number") continue;
    if (!Number.isFinite(w.remainingPercent)) continue;
    windows.push({
      label: w.label, remainingPercent: Math.max(0, Math.min(100, w.remainingPercent)),
      ...(typeof w.kind === "string" ? { kind: w.kind } : {}),
      ...(typeof w.windowMinutes === "number" ? { windowMinutes: w.windowMinutes } : {}),
      ...(typeof w.resetCountdown === "string" ? { resetCountdown: w.resetCountdown } : {}),
    });
  }
  return { v: 1, status: "ready", windows };
}

const clean = (s: string) => s.replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();

function windowName(w: Window): { icon: string; name: string } {
  if (w.kind === "weekly") return { icon: "", name: "本周" };
  if (w.kind === "monthly") return { icon: "", name: "本月" };
  const hours = w.label.match(/^(\d+)h$/);
  if (hours) return { icon: "", name: `${hours[1]}小时` };
  return { icon: "", name: clean(w.label) };
}

/** Rounded pill: gradient fill, percentage inside, reset countdown after. */
export function renderUsage(event: Status | undefined, theme: Theme, fallback?: string): string | undefined {
  if (event?.status !== "ready") return fallback ? theme.fg("dim", fallback) : undefined;
  if (!event.windows.length) return undefined;
  const p = palette(theme);
  return event.windows.map(w => {
    const percent = Math.round(w.remainingPercent);
    const { icon, name } = windowName(w);
    const countdown = w.resetCountdown ? clean(w.resetCountdown).replace(/(\d+[dhm])(?=\d)/g, "$1 ") : "";
    const tail = countdown ? theme.fg("dim", `  ↻ ${countdown}`) : "";
    if (!p) {
      // No truecolor palette: a plain bar in theme colours.
      const filled = Math.round(percent / 100 * BAR);
      return theme.fg("muted", `${name} `) + theme.fg("accent", "━".repeat(filled)) +
        theme.fg("borderMuted", "─".repeat(BAR - filled)) + theme.fg("text", ` ${percent}%`) + tail;
    }
    const tone = percent < 20 ? p.error : percent < 50 ? p.warning : p.accent;
    const cells = pillCells(percent, BAR, tone, p.track);
    const label = `${percent}%`, at = Math.floor((BAR - label.length) / 2);
    let bar = fg(cells[0].bg) + "";
    cells.forEach((c, k) => {
      const ch = k >= at && k < at + label.length ? label[k - at] : " ";
      bar += bg(c.bg) + fg(c.filled ? p.ink : p.muted) + "\x1b[1m" + ch + "\x1b[22m";
    });
    bar += "\x1b[49m" + fg(cells[BAR - 1].bg) + "\x1b[39m";
    return fg(tone) + icon + " \x1b[39m" + theme.fg("muted", name) + "  " + bar + tail;
  }).join("    ");
}

export function installUsageRow(pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined;
  let event: Status | undefined;
  let fallback: string | undefined;
  let requestRender: (() => void) | undefined;
  let widgetInstalled = false;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const claims = new Set<symbol>();
  const global = globalThis as Record<symbol, unknown>;
  const active = () => Boolean(ctx?.hasUI && ctx.mode === "tui");

  const syncWidget = () => {
    if (!active() || !ctx) return;
    // working-timer claims the row and draws us inside its own line instead.
    const show = claims.size === 0 && Boolean(event?.status === "ready" || fallback);
    if (show && !widgetInstalled) {
      widgetInstalled = true;
      ctx.ui.setWidget(WIDGET_KEY, (tui, theme) => {
        requestRender = () => tui.requestRender();
        return {
          render: (width: number) => {
            const text = renderUsage(event, theme, fallback);
            return text && width > 0 ? [truncateToWidth(text, width)] : [];
          },
          invalidate() {},
          dispose() { requestRender = undefined; },
        };
      }, { placement: "belowEditor" });
    } else if (!show && widgetInstalled) {
      widgetInstalled = false;
      ctx.ui.setWidget(WIDGET_KEY, undefined);
    }
    requestRender?.();
  };
  const changed = () => { syncWidget(); for (const listener of listeners) listener(); };

  const host = {
    source: "subscription-usage",
    render(theme: Theme) { return active() ? renderUsage(event, theme, fallback) : undefined; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    claim() {
      const token = Symbol(); claims.add(token); changed();
      return () => { if (claims.delete(token)) changed(); };
    },
    setFallback(value: string | undefined): boolean {
      if (!active()) return false;
      fallback = event?.status === "ready" ? undefined
        : value === "usage auth ?" ? "额度不可用 · 在 pi 里运行 /login openai-codex"
        : value === "usage error" ? "额度查询失败 · /usage 查看详情" : undefined;
      changed();
      return true;
    },
  };
  global[ROW_KEY] = host; // published at load, before working-timer's session_start

  const listen = () => {
    unsubscribe ??= pi.events.on(STATUS_EVENT, (data: unknown) => {
      const next = readStatus(data);
      if (!next) return;
      event = next; fallback = undefined; changed();
    });
  };
  listen();
  const attach = (next: ExtensionContext) => {
    ctx = next;
    if (!active()) return;
    global[ROW_KEY] = host;
    listen();
    ctx.ui.setStatus("subscription-usage", undefined);
    syncWidget();
  };
  pi.on("session_start", (_e, next) => { if (ctx) { event = undefined; fallback = undefined; } attach(next); });
  pi.on("session_tree", (_e, next) => attach(next));
  pi.on("model_select", () => { event = undefined; fallback = undefined; changed(); });
  pi.on("session_shutdown", () => {
    unsubscribe?.(); unsubscribe = undefined;
    if (active() && ctx) ctx.ui.setWidget(WIDGET_KEY, undefined);
    widgetInstalled = false; requestRender = undefined;
    event = undefined; fallback = undefined; ctx = undefined;
    if (global[ROW_KEY] === host) delete global[ROW_KEY];
    listeners.clear();
  });
}
