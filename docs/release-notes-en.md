# Global Rater 3.3.3 — Release Notes

This release incorporates accumulated updates from [upstream Rater](https://github.com/wikimedia-gadgets/rater), improves dialog stability, and adds more flexible assessment policies for individual wikis.

## Changes

- Added a **Wrap projects** button and a user preference for automatic wrapping: never, always, from two projects, from three projects, or the wiki's default. The button becomes available again after removing the shell and is disabled when no projects remain.
- Added per-wiki shell parameter schemas and aliases. Banner shells are excluded from project search, their names no longer receive a project prefix, and generic project fields such as `needs-infobox` are not injected into Russian Wikipedia's shell.
- Fixed Russian banner metadata when TemplateData is missing or unavailable: local assessment fields are recognized, English `needs-image` and `needs-infobox` defaults are not injected, and outdated cached fallback metadata is ignored.
- Updated the defaults for Russian Wikipedia: no automatic banner shell creation and assessments in individual project banners. Roman numerals are shown in menus while Arabic numerals are written to wikitext. English Wikipedia automatically creates the shell and uses native class names and shared assessments.
- Localized Russian Wikipedia's edit summaries independently of the user's interface language and bundled the updated Russian translations.
- Widened the project action menu and allowed long button labels to wrap within the viewport.
- Fixed dialog hangs when closing without saving and when preview, comparison, or save operations fail.
- Fixed nested banner shell handling, including stray closing braces, lost importance ratings, and incorrect assessment migration. Unsupported shared assessments now require an explicit supported choice before saving, preventing silent data loss.
- Fixed the display of comparison rows and error messages, drag-handler cleanup when reopening the dialog, and search focus after selecting an existing project.
- Unified TemplateData processing so cached and uncached loads use the same canonical parameter names. Generating wikitext no longer changes the editor's UI state or triggers resize events.
- Improved the launch button integration, raw page URL handling, and the ORES logo URL. Reviewed compatibility with recent MediaWiki, Parsoid, and OOUI changes.
- Escaped parser control characters in generated script bundles so copying the code onto a wiki does not corrupt them.

## Validation

All 80 regression tests passed on each of OOUI 0.53.0, 0.53.2, and 0.54.2, including repeated wrapping after shell removal, missing and cached fallback metadata, per-wiki wrapping and parameter schemas, Roman display with Arabic serialization, localized summaries, the real window open/close lifecycle, and publication-safe parser markers. Lint checks and development/production builds passed. Current page HTML was also inspected on Russian and English Wikipedia, including Vector 2022, Timeless, and MonoBook samples. Final browser layout and logged-in saving should be checked on user sandbox pages before publication.

---

## Publication notes for the maintainer

These notes cover both [PR #2](https://github.com/In1quity/global-rater/pull/2) and [PR #3](https://github.com/In1quity/global-rater/pull/3). Merge PR #2 first, then PR #3. The package metadata and lockfile use version **3.3.3**; rebuild from the merged sources before publication.

Run `npm ci`, `npm run lint`, `npm run test:ooui`, and `npm run build`. The inherited `npm run test:run` suite still has its known failures: 23 failing files, mostly obsolete Template.js imports, plus an incomplete widget mock. Those failures are separate from the passing regression suite.

Before publication, test the rebuilt loader and core on user sandbox pages in both Russian and English Wikipedia. Check save, discard/cancel, reopen, long previews, comparisons, banner shells, assessment placement, and importance preservation. Point the sandbox loader at the sandbox core.

Publish the two rebuilt files to their corresponding pages:

- `dist/rater.js` → [User:Iniquity/rater.js](https://www.mediawiki.org/wiki/User:Iniquity/rater.js)
- `dist/rater-core.js` → [User:Iniquity/rater-core.js](https://www.mediawiki.org/wiki/User:Iniquity/rater-core.js)

The sections above the divider can be used as the public release description. Keep these publication notes out of the published changelog. The full compatibility review and its testing limits are in [dom-compatibility-2026.md](dom-compatibility-2026.md).
