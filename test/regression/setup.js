import $ from 'jquery';
import OO from 'oojs';
import { vi } from 'vitest';
import { readJsonDirectory } from '../../scripts/localization-data.js';

globalThis.$ = window.$ = window.jQuery = $;
globalThis.OO = window.OO = OO;
const oouiPackage = process.env.RATER_TEST_OOUI || 'oojs-ui';
if (!['oojs-ui', 'oojs-ui-legacy', 'oojs-ui-stable'].includes(oouiPackage)) {
	throw new Error('Unknown OOUI test package: ' + oouiPackage);
}
await import(oouiPackage);
await import(oouiPackage + '/dist/oojs-ui-wikimediaui.js');

const settings = {
	wgDBname: 'ruwiki', wgServer: 'https://ru.wikipedia.org', wgUserLanguage: 'en',
	wgPageName: 'Вредные_советы', wgNamespaceNumber: 0, wgUserName: 'TestUser',
	wgFormattedNamespaces: { 0: '', 1: 'Обсуждение', 10: 'Шаблон' },
	wgRevisionId: 1, skin: 'vector', wgCategories: [], wgScriptPath: '/w'
};
globalThis.mw = {
	config: { get: (key) => Array.isArray(key) ? Object.fromEntries(key.map((k) => [k, settings[k]])) : settings[key] },
	util: { getUrl: (title) => '/wiki/' + title },
	html: { escape: (text) => $('<span>').text(text).html() },
	Title: { newFromText: (name) => ({
		getPrefixedText: () => name,
		getMainText: () => name.replace(/^(Template|Шаблон):/i, ''),
		getNamespacePrefix: () => 'Шаблон:',
		getSubjectPage: () => ({ getMainText: () => name, getPrefixedText: () => name })
	}) },
	Api: function () {
		this.defaults = { ajax: { headers: {} } };
		this.get = vi.fn();
		this.post = vi.fn();
	},
	notify: vi.fn(),
	widgets: { NamespacesMultiselectWidget: OO.ui.MenuTagMultiselectWidget }
};
window.mw = globalThis.mw;
globalThis.RATER_I18N_DICTIONARIES = readJsonDirectory('i18n');
globalThis.RATER_WIKI_CONFIGS = readJsonDirectory('rater/data');

OO.ui.isMobile = () => false;
OO.ui.theme = new OO.ui.WikimediaUITheme();
