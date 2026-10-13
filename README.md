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

## Testing a patch and publishing

1. Run `npm ci`, `npm run test:run`, and `npm run build:dev`.
2. Copy `dist/rater-core.js` to a sandbox JavaScript page you control on MediaWiki.org (for example, `User:YOUR_USERNAME/rater-core-test.js`).
3. Copy `dist/rater.js` to your sandbox loader page. Change its `title` constant to the sandbox core page, retaining the MediaWiki.org host.
4. Import that sandbox loader from your local wiki's common.js and check loading, preview, diff, save, and closing the dialog. Use a test talk page or a sandbox.

Testwiki's upstream examples include WikiProject Africa, Belgium, and China. Additional templates must be imported, included in the configured banner categories, and supplied with working dependencies and TemplateData.

For publication, run `npm run build:prod`, copy `dist/rater-core.js` to `User:Iniquity/rater-core.js` on MediaWiki.org, then copy `dist/rater.js` to `User:Iniquity/rater.js`. Publishing requires edit access to those pages. The global build uses `rater-core.js`; the upstream `rater.min.js` deployment instructions refer to its older build system.

The inherited [application diagram](architecture_main.svg) and [OOUI diagram](architecture_ooui.svg) describe upstream Rater v2. The current fork's modules are listed below; its loading dialog uses Vue/Codex.

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
│   │   ├── getBanners.js           # Banner retrieval
│   │   ├── setup.js                # Application setup
│   │   ├── autostart.js            # Auto-start logic
│   │   ├── prefs.js                # Preferences management
│   │   └── index.js                # Barrel exports (used in App.js)
│   ├── utils/              # Utility Functions
│   │   ├── Template.js             # Template utilities
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

- **`dist/rater.js`** - Main entry point, loader script (2.72 kB)
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
