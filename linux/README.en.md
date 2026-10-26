# pi-skin · Linux

**CachyOS + Kitty + Pi 1.3.0: thin message frames, colored weather, a shared timer/quota row, clean copying and prompt navigation.**

[中文](README.md) · [Project home](../README.en.md) · [Inventory](INVENTORY.md) · [Security](../SECURITY.md)

## Layout and interactions

```text
┌ USER · 14:20 ────────────────────────────────────┐    ● ← prompt rail
│ Help me inspect this function                    │    │
└──────────────────────────────────────────────────┘    ●
┌ TOOL · read ─────────────────────────────────────┐    │
│ src/example.ts                click to expand ↕  │    ●
└──────────────────────────────────────────────────┘
  ☀ Shanghai · 22°C          ← click to switch cities
┌ INPUT ───────────────────────────────────────────┐
│ Type a message…                                  │
└ input / output · cache · tok/s · cost ───────────┘
  Completed 12s                       quota remaining
```

*Layout diagram with fictional values—not a terminal capture. Widths and glyphs depend on your font.*

| Whole-frame click | Clean selection and copying |
|:---:|:---:|
| ![Collapsed and expanded frame](../docs/previews/frame-click.png) | ![Copy without decorative borders](../docs/previews/clean-selection.png) |

These original-package demo renders illustrate shared interactions; they are not Linux terminal captures. [Preview provenance](../docs/previews/README.md)

## Features

| Component | Function | Controls |
|---|---|---|
| `weather-row` | Single-column colored icons, 3 default cities, 15-minute updates, cache and retry backoff | `/weather`; click city to switch |
| `working-timer` | Working / Completed / Failed / Cancelled; one sound after settlement; shares a row with quota | Automatic; `/sound-test` |
| `message-timestamps` | Local creation time in message headings | Automatic |
| `tick-rail` | Prompt positions, previews and navigation on the right | `/rail`; `Alt+[` / `Alt+]` / `Alt+J` |
| `frame-click-toggle` | Toggle an already-collapsible frame from noninteractive areas; dragging does not toggle | `/frame-clicks on/off/status` |
| `clean-frame-copy` | Exclude message/input frame decorations from highlighting and copying; preserve real content | `/clean-copy on/off/status` |
| `tool-status-style` | 🟩 Normal frame `#4ADE80`; 🟥 error `#F87171`; no large tool/native CUSTOM backgrounds | Automatic; preserves diffs and custom renderer colors |

ALPS-dependent features retain native behavior on unsupported layouts. Linux input-frame cleaning uses an ALPS 0.3.4 editor adapter, without the original package’s `bottom-input/editor.ts` patch. Terminal-owned Shift selection is unchanged.

## Install

Requirements: **Pi 1.3.0**, Node **22.19.0+** (24 LTS recommended), Kitty with fullscreen / SGR mouse / true color. **Maple Mono NF CN** is recommended for icons.

```sh
git clone https://github.com/Pasitearko/pi-skin.git
cd pi-skin
pi install npm:alps-pi@0.3.4
pi install npm:@specode/pi-subscription-usage@1.3.1
pi install ./linux
```

1. Disable the original package or same-name copies in `~/.pi/agent/extensions/` to avoid duplicate loading.
2. Merge the configuration below; advanced layout changes require an explicit patch application.
3. Restart or `/reload`. The local package loads from the clone, so do not move that directory after installation.

Do not reinstall if you already use these local components. The Linux package is separate from the original npm package; it does not automatically edit your terminal or import accounts.

## Configuration

### Files

