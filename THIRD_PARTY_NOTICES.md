# Third-party notices

The project's original extensions, tools, theme, generated completion tone and documentation are MIT licensed; see [LICENSE](LICENSE).

- `patches/alps-pi/` contains modified portions of **alps-pi 0.3.4**, MIT. Its original notice is retained in [licenses/alps-pi.txt](licenses/alps-pi.txt). Obtain the original package from npm; this repository is not an upstream replacement.
- `patches/subscription-usage/` contains a modified file from **@specode/pi-subscription-usage 1.3.1**, MIT. See [licenses/subscription-usage.txt](licenses/subscription-usage.txt).
- `linux/patches/alps-pi/` and `linux/patches/subscription-usage/` independently preserve the Linux host's changes to those same fixed upstream versions, under the same MIT notices above. The Linux profile distributes no audio or font binaries.
- Pi and test dependencies remain subject to their upstream licenses; they are not bundled in the distributed package.
- Maple Mono font data is **not MIT**: it uses SIL Open Font License 1.1. This repository distributes only our build recipe plus the upstream [fonts/OFL.txt](fonts/OFL.txt) notice, not font binaries. Obtain source fonts upstream. Keep that notice with generated fonts, preserve upstream copyright and use the renamed derived family. See [fonts/README.md](fonts/README.md).
- No third-party game audio, account data, skill implementations or MCP credentials are redistributed. Skills, MCP servers and recommended plugins are links to their original projects and retain their own licenses.
