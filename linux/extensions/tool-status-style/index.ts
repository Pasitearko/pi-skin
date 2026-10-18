import { CustomMessageComponent, InteractiveMode, Theme, VERSION, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Adapt the installed ALPS renderer without editing Pi, npm packages or the theme.
// Support only this Pi release: private rendering APIs require regression testing.
const VERIFIED_PI_VERSION = "1.3.0";
const ALPS_STATE = Symbol.for("alps.pi.patch.v1");
const OWNER = Symbol.for("pi.tool-status-style.owner.v1");
const TOOL_BACKGROUNDS = new Set(["toolPendingBg", "toolSuccessBg", "toolErrorBg"]);
// The system theme derives `success` from terminal palette slot 2, which this
// terminal intentionally maps to blue. Use private tokens ONLY for tool frames;
// leave the theme, terminal palette and all existing color tokens unchanged.
const TOOL_BORDER_GREEN = "piToolFrameGreen";
const TOOL_BORDER_RED = "piToolFrameRed";
const GREEN_ANSI = "\x1b[38;2;74;222;128m";
const RED_ANSI = "\x1b[38;2;248;113;113m";

type FrameStyle = { bg: string; border: string; label: string; text: string };
type FrameState = {
  config: { styles: Record<string, FrameStyle> };
  configVersion: number;
};
type Runtime = Record<string, any>;
type CustomBox = {
  bgFn?: (text: string) => string;
  setBgFn(bgFn?: (text: string) => string): void;
};
type StylePatch = {
  styles: Record<string, FrameStyle>;
  key: string;
  original: FrameStyle;
  replacement: FrameStyle;
};

export default function toolStatusStyle(pi: ExtensionAPI) {
  const owner = {};
  const methodPatches: Array<{
    target: Runtime; key: string; original: PropertyDescriptor; wrapped: Function;
  }> = [];
  const stylePatches: StylePatch[] = [];
  const customBoxes = new Map<CustomBox, { original: CustomBox["bgFn"]; replacement: NonNullable<CustomBox["bgFn"]> }>();
  let active = false;

  function updateFrameStyles() {
    const state = (globalThis as unknown as Record<symbol, FrameState | undefined>)[ALPS_STATE];
    const styles = state?.config?.styles;
    if (!state || !styles) return;
    let changed = false;
    for (const key of ["toolPending", "toolSuccess", "toolError", "bash"]) {
      const original = styles[key];
      if (!original || stylePatches.some(patch => patch.styles === styles && patch.key === key && patch.replacement === original)) continue;
      const replacement = { ...original, bg: "", border: key === "toolError" ? TOOL_BORDER_RED : TOOL_BORDER_GREEN };
      styles[key] = replacement;
      stylePatches.push({ styles, key, original, replacement });
      changed = true;
    }
    // ALPS cache signatures include this version; invalidate old frame colors.
    if (changed) state.configVersion += 1;
  }

  function patch(target: Runtime, key: string, create: (original: Function) => Function) {
    if (methodPatches.some(item => item.target === target && item.key === key)) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor || typeof descriptor.value !== "function") return;
    const wrapped = create(descriptor.value);
    Object.defineProperty(wrapped, OWNER, { value: owner });
    Object.defineProperty(target, key, { ...descriptor, value: wrapped });
    methodPatches.push({ target, key, original: descriptor, wrapped });
  }

  function install() {
    // customMessageBg is also used by assistant/thinking/skill messages. Clear
    // only the default custom-message Box instead of changing that shared token.
    // Hook rebuild, not render, so ALPS retains ownership of its frame renderer.
    patch(CustomMessageComponent.prototype as unknown as Runtime, "rebuild", original => function (this: Runtime, ...args: unknown[]) {
      const result = original.apply(this, args);
      const box = this.box as CustomBox | undefined;
      if (active && box && !customBoxes.has(box)) {
        const replacement = (text: string) => `\x1b[49m${text}\x1b[49m`;
        customBoxes.set(box, { original: box.bgFn, replacement });
        box.setBgFn(replacement);
      }
      return result;
    });
    patch(Theme.prototype as unknown as Runtime, "fg", original => function (this: Theme, token: string, text: string) {
      if (active && (token === TOOL_BORDER_GREEN || token === TOOL_BORDER_RED)) {
        return `${token === TOOL_BORDER_RED ? RED_ANSI : GREEN_ANSI}${text}\x1b[39m`;
      }
      return original.call(this, token, text);
    });
    // Native ToolExecutionComponent draws its own background BEFORE ALPS adds
    // the frame. Disable only the three tool background tokens, not diffs,
    // syntax highlighting, user messages, selection or the rest of the theme.
    patch(Theme.prototype as unknown as Runtime, "bg", original => function (this: Theme, token: string, text: string) {
      return active && TOOL_BACKGROUNDS.has(token)
        ? `\x1b[49m${text}\x1b[49m`
        : original.call(this, token, text);
    });
    patch(Theme.prototype as unknown as Runtime, "getBgAnsi", original => function (this: Theme, token: string) {
      return active && TOOL_BACKGROUNDS.has(token) ? "\x1b[49m" : original.call(this, token);
    });
    patch(Theme.prototype as unknown as Runtime, "style", original => function (this: Theme, text: string, options: Runtime) {
      if (active && typeof options.bg === "string" && TOOL_BACKGROUNDS.has(options.bg)) {
        return `\x1b[49m${original.call(this, text, { ...options, bg: undefined })}\x1b[49m`;
      }
      return original.call(this, text, options);
    });
    // ALPS session_start can run after ours. Reconcile at the post-startup
    // transcript rebuild and event boundaries, before components are rendered.
    for (const key of ["renderSessionItems", "handleEvent"]) {
      patch(InteractiveMode.prototype as unknown as Runtime, key, original => function (this: Runtime, ...args: unknown[]) {
        if (active) updateFrameStyles();
        return original.apply(this, args);
      });
    }
    updateFrameStyles();
  }

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || !ctx.hasUI) return;
    if (VERSION !== VERIFIED_PI_VERSION) {
      ctx.ui.notify(`工具状态样式尚未验证 Pi ${VERSION}，保留原样式。`, "warning");
      return;
    }
    active = true;
    install();
  });
  pi.on("resources_discover", (_event, ctx) => {
    if (active && ctx.mode === "tui" && ctx.hasUI) install();
  });
  pi.on("session_shutdown", () => {
    active = false;
    for (const item of methodPatches.reverse()) {
      if (item.target[item.key] === item.wrapped) Object.defineProperty(item.target, item.key, item.original);
    }
    methodPatches.length = 0;
    for (const [box, item] of customBoxes) {
      if (box.bgFn === item.replacement) box.setBgFn(item.original);
    }
    customBoxes.clear();
    for (const item of stylePatches.reverse()) {
      if (item.styles[item.key] === item.replacement) item.styles[item.key] = item.original;
    }
    stylePatches.length = 0;
    const state = (globalThis as unknown as Record<symbol, FrameState | undefined>)[ALPS_STATE];
    if (state) state.configVersion += 1;
  });
}
