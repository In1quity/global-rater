// Test setup for Rater
import { JSDOM } from 'jsdom';

// Mock MediaWiki environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <div id="content"></div>
</body>
</html>
`, {
    url: 'https://ru.wikipedia.org/wiki/Test',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;

// Mock jQuery
const mockJQuery = (selector) => {
    const element = {
        find: () => ({ before: () => element, css: () => element, first: () => ({ css: () => element }) }),
        children: () => mockJQuery(),
        parent: () => mockJQuery(),
        first: () => mockJQuery(),
        css: () => element,
        attr: () => element,
        append: () => element,
        prepend: () => element,
        addClass: () => element,
        removeClass: () => element,
        toggleClass: () => element,
        off: () => element,
        on: () => element,
        keydown: () => element,
        scrollTop: () => 0,
        height: () => 100,
        outerHeight: () => 100,
        empty: () => element,
        text: () => '',
        html: () => '',
        length: 0
    };
    return element;
};

global.$ = Object.assign(mockJQuery, {
    Deferred: () => {
        const deferred = {
            resolve: (value) => {
                deferred._resolved = true;
                deferred._value = value;
                if (deferred._then) deferred._then(value);
                return deferred;
            },
            reject: (error) => {
                deferred._rejected = true;
                deferred._error = error;
                if (deferred._catch) deferred._catch(error);
                return deferred;
            },
            then: (callback) => {
                deferred._then = callback;
                if (deferred._resolved) callback(deferred._value);
                return deferred;
            },
            catch: (callback) => {
                deferred._catch = callback;
                if (deferred._rejected) callback(deferred._error);
                return deferred;
            },
            promise: () => deferred
        };
        return deferred;
    },
    when: (...args) => global.$.Deferred().resolve(...args).promise(),
    extend: Object.assign,
    map: (obj, fn) => Object.keys(obj).map(key => fn(obj[key], key)),
    each: (obj, fn) => Object.keys(obj).forEach(key => fn(obj[key], key))
});

// Mock MediaWiki globals
global.mw = {
    config: {
        get: (keys) => {
            const configs = {
                skin: 'vector',
                wgPageName: 'Test',
                wgNamespaceNumber: 0,
                wgUserName: 'TestUser',
                wgFormattedNamespaces: { 10: 'Шаблон' },
                wgMonthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                wgRevisionId: 12345,
                wgScriptPath: '/w',
                wgServer: 'https://ru.wikipedia.org',
                wgCategories: [],
                wgIsMainPage: false
            };
            return Array.isArray(keys) ? keys.reduce((acc, key) => ({ ...acc, [key]: configs[key] }), {}) : configs[keys];
        }
    },
    util: {
        getUrl: (title) => `https://ru.wikipedia.org/wiki/${title}`
    },
    html: {
        escape: (text) => text.replace(/[<>&"']/g, (char) => {
            const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
            return entities[char];
        })
    },
    Title: {
        newFromText: (text) => ({
            getPrefixedText: () => text,
            getMainText: () => text.replace(/^(Template|Шаблон):/, ''),
            getNamespacePrefix: () => text.includes(':') ? text.split(':')[0] + ':' : '',
            getSubjectPage: () => ({ getPrefixedText: () => 'Test' }),
            getTalkPage: () => ({ getPrefixedText: () => 'Talk:Test' }),
            isTalkPage: () => text.startsWith('Talk:')
        })
    }
};

// Mock mw.Api
global.mw.Api = function() {
    return {
        get: (params) => {
            if (params.action === 'query' && params.prop === 'revisions') {
                return global.$.Deferred().resolve({
                    query: {
                        pageids: [1],
                        pages: {
                            1: {
                                revisions: [{
                                    '*': '{{Блок проектов статьи|1={{Статья проекта Права человека}} {{Статья проекта Социология}} {{Статья проекта Феминизм|важность=высокая|уровень=1}}}}'
                                }]
                            }
                        }
                    }
                }).promise();
            }
            if (params.action === 'query' && params.redirects === 1) {
                const titles = Array.isArray(params.titles) ? params.titles : (typeof params.titles === 'string' ? params.titles.split('|') : []);
                const pages = {};
                const normalized = [];
                titles.forEach((title, index) => {
                    const pageId = 2203018 + index;
                    pages[`${pageId}`] = {
                        pageid: pageId,
                        ns: 10,
                        title: title
                    };
                    normalized.push({ from: title, to: title });
                });
                return global.$.Deferred().resolve({
                    batchcomplete: '',
                    query: { normalized, pages }
                }).promise();
            }
            return global.$.Deferred().resolve({ query: { pages: {} } }).promise();
        },
        post: (params) => {
            if (params.action === 'parse') {
                return global.$.Deferred().resolve({
                    parse: {
                        text: {
                            '*': '<div>Parsed content</div>'
                        }
                    }
                }).promise();
            }
            return global.$.Deferred().resolve({}).promise();
        }
    };
};

