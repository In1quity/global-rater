# Upstream synchronization

Merged `wikimedia-gadgets/rater` through `82ffa1fcbacaf020561fc040887534a54b88c609` (2026-08-02), from the shared base `feee94b523836e8d592e947fe76c02139ceac842`.

| Upstream change | Integration in Global Rater |
| --- | --- |
| `7a355c5`, scope OOUI overrides | Add `rater-windowManager` to `src/services/windowManager.js`; scope overrides in `src/styles/styles.css`; remove the teleport-target override. |
| `82ffa1f`, Timeless stacking | Raise only Rater's active window contents to z-index 400, below confirmation dialogs at 450. |
| `79db8b7`, manual testing and deployment | Adapt README instructions to Vite's loader/core output and the global MediaWiki.org publication pages. |
| `2cdfa64`, `d46deb7`, architecture diagrams | Retain both SVGs and link them as upstream v2 reference diagrams. |
| `f8c3156`, banner data documentation | Document category discovery and TemplateData, including per-wiki overrides. |
| `b72cd80`, dependency refresh | Refresh the fork's lockfile within its existing dependency ranges. Retain Vite, ESLint 9 and Vitest instead of restoring the removed Browserify toolchain. |
| `f6e0b97`, inheritance-error workaround | The fork's loader already waits for OOUI core, widgets, windows and MediaWiki widgets before loading the core bundle. Retain that dependency ordering rather than adding upstream's session-wide `client-error-opt-out`, which disables reporting for unrelated scripts too. |
| `113ea31`, upstream merge | Preserve upstream history through this merge. |

The loader and build metadata point to `In1quity/global-rater` and `User:Iniquity/rater.js`; production loads `User:Iniquity/rater-core.js` on MediaWiki.org.
