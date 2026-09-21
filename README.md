# Google Antigravity Usage - Fast, Simple, Local

No re-login Antigravity needed. An ultra-fast, lightweight, and 100% local VS Code status bar monitor. Built initially to welcome the Official Google-Antigravity extension in your `VScode`. 

## Status Bar & Tooltip Preview
You might get dissapointed that I dont include any real png screenshot here. but I'm just trying my best to compress extenstion to the minimum size. And, anyway, both bar and tooltip mainly are just ascii, no expensive codes or something else there. So arguably, the ascii you see here is almost identical to the real one you will see on VScode.

### Status Bar Text
```text
┌─────────────────────────────────────────────────────────────────────────┐
│  ✦ Gemini 82% (2h 25m) • 97% (6d)      ✳ Other 85% (2h 5m) • 97% (6d)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Clean Hover Tooltip
Hover over the status bar item to view distinct 2-line quota blocks with interactive show/hide status bar toggles:

```text
          ┌──────────────────────────────────────┐
          │  ✦ Gemini                           │
          │                                      │
          │  🟡 5-Hour              hide bar 👁  │
          │  19% ■■■■■■■■■■■■■■■■■··· 1h 46m     │
          │                                      │
          │  🔴 Weekly              hide bar 👁  │
          │  4% ■■■■■■■■■■■■■■■■■■■· 2d          │
          │                                      │
          ├──────────────────────────────────────┤
          │  ✳ Other                            │
          │                                      │
          │  🟡 5-Hour              hide bar 👁  │
          │  11% ■■■■■■■■■■■■■■■■■··· 1h 3m      │
          │                                      │
          │  🟢 Weekly              hide bar 👁  │
          │  97% ■■■■■■■■■■■■■■■■■■■· 2d         │
          │                                      │
          ├──────────────────────────────────────┤
          │  ⚙ Settings              Refresh ↻  │
          └──────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  🔴 Gemini 19% (1h 46m) • 4% (2d)      🟡 Other 11% (1h 3m) • 97% (2d)  │
└──────────────────────────────────────────────────────────────────────────┘
```
note: color in bar will appear replacing `✦` and `✳` when certain limit reached. you can play with them in setting. by default 🟡 will appear on `20%` and 🔴 on `10%`. 

In the bar, both icons will follow the worse situation between `5-hour` vs `weekly` limit. As you can see above in the ascii example.

---

## Why I published this extension?

Previously, you can only access Gemini officially from Antigravity-IDE app, and you can't use that from VScode except through unofficial extensions. But finally per-late `August 2026` Google released an Official Antigravity Extension for VScode.

I switched instantly to VScode, because it has more extension supports compared to open market in Antigravity-IDE, which I need. But then, I struggle to find Antigravity `Usage extension` that is really `simple` and `minimalist`, I just need to see the usage in bar, and maybe simple visual when hovering on it. I don't need those metric craps and full-screen graphs most of the time.

I saw good extensions for this in OpenVSX marketplace in Antigravity-IDE. But not yet in VScode marketplace, maybe because the `antigravity-official-ext` is pretty newborn here. So, here I am, publishing a new one. I published this like 9 days after the Official Google Antigravity extension got published. Hope this extension fits other peoples!

Oh important note: in some rare cases, this extension failed to read your usage after first installation due to VScode caching or something else. I find that if you just close all VScode windows and then reopen them back, everything will work just fine after. Just once, the first time you install, if you have this issue. Else, you are fine to go. I still don't have any other clue to cover this case, maintainers/PR are welcome as long as you keep this extension tiny and simple as the original philosophy, thankyou!

---

## Feature / Promises

- **100% Local & Private**: No `external servers`, no `cloud proxies`, and `zero telemetry`. Queries your local Antigravity Language Server loopback interface (`127.0.0.1`) directly.
- **Zero Bloat**: ultra-fast. no `complex` or `heavy` webviews or background `scrapers`. Packaged at `~20 KB` on download (but it doubles to `~40 KB` usually during installation. anyway its still super small).
- **4 Core Metrics Monitored**:
  1. **Gemini 5h Limit** (remaining % and reset countdown)
  2. **Gemini Weekly Limit** (remaining % and reset countdown)
  3. **Other Models 5h Limit** (Claude / GPT, remaining % and reset countdown)
  4. **Other Models Weekly Limit** (Claude / GPT, remaining % and reset countdown)

---

## Configuration Settings
| Setting | Default | Description |
| :--- | :--- | :--- |
| `antigravity-usage.show-gemini-5h` | `true` | Show Gemini 5-hour quota in status bar. |
| `antigravity-usage.show-gemini-weekly` | `true` | Show Gemini weekly quota in status bar. |
| `antigravity-usage.show-other-5h` | `true` | Show Other models 5-hour quota in status bar. |
| `antigravity-usage.show-other-weekly` | `true` | Show Other models weekly quota in status bar. |
| `antigravity-usage.limit-gemini-runout` | `10` | Runout quota threshold percentage for Gemini (displays 🔴). |
| `antigravity-usage.limit-gemini-warning` | `20` | Warning quota threshold percentage for Gemini (displays 🟡). |
| `antigravity-usage.limit-other-runout` | `10` | Runout quota threshold percentage for Other models (displays 🔴). |
| `antigravity-usage.limit-other-warning` | `20` | Warning quota threshold percentage for Other models (displays 🟡). |
| `antigravity-usage.refresh-interval` | `60` | Auto-refresh interval in seconds (set to `0` to disable). |
| `antigravity-usage.status-bar-alignment` | `Right` | Status bar alignment (`Right` or `Left`). |
| `antigravity-usage.status-bar-priority` | `110` | Priority position in the status bar. |

---

## Commands

- **Refresh Antigravity Usage** (`antigravity-usage.refresh`): Instantly query the local language server and update quota numbers. (Also triggers on status bar click).
- **Open Antigravity Usage Settings** (`antigravity-usage.open-settings`): Open the extension's settings page.

---

## Building from Source

If you prefer to compile and package locally for 100% verifiable builds without downloading pre-built binaries:

1. Run the local packaging script in PowerShell:
   ```powershell
   .\build-local-vsix.ps1
   ```
2. Open VS Code or Antigravity IDE.
3. Open Extensions (`Ctrl + Shift + X`), click **`...`** (Views and More Actions) in the top-right corner, and choose **Install from VSIX...**.
4. Select the `.vsix` package generated inside the **`dev_vsix/`** folder.

Of course, you can always clone this repo, do edits as you wish, or do security review first before you compile it locally -- in case you have zero trust or something. It's okay, I also do the same sometimes, haha.

---

## License

MIT License

---

## Contributions

PRs are welcome, as long as you keep the fundamental philosophy:
- keep the code clean and simple. I don't care if that's your code or your agent's
- keep the features simple. dont add bloats and everything else. just bar, bar-on-hoover, and setting. thats all.

feel free!
