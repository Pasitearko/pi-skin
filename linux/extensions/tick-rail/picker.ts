import { getKeybindings, Input, SelectList, truncateToWidth, visibleWidth, type Component } from "@earendil-works/pi-tui";

export interface PickerItem { index: number; round?: number; time: string; text: string; current: boolean }

/** Searchable prompt list: type to filter, ↑↓ to choose, Enter to jump. */
export class PromptPicker implements Component {
  private input = new Input();
  private list: SelectList;
  private query = "";
  constructor(private items: PickerItem[], private theme: any, private done: (index: number | null) => void) {
    this.list = new SelectList(items.map(it => ({
      value: String(it.index),
      label: `${it.round !== undefined ? `第 ${it.round} 轮` : `#${it.index + 1}`}  ${it.time}  ${it.text.replace(/\s+/g, " ")}${it.current ? "  ●" : ""}`,
    })), 10, {
      selectedPrefix: (t: string) => theme.fg("accent", t),
      selectedText: (t: string) => theme.fg("accent", t),
      description: (t: string) => theme.fg("muted", t),
      scrollInfo: (t: string) => theme.fg("dim", t),
      noMatch: (t: string) => theme.fg("muted", t),
    });
    this.input.focused = true;   // shows the cursor and anchors the IME candidate window
    const current = items.findIndex(it => it.current);
    if (current >= 0) this.list.setSelectedIndex(current);
    this.list.onSelect = item => done(Number(item.value));
    this.list.onCancel = () => done(null);
  }
  invalidate() { this.list.invalidate(); }
  handleInput(data: string) {
    const kb = getKeybindings();
    if (["tui.select.up", "tui.select.down", "tui.select.pageUp", "tui.select.pageDown", "tui.select.confirm", "tui.select.cancel"]
      .some(id => kb.matches(data, id))) {
      this.list.handleInput(data);
      return;
    }
    this.input.handleInput(data);
    const next = this.input.getValue();
    if (next !== this.query) { this.query = next; this.list.setFilter(next); }
  }
  render(width: number): string[] {
    const t = this.theme, inner = Math.max(10, width - 4);
    const edge = (s: string) => t.fg("borderMuted", s);
    const row = (s: string) => {
      const body = truncateToWidth(s, inner, "…");
      return edge("│ ") + body + " ".repeat(Math.max(0, inner - visibleWidth(body))) + edge(" │");
    };
    const title = ` 提问导航 · ${this.items.length} 条 `;
    const top = edge("╭─") + t.bold(t.fg("accent", title)) + edge("─".repeat(Math.max(0, width - 3 - visibleWidth(title))) + "╮");
    const hint = " ↑↓ 选择 · Enter 跳转 · Esc 关闭 · ● 当前位置 ";
    const bottom = edge("╰─") + t.fg("dim", hint) + edge("─".repeat(Math.max(0, width - 3 - visibleWidth(hint))) + "╯");
    const field = t.fg("dim", "过滤: ") + (this.input.render(inner - 6)[0] ?? "");
    return [top, row(field), row(""), ...this.list.render(inner).map(row), bottom];
  }
}
