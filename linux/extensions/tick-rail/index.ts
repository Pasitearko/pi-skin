import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import {
  HOT_ZONE, MIN_PROMPTS, RAIL_COLS, activePrompt, clampRot, easeOutCubic, makeRail, mix, placeTick, tickAt, visibleTicks,
  type Rail,
} from "./geometry.ts";
import { backgroundAt, compositeAt, findTranscript, indexPrompts, type Transcript } from "./transcript.ts";
import { fg, palette } from "./colors.ts";
import { PromptPicker, type PickerItem } from "./picker.ts";
import { installUsageRow } from "./usage.ts";

const WIDGET = "tick-rail-lifecycle";
const HIDE_DELAY = 260;        // ms after the pointer leaves
const KEY_HIDE_DELAY = 1600;   // ms after Alt+[ / Alt+]
const TURN_MS = 200, JUMP_MS = 220, FRAME_MS = 8;
const CARD_WIDTH = 40;

type Runtime = any;
interface Prompt { line: number; text: string; round?: number; time: string }
interface Geometry { tr: Transcript; rail: Rail; top: number; left: number; right: number }

export default function tickRail(pi: ExtensionAPI) {
  installUsageRow(pi);

  let ctx: ExtensionContext | undefined;
  let tui: Runtime, theme: Runtime;
  let enabled = true;
  let shown = false, rot = 0, rotTarget = 0;
  let pointerRow: number | null = null;   // screen row while the pointer is on the rail
  let keyPeak: number | null = null;      // prompt chosen with Alt+[ / Alt+]
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let rotAnim: ReturnType<typeof setInterval> | undefined;
  let jumpAnim: ReturnType<typeof setInterval> | undefined;
  let unhook: (() => void) | undefined;

  const render = () => tui?.requestRender?.();

  // ---------- data ----------

  function geometry(): Geometry | undefined {
    const tr = findTranscript(tui);
    if (!tr || tr.rect.height < 5 || tr.rect.width < 30) return;
    const rail = makeRail(tr.rect.height);
    const right = tr.rect.x + tr.rect.width - (tr.scrollbar ? 1 : 0);
    return { tr, rail, top: tr.rect.y + Math.floor((tr.rect.height - rail.rows) / 2), left: right - RAIL_COLS, right };
  }

  function textOf(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content.map(p => (p && typeof p === "object" && (p as any).type === "text" ? String((p as any).text ?? "") : "")).join("");
  }
  function clock(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return d.toDateString() === new Date().toDateString() ? hm : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
  }

  /** Rendered prompts, matched (from the newest back) to user messages in the session branch for round and time. */
  function prompts(tr: Transcript): Prompt[] {
    const marks = indexPrompts(tr.doc);
    const branch: { text: string; time: string }[] = [];
    try {
      for (const e of ctx?.sessionManager.getBranch() ?? []) {
        const m = (e as any).type === "message" ? (e as any).message : undefined;
        if (m?.role === "user") branch.push({ text: textOf(m.content), time: (e as any).timestamp });
      }
    } catch { /* metadata is optional */ }
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const out: Prompt[] = marks.map(m => ({ line: m.line, text: m.text, time: "" }));
    let j = branch.length - 1;
    for (let k = out.length - 1; k >= 0; k--) {
      const want = norm(out[k].text);
      let i = j;
      while (i >= 0 && norm(branch[i].text) !== want) i--;
      if (i < 0) continue;
      out[k].round = i + 1; out[k].time = clock(branch[i].time); j = i - 1;
    }
    return out;
  }

  // ---------- state changes ----------

  function animate(from: number, to: number, ms: number, set: (v: number) => void, slot: "rot" | "jump") {
    clearInterval(slot === "rot" ? rotAnim : jumpAnim);
    if (Math.abs(to - from) < 0.01) { set(to); render(); return; }
    const t0 = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      set(from + (to - from) * easeOutCubic(p));
      render();
      if (p >= 1) clearInterval(timer);
    }, FRAME_MS);
    if (slot === "rot") rotAnim = timer; else jumpAnim = timer;
  }
  function turnTo(g: Geometry, count: number, target: number) {
    rotTarget = clampRot(g.rail, count, target);
    animate(rot, rotTarget, TURN_MS, v => { rot = v; }, "rot");
  }
  function jumpTo(g: Geometry, line: number) {
    const scroll = g.tr.scroll;
    animate(scroll.scrollTop, Math.max(0, line), JUMP_MS, v => scroll.scrollTo(Math.round(v), { disableFollow: true }), "jump");
  }
  function reveal(g: Geometry, list: Prompt[]) {
    clearTimeout(hideTimer);
    if (shown || !enabled || list.length < MIN_PROMPTS) return;
    shown = true;
    rot = rotTarget = clampRot(g.rail, list.length, activePrompt(list.map(p => p.line), g.tr.scroll.scrollTop, g.tr.scroll.viewportHeight));
  }
  function hideSoon(ms = HIDE_DELAY) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { shown = false; pointerRow = null; keyPeak = null; render(); }, ms);
  }

  // ---------- drawing (after Pi composes each frame) ----------

  function paint(screen: string[]): string[] {
    if (!shown || !enabled || !theme || tui?.hasOverlayEntries) return screen;
    const g = geometry();
    if (!g) return screen;
    const list = prompts(g.tr);
    if (list.length < MIN_PROMPTS) return screen;
    const p = palette(theme);
    const peak = pointerRow !== null ? tickAt(g.rail, list.length, rot, pointerRow - g.top) ?? null : keyPeak;
    const active = activePrompt(list.map(x => x.line), g.tr.scroll.scrollTop, g.tr.scroll.viewportHeight);
    const out = screen.slice();
    let peakRow = -1, tipCol = g.left;
    // Faint ticks first so clearer ones win a shared row mid-scroll.
    for (const t of visibleTicks(g.rail, list.length, rot, peak).sort((a, b) => a.clarity - b.clarity)) {
      const cell = placeTick(g.rail, t);
      if (!cell) continue;
      const y = g.top + cell.row, x0 = g.right - t.length;
      if (y < 0 || y >= out.length) continue;
      if (t.peak) { peakRow = y; tipCol = x0; }
      const color = p
        ? fg(t.peak ? p.accent : mix(p.fade, t.ordinal === active ? p.accent : p.tick, t.clarity))
        : theme.getFgAnsi(t.peak || t.ordinal === active ? "accent" : t.clarity > 0.75 ? "muted" : t.clarity > 0.5 ? "dim" : "borderMuted");
      // Float over the chat: only the tick's own cells change, each keeping its background.
      for (let x = x0; x < g.right; x++) {
        out[y] = compositeAt(out[y], x, 1, backgroundAt(out[y], x) + color + (t.peak ? "\x1b[1m" : "") + cell.glyph);
      }
    }
    if (peak !== null && peakRow >= 0) paintCard(out, g, list[peak], peakRow, tipCol);
    return out;
  }

  function paintCard(out: string[], g: Geometry, prompt: Prompt, row: number, tipCol: number) {
    const width = Math.min(CARD_WIDTH, tipCol - 1 - g.tr.rect.x);
    if (width < 18) return;
    const inner = width - 4, t = theme;
    const all = wrapTextWithAnsi(prompt.text.replace(/\s+/g, " ").trim() || "（图片或空提问）", inner);
    const body = all.slice(0, 2);
    if (all.length > 2) body[1] = truncateToWidth(body[1] + "……", inner, "…");
    const title = prompt.round !== undefined ? `第 ${prompt.round} 轮` : `第 ${prompt.line} 行`;
    const time = prompt.time;
    const edge = (s: string) => t.fg("borderMuted", s);
    const pad = (s: string) => s + " ".repeat(Math.max(0, inner - visibleWidth(s)));
    const head = t.bold(t.fg("accent", title));
    const lines = [
      edge("╭" + "─".repeat(width - 2) + "╮"),
      edge("│ ") + head + " ".repeat(Math.max(1, inner - visibleWidth(title) - visibleWidth(time))) + t.fg("dim", time) + edge(" │"),
      ...body.map(b => edge("│ ") + t.fg("muted", pad(b)) + edge(" │")),
      edge("╰" + "─".repeat(width - 2) + "╯"),
    ];
    const bottom = g.tr.rect.y + g.tr.rect.height;
    const y0 = Math.max(g.tr.rect.y, Math.min(bottom - lines.length, row - 1));
    const x0 = tipCol - 1 - width;
    lines.forEach((line, k) => {
      const y = y0 + k;
      if (y >= 0 && y < out.length) out[y] = compositeAt(out[y], x0, width, line);
    });
  }

  // ---------- hooks ----------

  /** Wrap one method on this TUI instance only; returns the exact restore. */
  function wrap(target: Runtime, name: string, make: (original: Function) => Function): (() => void) | undefined {
    const original = target?.[name];
    if (typeof original !== "function") return undefined;
    const own = Object.prototype.hasOwnProperty.call(target, name);
    const patched = make(original);
    target[name] = patched;
    return () => {
      if (target[name] !== patched) return;
      if (own) target[name] = original; else delete target[name];
    };
  }

  function hook() {
    unhook?.();
    // Draw after Pi has composed each frame, so only the rail's own cells change.
    const restorePaint = wrap(tui, "compositeOverlays", original => function (this: Runtime, screen: string[], width: number, height: number) {
      const composed = original.call(this, screen, width, height);
      try { return paint(composed); } catch { return composed; }   // never break Pi's frame
    });
    // pi-tui's own viewport listener (registered first) consumes every mouse
    // sequence, so extension input listeners never see them. It calls
    // `this.handleViewportInput(data)`, so wrapping the instance method lets the
    // rail take its own wheel/clicks and hand everything else back unchanged.
    const restoreInput = wrap(tui, "handleViewportInput", original => function (this: Runtime, data: string) {
      let mine: ReturnType<typeof onInput>;
      try { mine = onInput(data); } catch { mine = undefined; }
      if (mine?.consume) return { consume: true };
      return original.call(this, mine?.data ?? data);
    });
    unhook = () => { restorePaint?.(); restoreInput?.(); unhook = undefined; };
  }

  /** Mouse (SGR 1006): reveal at the right edge, hover, wheel to scroll the rail, click to jump. */
  function onInput(data: string): { consume?: boolean; data?: string } | undefined {
    if (!enabled || !data.includes("\x1b[<")) return undefined;
    const g = geometry();
    if (!g) return undefined;
    let consumedAny = false;
    const rest = data.replace(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/g, (seq, b, cx, cy, kind) => {
      const button = Number(b), x = Number(cx) - 1, y = Number(cy) - 1;
      const inRows = y >= g.top && y < g.top + g.rail.rows;
      const hot = inRows && x >= g.right - HOT_ZONE && x < g.right + 1;
      const onRail = shown && inRows && x >= g.left && x <= g.right;
      if (button & 64) {                           // wheel
        if (!onRail && !hot) return seq;
        const list = prompts(g.tr);
        reveal(g, list);
        if (!shown) return seq;
        pointerRow = y; keyPeak = null;
        turnTo(g, list.length, rotTarget + ((button & 1) ? 1 : -1));
        consumedAny = true; return "";
      }
      if (button & 32) {                           // motion
        if (hot) reveal(g, prompts(g.tr));
        if (shown && (onRail || hot)) { clearTimeout(hideTimer); pointerRow = y; keyPeak = null; render(); }
        else if (shown) { pointerRow = null; hideSoon(); render(); }
        return seq;
      }
      if ((button & 3) === 0 && onRail) {          // left press / release on the rail
        if (kind === "M") {
          const list = prompts(g.tr);
          const i = tickAt(g.rail, list.length, rot, y - g.top);
          if (i !== undefined) jumpTo(g, list[i].line);
        }
        consumedAny = true; return "";
      }
      return seq;
    });
    if (!consumedAny) return undefined;
    return rest.length ? { data: rest } : { consume: true };
  }

  function step(delta: number) {
    const g = geometry();
    if (!g) return;
    const list = prompts(g.tr);
    if (list.length < MIN_PROMPTS) return;
    // Relative to the top of the view: previous = nearest prompt starting above it,
    // next = nearest starting below it. (The upper-third "active" prompt would make
    // Alt+[ land on the prompt that is already at the top.)
    const top = g.tr.scroll.scrollTop;
    let target = delta < 0 ? 0 : list.length - 1;
    if (delta < 0) { for (let i = list.length - 1; i >= 0; i--) if (list[i].line < top) { target = i; break; } }
    else { for (let i = 0; i < list.length; i++) if (list[i].line > top) { target = i; break; } }
    reveal(g, list);
    pointerRow = null; keyPeak = target;
    turnTo(g, list.length, target);
    jumpTo(g, list[target].line);
    hideSoon(KEY_HIDE_DELAY);
  }

  async function openPicker(current: ExtensionContext) {
    const g = geometry();
    if (!g) { current.ui.notify("提问导航需要 fullscreen 聊天界面。", "info"); return; }
    const list = prompts(g.tr);
    if (!list.length) { current.ui.notify("当前会话还没有提问。", "info"); return; }
    shown = false; render();
    const cur = activePrompt(list.map(p => p.line), g.tr.scroll.scrollTop, g.tr.scroll.viewportHeight);
    const items: PickerItem[] = list.map((p, i) => ({ index: i, round: p.round, time: p.time, text: p.text, current: i === cur }));
    const chosen = await current.ui.custom<number | null>((_tui, th, _keys, done) => new PromptPicker(items, th, done),
      { overlay: true, overlayOptions: { anchor: "center", width: "70%", maxHeight: "70%" } });
    const after = geometry();
    if (chosen !== null && chosen !== undefined && after) {
      const fresh = prompts(after.tr);
      if (fresh[chosen]) jumpTo(after, fresh[chosen].line);
    }
  }

  // ---------- lifecycle ----------

  function detach() {
    clearTimeout(hideTimer); clearInterval(rotAnim); clearInterval(jumpAnim);
    unhook?.();
    shown = false; pointerRow = null; keyPeak = null;
  }
  function attach(next: ExtensionContext) {
    detach();
    ctx = next;
    if (!next.hasUI || next.mode !== "tui") return;
    next.ui.setWidget(WIDGET, (t, th) => {
      tui = t; theme = th; hook();
      return { render: () => [], invalidate() {}, dispose() { if (tui === t) unhook?.(); } };
    }, { placement: "belowEditor" });
  }

  pi.on("session_start", (_e, next) => attach(next));
  pi.on("session_tree", (_e, next) => { ctx = next; shown = false; render(); });
  pi.on("session_compact", (_e, next) => { ctx = next; shown = false; render(); });
  pi.on("session_shutdown", () => { detach(); ctx = undefined; tui = undefined; });

  pi.registerShortcut("alt+[", { description: "跳到上一条提问", handler: () => step(-1) });
  pi.registerShortcut("alt+]", { description: "跳到下一条提问", handler: () => step(1) });
  pi.registerShortcut("alt+j", { description: "提问导航列表", handler: current => openPicker(current) });

  pi.registerCommand("rail", {
    description: "提问刻度条：on | off | status | list",
    handler: async (args, current) => {
      const action = args.trim().toLowerCase() || "status";
      if (action === "on") { enabled = true; current.ui.notify("提问刻度条已开启：鼠标移到右边缘唤出。", "info"); }
      else if (action === "off") { enabled = false; shown = false; render(); current.ui.notify("提问刻度条已关闭。", "info"); }
      else if (action === "list") await openPicker(current);
      else if (action === "status") {
        const g = geometry();
        current.ui.notify(!enabled ? "已关闭"
          : !g ? "未接入：需要 fullscreen 聊天界面"
          : `已开启 · ${prompts(g.tr).length} 条提问 · 鼠标移到右边缘唤出，Alt+[ / Alt+] 跳转，Alt+J 列表`, "info");
      } else current.ui.notify("用法：/rail [on|off|status|list]", "info");
    },
  });
}
