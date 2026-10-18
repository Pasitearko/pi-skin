import { sliceByColumn, visibleWidth } from "@earendil-works/pi-tui";

// pi-tui keeps the composed layout (`currentLayout`) and a ScrollView's content
// (`child`) in non-public fields. Every access is isolated here and checked, so
// a future Pi that renames them only disables the rail instead of breaking Pi.
type Runtime = any;

export interface Rect { x: number; y: number; width: number; height: number }
export interface Transcript { scroll: Runtime; doc: Runtime; rect: Rect; scrollbar: boolean }

/** The fullscreen chat transcript: its ScrollView, content component and screen rect. */
export function findTranscript(tui: Runtime): Transcript | undefined {
  const frame = tui?.currentLayout;
  const scroll = frame?.primaryScrollView;
  if (!frame?.root || !scroll || typeof scroll.scrollTo !== "function" || typeof scroll.scrollTop !== "number") return;
  const box = findBox(frame.root, scroll);
  if (!box?.rect || !scroll.child) return;
  return { scroll, doc: scroll.child, rect: box.rect, scrollbar: Boolean(scroll.isScrollbarVisible) };
}

function findBox(box: Runtime, scroll: Runtime): Runtime {
  if (!box) return undefined;
  if (box.scrollView === scroll || box.component === scroll) return box;
  for (const child of box.children ?? []) {
    const found = findBox(child, scroll);
    if (found) return found;
  }
  return undefined;
}

export interface PromptMark { line: number; text: string }

/**
 * User prompts in the transcript with their first content line. Uses the heights
 * every Container records during its last render (`mouseLayout`), so nothing is
 * re-rendered. Approach adapted from pi-personalization's conversation-timeline.
 */
export function indexPrompts(doc: Runtime): PromptMark[] {
  const marks: PromptMark[] = [];
  const seen = new Set<object>();
  let skillText: string | undefined;
  const walk = (component: Runtime, start: number, height: number) => {
    if (!component || height <= 0 || seen.has(component)) return;
    seen.add(component);
    const name = component.constructor?.name;
    if (name === "AssistantMessageComponent" || component.lastMessage?.role === "assistant") return;
    const isUser = name === "UserMessageComponent" ||
      (typeof component.text === "string" && typeof component.outputPad === "number" && Array.isArray(component.markdownTransformers));
    if (isUser) {
      // A skill frame is followed by its own user text: one prompt, not two.
      if (skillText === undefined || skillText !== component.text) marks.push({ line: start, text: component.text });
      skillText = undefined;
      return;
    }
    const skill = component.skillBlock;
    if (skill && typeof skill.name === "string") {
      skillText = typeof skill.userMessage === "string" && skill.userMessage ? skill.userMessage : undefined;
      marks.push({ line: start, text: skillText ?? `[skill] ${skill.name}` });
      return;
    }
    const children = component.mouseLayout?.children;
    if (!Array.isArray(children)) return;
    let offset = start;
    for (const child of children) {
      const childHeight = Number.isFinite(child.height) ? Math.max(0, Math.floor(child.height)) : 0;
      walk(child.component, offset, childHeight);
      offset += childHeight;
    }
  };
  walk(doc, 0, Number.MAX_SAFE_INTEGER);
  return marks;
}

// ---------- compositing onto finished screen lines ----------

const RESET = "\x1b[0m";
const LEADING_ESCAPES = /^(?:\x1b\[[0-9;:]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))*/;

/** Background SGR in effect at `col`, so a floating glyph keeps the colour beneath it. */
export function backgroundAt(line: string, col: number): string {
  const prefix = sliceByColumn(line, col, 1, true).match(LEADING_ESCAPES)?.[0] ?? "";
  let bg = "";
  for (const m of prefix.matchAll(/\x1b\[([0-9;:]*)m/g)) {
    const params = m[1] === "" ? [0] : m[1].split(/[;:]/).map(Number);
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p === 0 || p === 49) bg = "";
      else if ((p >= 40 && p <= 47) || (p >= 100 && p <= 107)) bg = `\x1b[${p}m`;
      else if (p === 48 && params[i + 1] === 5) { bg = `\x1b[48;5;${params[i + 2]}m`; i += 2; }
      else if (p === 48 && params[i + 1] === 2) { bg = `\x1b[48;2;${params[i + 2]};${params[i + 3]};${params[i + 4]}m`; i += 4; }
      else if (p === 38) i += params[i + 1] === 5 ? 2 : params[i + 1] === 2 ? 4 : 0;
    }
  }
  return bg;
}

/** Replace `width` columns of `line` starting at `col` with `text`; the rest of the line is untouched. */
export function compositeAt(line: string, col: number, width: number, text: string): string {
  const total = visibleWidth(line);
  const before = sliceByColumn(line, 0, col, true);
  const afterLength = Math.max(0, total - col - width);
  const after = afterLength > 0 ? sliceByColumn(line, col + width, afterLength, true) : "";
  // Wide characters split by the edges become spaces.
  return before + " ".repeat(Math.max(0, col - visibleWidth(before))) + RESET + text + RESET +
    " ".repeat(Math.max(0, afterLength - visibleWidth(after))) + after;
}