// Mock API responses
global.API = {
    get: (params) => {
        // Provide banner lists matching the test names so templateScanner can include them
        if (params.action === 'query' && params.list === 'categorymembers') {
            // Not used by this test path; return empty
            return global.$.Deferred().resolve({ query: { categorymembers: [] } }).promise();
        }
        if (params.action === 'query' && params.prop === 'revisions') {
            return global.$.Deferred().resolve({
                query: {
                    pageids: [1],
                    pages: {
                        1: {
                            revisions: [{
                                '*': '{{Блок проектов статьи|1={{Статья проекта Права человека}} {{Статья проекта Социология}} {{Статья проекта Феминизм|важность=высокая|уровень=1}}}}'
                            }]
                        }
                    }
                }
            }).promise();
        }
        if (params.action === 'query' && params.redirects === 1) {
            // Mock redirects query - return proper API response structure
            // Handle any titles passed to the API
            const titles = params.titles || [];
            const pages = {};
            const normalized = [];
            
            titles.forEach((title, index) => {
                const pageId = 2203018 + index;
                pages[`${pageId}`] = {
                    pageid: pageId,
                    ns: 10,
                    title: title
                };
                
                // Add normalized entry for each title
                normalized.push({
                    from: title,
                    to: title
                });
            });
            
            return global.$.Deferred().resolve({
                batchcomplete: "",
                query: {
                    normalized: normalized,
                    pages: pages
                }
            }).promise();
        }
        // For other queries, return empty result
        return global.$.Deferred().resolve({
            query: {
                pages: {}
            }
        }).promise();
    },
    post: (params) => {
        if (params.action === 'parse') {
            return global.$.Deferred().resolve({
                parse: {
                    text: {
                        '*': '<div>Parsed content</div>'
                    }
                }
            }).promise();
        }
        return global.$.Deferred().resolve({}).promise();
    }
};

// Mock OO.ui
global.OO = {
    ui: {
        Widget: function() {},
        ProcessDialog: function() {},
        ButtonWidget: function(opts) { this.$element = opts && opts.$element ? opts.$element : global.$('<div>'); this.setLabel = () => this; this.connect = () => this; this.setDisabled = () => this; },
        LabelWidget: function() {},
        HtmlSnippet: function(html) { this.html = html; },
        FieldLayout: function() { this.$element = global.$('<div>'); this.toggle = () => this; },
        PanelLayout: function() {},
        StackLayout: function() { this.addItems = () => this; this.$element = global.$('<div>'); },
        HorizontalLayout: function() { this.addItems = () => this; this.$element = global.$('<div>'); },
        FieldsetLayout: function() {},
        ButtonGroupWidget: function(opts) { this.$element = (opts && opts.$element) || global.$('<div>'); },
        PopupButtonWidget: function(opts) { this.$element = (opts && opts.$element) || global.$('<div>'); this.getPopup = () => ({ toggle: () => {} }); },
        DropdownWidget: function(opts) { this.menu = { findSelectedItem: () => ({ getData: () => null }), connect: () => {} }; this.$element = (opts && opts.$element) || global.$('<div>'); this.connect = () => this; },
        IconWidget: function(opts) { this.$element = (opts && opts.$element) || global.$('<span>'); this.toggle = () => this; },
        MenuOptionWidget: function() {},
        ButtonSelectWidget: function() { this.getMenu = () => ({ getItems: () => [], findSelectedItem: () => null, selectItemByData: () => {} }); this.$element = global.$('<div>'); },
        NamespacesMultiselectWidget: function() {},
        SuggestionLookupTextInputWidget: function() {},
        TextInputWidget: function() { this.$element = global.$('<input>'); this.getValue = () => ''; this.setValue = () => this; this.connect = () => this; },
        ComboBoxInputWidget: function() { this.$element = global.$('<input>'); this.getValue = () => ''; this.setValue = () => this; this.connect = () => this; },
        confirm: (message) => global.$.Deferred().resolve(true).promise(),
        alert: (message) => global.$.Deferred().resolve().promise(),
        Error: function(message) { this.message = message; },
        mixin: {}
    },
    inheritClass: (child, parent) => {
        child.super = parent;
        child.parent = parent;
        if (parent && parent.prototype) {
            child.prototype = Object.create(parent.prototype);
            child.prototype.constructor = child;
        }
    },
    mixinClass: (target, mixin) => {
        if (target && target.prototype && mixin && mixin.prototype) {
            Object.assign(target.prototype, mixin.prototype);
        }
    }
};