| Example | Merge destination / purpose |
|---|---|
| [`config/settings.example.json`](config/settings.example.json) | `~/.pi/agent/settings.json`; Pi / ALPS appearance |
| [`config/keybindings.example.json`](config/keybindings.example.json) | `~/.pi/agent/keybindings.json`; Pi shortcuts |
| [`config/packages.example.json`](config/packages.example.json) | Optional plugins and pinned versions; no automatic installation |
| [`config/kitty-fonts.example.conf`](config/kitty-fonts.example.conf) | Kitty font fragment |
| [`config/kitty-input.example.conf`](config/kitty-input.example.conf) | Kitty input fragment, after existing includes |
| [`config/mcp-github.example.json`](config/mcp-github.example.json) | Adapter users: merge the github entry into `~/.config/mcp/mcp.json` |
| [`config/mcp-playwright.example.json`](config/mcp-playwright.example.json) | Merge into `~/.pi/agent/mcp.json` if needed |

**Merge individual fields; do not replace entire files. Keep your models, authentication and packages.**

### Pi / ALPS parameters

These are repository example values, not upstream Pi / ALPS defaults. `alps-pi.*` denotes nested settings fields.

| Parameter | Example value | Effect |
|---|---|---|
| `defaultThinkingLevel` | `"high"` | Default reasoning level; requires model support |
| `hideThinkingBlock` | `false` | Show thinking blocks |
| `defaultTools` | `["+codemode"]` | Add codemode to the default tools |
| `showHardwareCursor` | `true` | Hardware cursor |
| `fullscreenScrollbar` | `"hidden"` | Hide the fullscreen scrollbar |
| `alps-pi.chromeFrame.enabled` | `true` | Message frames |
| `alps-pi.chromeFrame.assistantFrame` | `true` | Assistant frame |
| `alps-pi.chromeFrame.toolCompactMode` | `"compact"` | Compact tool frames |
| `alps-pi.chromeFrame.compactEditTool` | `false` | Leave compactEditTool disabled |
| `alps-pi.fixedBottomEditor.enabled` | `true` | Fixed bottom editor |
| `alps-pi.beautifiedInput.enabled` | `true` | Styled input |
| `alps-pi.inputMetrics.*` | See below | Bottom metrics |
| `alps-pi.footer.enabled` | `true` | Footer |
| `alps-pi.animations.enabled` | `true` | Status animations |
| `alps-pi.animations.randomMode` | `false` | Do not randomly switch animations |
| `alps-pi.animations.working/thinking/tool` | `crush / shimmer / pipeline` | Animations by phase |
| `alps-pi.animations.width` / `fps` | `"default"` / `16` | Animation width / frame rate |

| `alps-pi.inputMetrics` field | inputTokens | outputTokens | cacheHit | tokenSpeed | elapsedTime | cost |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Example value | `true` | `true` | `true` | `true` | `false` | `true` |

ALPS elapsedTime is hidden; working-timer provides round timing. Cost is an estimate, not a bill. No theme is set; your existing choice is preserved.

### Shortcuts

| Action | Shortcut / source |
|---|---|
| Fullscreen search | `Ctrl+F`; Pi `tui.altScreen.search` |
| Cursor right | `Right`; Pi `tui.editor.cursorRight` |
| Previous / next prompt | `Alt+[` / `Alt+]`; tick-rail |
| Prompt picker | `Alt+J`; tick-rail |
| Stash input | `Alt+S`; ALPS `shortcuts.stashEditor` |
| Copy / cut input | `Ctrl+Alt+C` / `Ctrl+Alt+X`; ALPS |
| Scroll chat | `Super+Up` / `Super+Down`; ALPS |
| Input start / end | `Super+Shift+Up` / `Super+Shift+Down`; ALPS |
| Previous / next user message | `Ctrl+Shift+U` / `Ctrl+Shift+I`; ALPS |
| Previous / next assistant message | `Ctrl+Alt+,` / `Ctrl+Alt+.`; ALPS |
| Bottom of chat | `Ctrl+Shift+G`; ALPS |
| Open web / local file link | **Only `Ctrl+left-click`**; ALPS fullscreen patch + Kitty fragment; plain, `Shift` / `Ctrl+Shift` clicks do not open |
| Paste image into Pi | `Ctrl+V`; Kitty `no_op` passes the key through |
| Terminal paste / copy | `Ctrl+Shift+V` / `Ctrl+Shift+C`; Kitty |

