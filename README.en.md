# Pi Personalization
[中文完整说明](README.md) · [MIT](LICENSE) · [npm](https://www.npmjs.com/package/@jiuliyear/pi-personalization) · [Pi catalog](https://pi.dev/packages/@jiuliyear/pi-personalization) · [Recommendations](docs/RECOMMENDATIONS.md)

An installable Pi package distilled from a locally customized setup: weather, quota row, per-round timer, OpenAI Fast switch, message timestamps, prompt timeline, whole-frame collapse/expand, clean selection/copy, and a minimal theme.

## Platform profiles

- **Windows / original package:** root `extensions/`, `patches/` and the Windows Terminal example. This update adds clean multiline input selection; the separate Linux profile is unchanged.
- **Linux / CachyOS + Kitty:** see **[linux/README.md](linux/README.md)** for the separate Pi **1.3.0** local package, seven current components, sanitized settings/keybindings, Nerd Font icons, fixed green/red tool frames, PipeWire audio support (bring your own audio), and version/hash-guarded Linux patches.

The root npm/git package does not automatically load `linux/`. Clone the repository and follow the Linux instructions; do not load duplicate components from both profiles. No new npm release is made by this addition.

## Previews

### Actual terminal screenshot

![Pi running in Windows Terminal on Windows 11 with PowerShell 7.6](docs/previews/windows-terminal-real.png)

Windows 11, Windows Terminal, PowerShell 7.6. The author explicitly chose to publish this original image without cropping, masking or image edits. This is an actual terminal capture, not a fictional-data demo.

### Controlled demo previews

The following three images are privacy-safe demo renders, not screenshots of private sessions or accounts. Real Pi / ALPS frames and actual click/selection handlers are used with fictional dialogue, paths, timestamps and values; footer rows are illustrative. Terminal fonts and platform behavior may differ.

![Interface overview with fictional status values](docs/previews/overview.png)

![Whole-frame click: compact and expanded states](docs/previews/frame-click.png)

![Native versus clean selection, including actual copied text](docs/previews/clean-selection.png)

[Preview provenance and privacy notes](docs/previews/README.md)

## Install

```sh
pi install npm:@jiuliyear/pi-personalization
```

Alternatively, install from GitHub: `pi install git:github.com/Pasitearko/pi-personalization`. **Choose one source; do not load both copies.** The npm package includes the `pi-package` discovery keyword and a preview image. [Pi catalog](https://pi.dev/packages) indexing may lag behind npm publication.

Restart Pi or use /reload. Node 22.19.0+ (24 LTS recommended); Pi 1.2.0 recommended. The private frame/selection adapters also recognize tested 1.1.0 and 1.0.4. Unsupported layouts fail closed to native behavior. Fullscreen and terminal mouse/Unicode support are required for advanced interactions.

Base installation never overwrites installed plugins, settings, accounts or fonts. Optional advanced ALPS changes are explicit, exact-version/per-file-SHA-256 guarded, and reversible. Install alps-pi@0.3.4 and @specode/pi-subscription-usage@1.3.1 with Pi, clone this repo, run `node tools/setup.mjs` to preflight, then `node tools/setup.mjs --apply` only after reviewing the output and exiting Pi. The settings helper is separately opt-in: `--settings --apply` fills absent appearance leaves; `--replace-settings` explicitly adopts only the example's appearance leaves.

Mouse: an unmodified left-click release toggles already-collapsible frames; dragging, links and child buttons take priority. ALPS decorations remain drawn but are excluded from Pi's highlight and copied text. Real code indentation, trees, tables and literal box glyphs remain. This does not control terminal-owned Shift selection.

### Multiline input selection update (GitHub source)

The main input editor now excludes its top/bottom status rows, side rails and decorative padding from both highlighting and copied text. Selected indentation, blank lines, Chinese, emoji and literal box characters remain; autocomplete retains native selection. Only verified rendered metadata is used, with conservative native fallback. Input text and cursor are not changed.

Update the Git-installed extension **and** explicitly apply the latest guarded `bottom-input/editor.ts` advanced patch above while Pi is closed, then restart Pi. The extension alone does not patch ALPS. This GitHub update has **not** been published to npm. `clean-frame-copy` now additionally recognizes Pi **1.3.0**, with **36/36** real-component tests on both Pi **1.2.0 and 1.3.0**. Other extensions' version gates and the independent `linux/` profile are unchanged. Real-terminal appearance still requires user confirmation.

Fast is off for new sessions: /fast ok, /fast no. It requests priority, not proof of server acceptance, and may affect costs/limits. Quota requires the upstream plugin and your own sign-in; no balances/accounts are bundled. Weather uses explicit example coordinates (override PI_WEATHER_LOCATIONS with a JSON city list), sends coordinates to Open-Meteo, and displays weather data in Asia/Shanghai. It does not auto-geolocate.

Paths and tools are portable across Windows/macOS/Linux, but terminals differ. The audio and Unicode-file opener enhancements are Windows-specific; other systems retain their native behavior. No claim is made that every terminal or future Pi release has identical mouse/link/font behavior.

Original source, tools, theme, generated notification tone and docs are MIT. Modified upstream files retain their MIT notices. Fonts are not bundled: the optional letters-only italic build recipe preserves SIL OFL obligations. Third-party skills and MCP servers are recommendations, not redistributed credentials or code.

[CI](https://github.com/Pasitearko/pi-personalization/actions/workflows/ci.yml) runs tests and privacy/package checks on Windows, macOS and Linux. Automated checks do not certify every real terminal's behavior.

Development: `npm ci --ignore-scripts`, `npm test`, `npm run check:privacy`, `npm run package:check`. The test runner patches only this repository's disposable development dependencies. It never writes to the installed Pi or private backup.

See the Chinese README for all commands, guarded patch rollback, font recipe, recommendations, limitations and uninstall instructions.