// Methods for DropdownWidget
if (!global.OO.ui.DropdownWidget.prototype) {
    global.OO.ui.DropdownWidget.prototype = {};
}
global.OO.ui.DropdownWidget.prototype.getMenu = function() {
    return {
        findSelectedItem: () => ({ getData: () => null }),
        selectItemByData: () => {},
        getItems: () => []
    };
};
global.OO.ui.DropdownWidget.prototype.toggle = function() { return this; };

// Implement GroupElement mixin used by ParameterListWidget
global.OO.ui.mixin = global.OO.ui.mixin || {};
global.OO.ui.mixin.GroupElement = function( cfg ) {
    this.items = [];
    this.$group = ( cfg && cfg.$group ) || global.$('<div>');
};
global.OO.ui.mixin.GroupElement.prototype = {
    addItems: function( items ) { this.items = this.items.concat( items || [] ); return this; },
    clearItems: function() { this.items = []; return this; },
    findItemFromData: function() { return null; },
    findItemsFromData: function() { return []; },
    removeItems: function( items ) { this.items = this.items.filter( ( it ) => items.indexOf( it ) === -1 ); return this; }
};

// Implement LookupElement mixin used by SuggestionLookupTextInputWidget
global.OO.ui.mixin.LookupElement = function( cfg ) {
    this.lookupCache = {};
    this.lookupMenu = null;
};
global.OO.ui.mixin.LookupElement.prototype = {
    getLookupRequest: function() { return global.$.Deferred().resolve([]).promise(); },
    getLookupCacheDataFromResponse: function( response ) { return response || []; },
    getLookupMenuOptionsFromData: function( data ) { return []; },
    setSuggestions: function() { return this; }
};

// Add static properties to classes
global.OO.ui.ProcessDialog.static = {};
global.OO.ui.ButtonWidget.static = {};
global.OO.ui.LabelWidget.static = {};
global.OO.ui.FieldLayout.static = {};
global.OO.ui.PanelLayout.static = {};
global.OO.ui.StackLayout.static = {};
global.OO.ui.HorizontalLayout.static = {};
global.OO.ui.FieldsetLayout.static = {};
global.OO.ui.ButtonGroupWidget.static = {};
global.OO.ui.PopupButtonWidget.static = {};
global.OO.ui.MenuOptionWidget.static = {};
global.OO.ui.ButtonSelectWidget.static = {};
global.OO.ui.NamespacesMultiselectWidget.static = {};
global.OO.ui.SuggestionLookupTextInputWidget.static = {};

// Mock MainWindow class to have static properties
global.MainWindow = function() {};
global.MainWindow.static = {};
global.MainWindow.prototype = {};

// Add methods to OO.ui.Widget
global.OO.ui.Widget.prototype = {
    $element: global.$('<div>'),
    $overlay: global.$('<div>'),
    $head: global.$('<div>'),
    $body: global.$('<div>'),
    $foot: global.$('<div>'),
    connect: function() {},
    aggregate: function() {},
    emit: function() {},
    toggle: function() { return this; },
    setLabel: function() { return this; },
    setValue: function() { return this; },
    getValue: function() { return ''; },
    focus: function() { return this; },
    setDisabled: function() { return this; },
    isDisabled: function() { return false; },
    addItems: function() { return this; },
    removeItems: function() { return this; },
    clearItems: function() { return this; },
    getItems: function() { return []; },
    getCurrentItem: function() { return null; },
    setItem: function() { return this; },
    addItems: function() { return this; },
    find: function() { return global.$(); },
    css: function() { return this; },
    attr: function() { return this; },
    append: function() { return this; },
    prepend: function() { return this; },
    children: function() { return global.$(); },
    parent: function() { return global.$(); },
    off: function() { return this; },
    on: function() { return this; },
    keydown: function() { return this; },
    scrollTop: function() { return 0; },
    height: function() { return 100; },
    outerHeight: function() { return 100; },
    empty: function() { return this; },
    text: function() { return ''; },
    html: function() { return ''; }
};

// Mock console for tests
global.console = {
    log: () => {},
    warn: () => {},
    error: () => {}
};