Update both layers: fullscreen Pi always gates opening on Ctrl-click. In direct Kitty it preserves OSC 8 for native hover underlines, a hand pointer, and Ctrl-held target previews. The Kitty fragment blocks ordinary and other modified opening clicks, passes grabbed Ctrl clicks to Pi, and handles them itself only when ungrabbed. Hover feedback does not enable plain-click opening: Kitty's underline and hand are not Ctrl-gated; the target preview is. Other terminals and multiplexers still have terminal OSC 8 filtered while Pi retains its internal hit data. Plain clicking and drag selection remain available. Merge the Kitty fragment: updating either layer alone cannot guarantee the unified rule. The guard is session-scoped, independent of optional footer/editor visibility. Restart Pi and reload Kitty after installation; browser and other desktop applications are not modified.

Your terminal or window manager may intercept keys first. This package does not change system shortcuts.

### Commands

| Command | Function |
|---|---|
| `/weather` or `/weather refresh` | Refresh selected city; manual refresh is limited to once per 15 seconds |
| `/weather next` | Switch cached city without another request |
| `/weather <city-id>` | Select a configured city |
| `/rail on` / `off` / `status` / `list` | Prompt rail and picker |
| `/frame-clicks on` / `off` / `status` | Whole-frame clicking |
| `/clean-copy on` / `off` / `status` | Clean copying |
| `/sound-test` | Test sound without starting a timed round |

`/rail` alone shows status. The rail and previous/next stepping need fullscreen and at least 3 prompts; the picker works with 1. `/rail off` hides the rail without unbinding navigation. `/frame-clicks` and `/clean-copy` alone show status; both start enabled and do not save switches to settings.

### Environment: weather and audio

| Variable | Value / default behavior |
|---|---|
| `PI_WEATHER_LOCATIONS` | JSON array of 1–5 cities; defaults to Shanghai / Strasbourg / Tokyo |
| `PI_COMPLETION_SOUND` | Use an absolute path to your own audio; defaults to `~/.local/share/pi/sounds/minecraft-exp-orb.wav`, not bundled |

```sh
export PI_WEATHER_LOCATIONS='[{"id":"london","name":"London","latitude":51.5074,"longitude":-0.1278}]'
export PI_COMPLETION_SOUND="$HOME/.local/share/pi/sounds/my-completion.wav"
pi
```

Fish audio equivalent: `set -gx PI_COMPLETION_SOUND "$HOME/.local/share/pi/sounds/my-completion.wav"`.

