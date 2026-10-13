# Rater

<a href="https://nodejs.org/en/about/previous-releases"><img src="https://img.shields.io/badge/node-LTS-brightgreen" alt="node LTS support"></a>
<a href="https://github.com/In1quity/global-rater/actions/workflows/ci.yml"><img src="https://github.com/In1quity/global-rater/actions/workflows/ci.yml/badge.svg?branch=master" alt="build status"></a>

This is the source code for Global Rater, a version 3 fork of the Wikipedia userscript [Rater](https://en.wikipedia.org/wiki/User:Evad37/rater).

## Installation instructions and user guide
The global loader is published at [User:Iniquity/rater.js on MediaWiki.org](https://www.mediawiki.org/wiki/User:Iniquity/rater.js), and loads [User:Iniquity/rater-core.js](https://www.mediawiki.org/wiki/User:Iniquity/rater-core.js) from that same wiki. Import the loader in your local wiki's common.js:

```javascript
mw.loader.load( 'https://www.mediawiki.org/w/index.php?title=User:Iniquity/rater.js&action=raw&ctype=text/javascript' );
```

The upstream [user guide](https://en.wikipedia.org/wiki/User:Evad37/rater) describes the assessment interface; template names and assessment rules can vary by wiki.

## Where Rater looks for data

WikiProject banners are discovered from the categories in `config.categories`, notably `withRatings`. On English Wikipedia this is [Category:WikiProject banners with quality assessment](https://en.wikipedia.org/wiki/Category:WikiProject_banners_with_quality_assessment). Task forces and other parameters come from each banner's [TemplateData](https://en.wikipedia.org/wiki/User:Evad37/rater#TemplateData_quick_tutorial).

For another wiki, define its categories, banner prefixes, shell template and parameter values with `window.RATER_CONFIG`, or supply JSON through `window.RATER_CONFIG_URL`, before loading the script.

## Per-wiki shell and assessment settings

These site settings are merged into the built-in defaults before the interface opens. The wiki is detected from `wgDBname`, with the local server as a fallback; the MediaWiki.org host of the script does not determine the policy.

| Setting | Meaning | Russian Wikipedia default | English Wikipedia default |
| --- | --- | --- | --- |
| `shell.autoCreate` | Always create a shell when at least one project is present. | `false` | `true` |
| `shell.minProjects` | When `autoCreate` is false, create a shell at this project count. `null` disables automatic creation. | `null` | `null` |
| `shell.classLocation` | `"shell"` stores a shared quality assessment in the shell when one exists, otherwise in individual banners. `"banners"` always stores assessments in individual banners. | `"banners"` | `"shell"` |
| `shell.classParamName` | Name of the shell's assessment parameter when shell assessments are enabled. Banner parameter names come from TemplateData. | `"уровень"` | `"class"` |
| `classFormat` | `"arabic"` prefers 1–10, `"roman"` prefers I–X, `"native"` preserves native grades. Letter grades such as FA/B/C are preserved. | `"arabic"` | `"native"` |
| `classDisplayFormat` | Notation used for class labels in the interface, independently of the saved notation. | `"roman"` | `"native"` |
| `shell.parameters` | Complete array of parameter definitions for this wiki's shell. Each has a `name` and optional TemplateData-style `label`, `aliases`, `suggestedvalues`, `required`, `suggested`, and `autovalue`. Arrays replace the defaults rather than merging their fields. | `1`, `collapsed`, `header`, `blp` (alias `living`), `blpo`, `activepol` | `1`, `class`, `blp` (alias `living`), `collapsed`, `listas`, `vital` |
| `shell.aliases` | Additional names of the shell, excluded from project search. Redirect aliases are also fetched from the wiki. | `[]` | `[]` |
| `shell.biographyBannerNames` / `shell.biographyParameters` | Optional biography banner names and supported `{ source, target, normalise }` parameter mappings. Mappings never inject a field absent from the shell schema. | Disabled | Biography mappings for `blp` and `listas` |
| `editSummaryLanguage` | Language of the edit summary, independent of the user's interface language. | `"ru"` | `"en"` |
| `defaultParameterData` | Banner metadata used when TemplateData is unavailable. Configure only fields supported on the wiki; `suggested` and `autovalue` can add fields automatically. Shells use their own schema. | `уровень`, `важность`; no automatic extra fields | English project parameter defaults |

For example, the Russian policy can be explicitly configured before importing the global loader:

```javascript
window.RATER_CONFIG = {
	shell: {
		autoCreate: false,
		minProjects: null,
		classLocation: 'banners',
		classParamName: 'уровень'
	},
	classFormat: 'arabic',
	classDisplayFormat: 'roman',
	editSummaryLanguage: 'ru'
};
```

To automatically group three or more projects, use `autoCreate: false, minProjects: 3`. Existing shells are retained even when automatic creation is disabled, unless removed explicitly in the editor. Changing the class preserves each banner's importance, including values absent from its current TemplateData suggestions. Conflicting individual classes require an explicit shared choice before moving them into a shell.

The **Wrap projects** button wraps the current projects using the configured shell template; the shell and its aliases are excluded from the project search. Under preferences, **Automatically wrap projects** offers the wiki default, never, always, from two projects, or from three projects. This is stored as `shellCreation: "wiki" | "never" | "always" | "2" | "3"` in the local wiki's user preferences. "Never" disables automatic creation; manual wrapping and existing shells remain available.

For another language, replace `shell.parameters` with that template's supported fields, for example:

```javascript
window.RATER_CONFIG = {
	shellTemplate: 'Local project wrapper',
	shell: {
		autoCreate: false,
		classLocation: 'shell',
		classParamName: 'quality',
		parameters: [
			{ name: '1' },
			{ name: 'quality' },
			{ name: 'title', label: { en: 'Heading' } }
		],
		biographyBannerNames: [],
		biographyParameters: []
	}
};
```

Shell metadata comes from this configuration, including when TemplateData is missing or its cached fallback contains generic project fields. Required/suggested shell parameters are added only if defined in its schema. Existing unknown parameters are retained so changing assessments does not silently remove them.

Ordinary banners without TemplateData use `defaultParameterData`. On Russian Wikipedia this supplies the local assessment fields without injecting `needs-image` or `needs-infobox`. Previously cached fallback metadata is ignored, so a corrected wiki configuration takes effect immediately; real TemplateData remains cached. Removing a shell makes the manual wrapping button available again while projects remain, and removing all projects disables it.

## Testing a patch and publishing

1. Run `npm ci`, `npm run test:ooui`, and `npm run build:dev`.
2. Copy `dist/rater-core.js` to a sandbox JavaScript page you control on MediaWiki.org (for example, `User:YOUR_USERNAME/rater-core-test.js`).
3. Copy `dist/rater.js` to your sandbox loader page. Change its `title` constant to the sandbox core page, retaining the MediaWiki.org host.
4. Import that sandbox loader from your local wiki's common.js and check loading, preview, diff, save, and closing the dialog. Use a test talk page or a sandbox.

Testwiki's upstream examples include WikiProject Africa, Belgium, and China. Additional templates must be imported, included in the configured banner categories, and supplied with working dependencies and TemplateData.

For publication, run `npm run build:prod`, copy `dist/rater-core.js` to `User:Iniquity/rater-core.js` on MediaWiki.org, then copy `dist/rater.js` to `User:Iniquity/rater.js`. Publishing requires edit access to those pages. The global build uses `rater-core.js`; the upstream `rater.min.js` deployment instructions refer to its older build system.

The inherited [application diagram](architecture_main.svg) and [OOUI diagram](architecture_ooui.svg) describe upstream Rater v2. The current fork's modules are listed below; its loading dialog uses Vue/Codex.

The regression suite uses real jQuery and OOUI to check dialog actions, assessment policies, TemplateData caching, and wikitext edits. `npm run test:regression` checks the current OOUI version; `npm run test:ooui` repeats it against 0.53.0, 0.53.2 and 0.54.2. See the [2025–2026 DOM compatibility review](docs/dom-compatibility-2026.md) for platform changes, fixes and coverage limits. The older `npm run test:run` suite also remains available; it had 23 failing files before this synchronization, mostly importing the removed `src/utils/Template.js` and using incomplete widget mocks.

## 🏗️ Project Structure

The project uses a modern, scalable architecture with clear separation of concerns:

### 📁 Directory Organization

```
├── index.js             # Main loader script before formatting (userscript entry point)
├── src/                 # Source code directory
│   ├── components/          # UI Components
│   │   ├── MainWindow.js           # Main application window
│   │   ├── LoadDialog.js           # Loading dialog
│   │   ├── BannerListWidget.js     # Banner list widget
│   │   ├── BannerWidget.js         # Individual banner widget
│   │   ├── DropdownParameterWidget.js
│   │   ├── HorizontalLayoutWidget.js
│   │   ├── ParameterListWidget.js
│   │   ├── ParameterWidget.js
│   │   ├── PrefsFormWidget.js      # Preferences form
│   │   ├── SuggestionLookupTextInputWidget.js
│   │   └── TopBarWidget.js         # Top navigation bar
│   ├── services/           # Business Logic & Services
│   │   ├── api.js                  # API communication
│   │   ├── cache.js                # Caching service
│   │   ├── windowManager.js        # Window management
│   │   ├── i18n.js                 # Internationalization
│   │   ├── collectBannersFromCategory.js # Banner retrieval
│   │   ├── setup.js                # Application setup
│   │   ├── autostart.js            # Auto-start logic
│   │   ├── prefs.js                # Preferences management
│   │   └── index.js                # Barrel exports (used in App.js)
│   ├── utils/              # Utility Functions
│   │   ├── parseTemplates.js       # Template parsing
│   │   ├── models/TemplateModel.js # Template data model
│   │   └── util.js                 # General utilities
│   ├── constants/          # Configuration & Constants
│   │   ├── config.js               # Application configuration
│   │   └── index.js                # Barrel exports (used in App.js)
│   ├── styles/             # CSS Styles
│   │   └── styles.css              # Main stylesheet
│   ├── types/              # TypeScript Types (future)
│   └── App.js              # Main application entry point
├── dist/                 # Build output
└── i18n/                 # Internationalization
```

### 🎯 Design Principles

#### 1. **Separation of Concerns**
- **Components**: Pure UI components with minimal business logic
- **Services**: Business logic, API calls, data management
- **Utils**: Pure utility functions without side effects
- **Constants**: Configuration and constants

#### 2. **Modern ES Modules**
- All files use ES2017+ syntax
- Explicit file extensions in imports
- Tree-shakable exports

#### 3. **Vite Aliases**
```javascript
// Instead of relative paths
import config from '../../constants/config.js';

// Use aliases
import config from '@constants/config.js';
```

#### 4. **Direct Imports**
Use direct imports for better tree-shaking and clarity:
```javascript
import API from '@services/api.js';
import windowManager from '@services/windowManager.js';
import MainWindow from '@components/MainWindow.js';
```

### 📦 Build Output

The source code is bundled, transpiled, and minified using `npm run build`. This creates:

- **`dist/rater.js`** - Main entry point, loader script
  - Creates a portlet button that lazy-loads the main application on demand
  - Only loads `mediawiki.util` at startup; other modules are loaded when the button is clicked
- **`dist/rater-core.js`** - Main application bundle

### 🔧 Tooling
- **eslint** (v9) with flat config for ES2017 linting
- **stylelint** for CSS linting
- **vite** for bundling, transpiling, minification, and file concatenation

## TODO

### 🚀 Future Features
- [ ] **Portlet customization**: Allow users to choose portlet location and appearance
- [ ] **Smart autostart**: Auto-start for specific talkpage categories or subject-page patterns
- [ ] **Banner management**: Allow users to reorder banners and customize their display
- [ ] **Enhanced preferences**: More granular control over autostart behavior and UI settings
- [ ] **Keyboard shortcuts**: Add keyboard navigation for power users
- [ ] **Bulk operations**: Select and modify multiple banners at once

### 🧪 Testing & Quality
- [ ] **Unit testing**: Implement comprehensive test suite
  - [ ] Test components in isolation using jsdom/mock MediaWiki globals
  - [ ] Test services with mocked API responses
  - [ ] Add integration tests for critical user flows
- [ ] **E2E testing**: Add end-to-end tests for complete user workflows
- [ ] **Performance testing**: Monitor and optimize bundle size and runtime performance
- [ ] **Accessibility testing**: Ensure WCAG compliance for screen readers and keyboard navigation

### 📚 Documentation & Developer Experience
- [ ] **API documentation**: Complete JSDoc comments for all public APIs
- [ ] **Component documentation**: Storybook or similar for UI components
- [ ] **Developer guide**: Comprehensive setup and contribution guidelines
- [ ] **User guide**: Enhanced documentation with screenshots and examples
- [ ] **Migration guide**: Help users transition from old versions

### 🔧 Technical Improvements
- [ ] **TypeScript migration**: Add type safety and better IDE support
- [ ] **Performance optimization**: Implement lazy loading for large components
- [ ] **Bundle optimization**: Further reduce bundle size with tree-shaking
- [ ] **Error handling**: Improve error reporting and user feedback
- [ ] **Internationalization**: Expand language support beyond English
- [ ] **Modern APIs**: Migrate to newer MediaWiki APIs where available

### 🐛 Maintenance
- [ ] **Dependency updates**: Keep all dependencies current and secure
- [ ] **Code cleanup**: Remove deprecated code and improve consistency
- [ ] **Performance monitoring**: Add metrics and monitoring for production usage
- [ ] **Issue tracking**: Set up proper issue templates and contribution guidelines
