# Changelog

## [1.0.0] - 2026-08-29

- Complete lightweight rewrite focused 100% on fast, zero-bloat status bar tracking and responsive hover tooltips.
- 100% local operation querying the local Antigravity Language Server / Hub RPC service without external network calls or webview overhead.
- Interactive toggle controls directly in the hover tooltip to show/hide 5-hour and weekly quota metrics in real-time.
- Symmetric and clean status bar formatting: `✦ Gemini 82% (2h 25m) • 97% (6d) || ✳ Other 85% (2h 5m) • 97% (6d)`.
- Replaced custom font dependencies and heavy webviews with native ASCII/Unicode visual progress bars and standard VS Code Codicons.
- Configurable refresh intervals, status bar alignment, priority, and per-bucket visibility toggles under the `antigravity-usage.*` namespace.