- Weather uses [Open-Meteo](https://open-meteo.com/), updates on 15-minute boundaries, and retries after 1 / 2 / 4 / 8 minutes. Time is Asia/Shanghai; no automatic geolocation. Coordinates and source IP reach the service; follow its [terms](https://open-meteo.com/en/terms).
- City fields: unique `id` matching `^[a-z0-9-]{1,32}$`; nonblank `name` of at most 40 JS code units without control characters; `latitude` (−90–90); `longitude` (−180–180). Any invalid entry restores the default cities. Restart Pi after changes.
- Fixed request timeout: 12 seconds. Weather cache: `cache/weather-cities-v1.json` under the agent directory.
- Audio requires `/usr/bin/pw-play` (PipeWire), at 100% per-player volume without changing system volume. It plays once after final settlement, including Failed / Cancelled; retries and ordinary tool errors do not repeat it. Missing files / playback errors do not affect the round result.

### Optional plugins and MCP

| Plugin | Pinned version | Purpose |
|---|---|---|
| `alps-pi` | `0.3.4` | Message frames, editor and bottom layout |
| `@specode/pi-subscription-usage` | `1.3.1` | Subscription quota; requires your own sign-in |
| `billion-context` | `0.1.201` | Long-session context management |
| `@crazygit/pi-codex-image-gen` | `0.2.2` | Image generation |
| `pi-mcp-adapter` | `5.3.2` | MCP adapter |
| `pi-web-access` | `0.42.0` | Web tools |
| `@plannotator/pi-extension` | `0.28.23` | Plan review |

These are not installed with this package. Use `-builtin:mcp` from the example only if choosing pi-mcp-adapter, to avoid loading duplicate MCP implementations.

| MCP parameter | Example value | Meaning |
|---|---|---|
| GitHub `command` | `github-mcp-server` | Launch from PATH; install and authenticate separately |
| GitHub `lifecycle` | `"lazy"` | Start on demand |
| GitHub `openUi` | `false` | Do not open MCP App forms |
| GitHub `approveTools` | `true` | Require interactive tool approval; independent of the UI switch |
| GitHub OAuth scope | `repo,read:org` | Includes private repositories / write access; add `--read-only` if writes are unnecessary |
| Playwright | `@playwright/mcp@0.0.83` | Chrome; `--isolated --sandbox --no-webmcp` |

No authentication is bundled. `/reload` after changes. If you keep MCP UI enabled and use Immersive Translate, optionally install the [separate message-noise filter](compat/mcp-ui-filter/README.md).

## Patch tool and options

Advanced patches provide bottom metrics, persisted tok/s, message/input adaptation and the quota-sharing bridge. Pinned to **ALPS 0.3.4 / renderer 18** and **subscription-usage 1.3.1**; the MCP filter is pinned to **pi-mcp-adapter 5.3.2**.

Exit Pi, then run from the repository root:

```sh
# Appearance: check only unless --apply is supplied
node linux/tools/patches.mjs
node linux/tools/patches.mjs --apply

# Optional MCP UI filter; independent of appearance patches
node linux/tools/patches.mjs --mcp-ui-filter
node linux/tools/patches.mjs --mcp-ui-filter --apply
```

| Option | Effect / default |
|---|---|
| No arguments | Check appearance patches only; no writes |
| `--apply` | Write changes and create a local undo receipt |
| `--mcp-ui-filter` | Select only the separate MCP UI filter |
| `--agent-dir <dir>` | Agent path; defaults to `PI_CODING_AGENT_DIR` or `~/.pi/agent` |
| `--modules <dir>` | Dependency path; defaults to `<agent>/npm/node_modules` |
| `--undo <receipt> --apply` | Undo; add `--mcp-ui-filter` for the MCP patch |

```sh
node linux/tools/patches.mjs --undo /path/to/patch-undo.json --apply
node linux/tools/patches.mjs --mcp-ui-filter --undo /path/to/mcp-undo.json --apply
```

Version, SHA-256, symlink and later-file-change checks protect writes. Unknown edits and whole settings files are not overwritten. **The Linux CLI has no `--settings` / `--replace-settings`.** Revalidate after plugin upgrades; do not bypass version guards.

## Tests and uninstall

```sh
cd linux
npm ci --ignore-scripts
npm test
npm run check:privacy
```

| Coverage | Cases |
|---|---:|
| Package, configuration, patch safety and full apply / undo | 7 |
| Weather | 57 |
| Timer / audio | 36 |
| Clean-copy integration | 24 |
| CUSTOM / tool-frame rendering combinations | 960 |
| Optional MCP UI regression ([run separately](compat/mcp-ui-filter/README.md)) | 11 |

Tests use isolated development dependencies: no local Pi changes, model/quota calls or audio playback. Other Pi versions / terminals need their own acceptance testing.

Before uninstalling, undo patches using the receipt, then `pi remove <local source shown by pi list>` and restart. Keep or restore manually merged settings yourself.

No accounts, sessions, caches, audio or font binaries are bundled. [Inventory](INVENTORY.md) · [MIT](../LICENSE) · [Third-party licenses](../THIRD_PARTY_NOTICES.md)
