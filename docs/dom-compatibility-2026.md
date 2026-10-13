# Rater DOM and compatibility review

Reviewed on 13 October 2026. The change window is 13 October 2025 through 13 October 2026. This review covers MediaWiki and OOUI changes relevant to this script, rather than every platform issue.

## Platform changes

| Change and primary source | Effect on Rater and response |
| --- | --- |
| OOUI 0.53.1 changed SelectWidget focus handling in December 2025; 0.53.2 changed native focus events and viewport positioning in April 2026. [OOUI release history](https://github.com/wikimedia/oojs-ui/blob/master/History.md) | Keep using OOUI's widget methods. Check actions, dropdowns, errors and teardown against actual OOUI implementations instead of incomplete mocks. |
| OOUI 0.54.1 excluded the teleport target from WindowManager isolation in July 2026. [OOUI release history](https://github.com/wikimedia/oojs-ui/blob/master/History.md) | Relevant because the loading dialog uses Vue/Codex and the editor uses OOUI. This is an upstream isolation fix, not proof that a reported Rater hang was caused by it. Rater's own action lifecycle fix is in PR #2; its scoped window styles do not style the teleport target. |
| Parsoid expanded to more Wikipedias during this period, with English desktop rollout announced in July 2026. [Tech News 2025/47](https://meta.wikimedia.org/wiki/Tech/News/2025/47), [Tech News 2026/28](https://meta.wikimedia.org/wiki/Tech/News/2026/28), [Parser Unification](https://www.mediawiki.org/wiki/Parsoid/Parser_Unification) | Page content can contain additional section/transclusion wrappers. Rater edits API wikitext and obtains categories via the API; it does not extract project templates from rendered page content. Preview rendering is checked with both legacy and Parsoid-shaped HTML. |
| Parsoid wikilink `href` attributes changed from protocol-relative to absolute URLs in July 2026; REST output was excluded. [Tech News 2026/29](https://meta.wikimedia.org/wiki/Tech/News/2026/29) | Rater does not match page links by a `//` prefix. Separately, its raw-text fetch assumed a protocol-relative `wgServer`; use URL resolution for relative, protocol-relative and absolute URLs. This fixes an existing assumption, not a demonstrated Parsoid API regression. |
| `mw.util.addPortletLink` gained an object argument in June 2026; positional arguments remain supported. [Tech News 2026/24](https://meta.wikimedia.org/wiki/Tech/News/2026/24) | Retain the compatible positional call. Bind the returned element and fall back to the toolbox if the actions portlet is unavailable. Remove the global monkey patch, which interfered with other scripts and duplicated the existing ID guard. |
| Non-standard direct thumbnail requests were announced for retirement; thumbnail URLs now move to `thumb.wikimedia.org`, with old URLs continuing to work. Originals stay on `upload.wikimedia.org`. [Tech News 2026/05](https://meta.wikimedia.org/wiki/Tech/News/2026/05), [Tech News 2026/36](https://meta.wikimedia.org/wiki/Tech/News/2026/36) | Replace the ORES logo's hand-built 40px thumbnail URL with the original SVG displayed at 20px. The original returned HTTP 200 during this audit. |

## Current page markup

Read-only HTTP checks of these pages returned HTTP 200 on the review date:

- [ruwiki: Вредные советы, Vector 2022](https://ru.wikipedia.org/wiki/Вредные_советы?useskin=vector-2022)
- [enwiki: Earth, Vector 2022](https://en.wikipedia.org/wiki/Earth?useskin=vector-2022)
- [ruwiki: Вредные советы, Timeless](https://ru.wikipedia.org/wiki/Вредные_советы?useskin=timeless)
- [ruwiki: Вредные советы, MonoBook](https://ru.wikipedia.org/wiki/Вредные_советы?useskin=monobook)

All four responses retained `#p-cactions`, `#p-tb`, `#ca-talk` and `#ca-nstab-main`. All contained `section[data-mw-section-id]` inside `.mw-parser-output`. Their portlet classes differed by skin. Bindings use MediaWiki's portlet helper rather than a particular skin's wrapper classes. The missing-page checks still rely on the `new` class of namespace/talk tabs; these HTTP samples were existing pages and do not validate every missing-page or skin combination.

## Additional defects found in Rater

These are script defects; the audit did not establish that they were introduced by last year's platform changes:

- A bare DOM element passed to `OO.ui.Error` becomes an object string. One shared error factory now passes a jQuery object and retains escaped, readable messages. The window title also uses a supported jQuery label.
- Body drag listeners survived teardown and accumulated on reopening. Each setup now replaces the previous handlers, and teardown removes them.
- Duplicate-project alerts referenced a nonexistent search box and called focus before dismissal. Refocus the actual search box after the alert resolves.
- Compare API table rows were parsed inside a `div`, which discards row/cell markup. Parse them inside a table before displaying the diff.

The DRY/KISS fixes also give TemplateData processing one cache-aware path and move wikitext formatting into a pure serializer. Shared-class validation returns a value without changing widgets and rejects incompatible migrations instead of silently discarding an assessment.

## Validation and limits

`npm run test:ooui` runs the regression suite in separate processes against OOUI 0.53.0 (the baseline before this window), 0.53.2 and 0.54.2. Production still obtains OOUI from MediaWiki ResourceLoader; the additional packages are test dependencies only. CI runs the same matrix.

Tests cover preservation of assessments and importance, unsupported shared classes, cold/warm caches, serialization without resize events, discard/cancel/error pending states, duplicate alerts, drag-handler cleanup, preview wrappers, diff rows, portlet fallback and raw URL variants. Lint and development/production builds are also required.

The inherited `npm run test:run` suite still has 23 failing files: 22 import the removed `src/utils/Template.js`, and one uses an incomplete widget mock. Its failure counts match the PR #2 baseline. The regression suite runs independently with real OOUI.

This is automated jsdom coverage plus inspection of current unauthenticated page HTML. It does not establish pixel-level layout, keyboard focus, Codex/OOUI interaction or saving under a logged-in browser session on every skin. Before publication, test the generated loader/core on a user sandbox in ruwiki and enwiki, including long previews, dropdowns, discard/reopen and save.
