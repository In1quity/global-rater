import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import config, { loadExternalConfig } from '../../src/constants/config.js';
import { buildBannerSuggestions } from '../../src/services/autofill.js';
import { isShellTemplate } from '../../src/services/templateShell.js';
import { loadParamDataAndSuggestions } from '../../src/services/templateParams.js';
import { findBannerTemplatesOnTalk } from '../../src/services/templateScanner.js';
import { shouldCreateShell, displayClassRating } from '../../src/services/shellPolicy.js';
import { parseTemplates } from '../../src/utils/parseTemplates.js';
import API from '../../src/services/api.js';
import BannerWidget from '../../src/components/BannerWidget.js';
import BannerListWidget from '../../src/components/BannerListWidget.js';
import TopBarWidget from '../../src/components/TopBarWidget.js';
import PrefsFormWidget from '../../src/components/PrefsFormWidget.js';
import MainWindow from '../../src/components/MainWindow.js';

const initial = JSON.parse(JSON.stringify(config));
const prefs = { ...initial.defaultPrefs, shellCreation: 'never', autofillClassFromOthers: false, autofillClassFromOres: false, autofillImportance: false };
function template(text = '{{Статья проекта История|уровень=II|важность=высшая}}') {
	const result = parseTemplates(text, false)[0];
	result.paramData = {};
	result.classParamName = 'уровень';
	result.importanceParamName = 'важность';
	result.classes = ['I', 'II', 'III', 'IV'];
	result.importances = ['высшая', 'высокая', 'средняя', 'низкая'];
	return result;
}
function list(count = 1, preferences = prefs) {
	const result = new BannerListWidget({ preferences });
	result.pageInfo = { isArticle: true };
	result.addItems(Array.from({length: count}, (_, index) => new BannerWidget(template('{{Статья проекта Тест ' + index + '|уровень=II|важность=высшая}}'), { preferences, isArticle: true })));
	return result;
}
beforeEach(() => {
	Object.assign(config, JSON.parse(JSON.stringify(initial)));
	localStorage.clear();
	API.get.mockReset().mockImplementation(() => $.Deferred().resolve({ query: { pages: {} } }).promise());
});
afterEach(() => {
	vi.restoreAllMocks();
	Object.assign(config, JSON.parse(JSON.stringify(initial)));
	delete window.RATER_CONFIG;
});

it('excludes the shell and its aliases from every suggestion group', () => {
	config.shell.aliases = ['Блок статьи проектов'];
	const groups = {};
	for (const key of ['withRatings', 'withoutRatings', 'wrappers', 'notWPBM', 'inactive', 'wir']) {
		groups[key] = ['Шаблон:Блок проектов статьи', 'Блок статьи проектов', 'Статья проекта История'];
	}
	const choices = buildBannerSuggestions(groups);
	expect(choices).toHaveLength(6);
	expect(choices.every((choice) => choice.data.name === 'Статья проекта История')).toBe(true);
});

it('routes a typed shell name to wrapping without adding a project prefix', async () => {
	const box = { pushPending: vi.fn(), popPending: vi.fn().mockReturnThis(), setValue: vi.fn() };
	const wrap = vi.fn().mockResolvedValue();
	await MainWindow.prototype.onSearchSelect.call({ topBar: { searchBox: box }, onWrapProjects: wrap }, { name: 'Шаблон:Блок проектов статьи' });
	expect(wrap).toHaveBeenCalledOnce();
});

it.each(['wiki', 'never', 'always', '2', '3'])('round-trips shell preference %s with real OOUI widgets', (choice) => {
	const form = new PrefsFormWidget();
	form.setPrefValues({ ...prefs, shellCreation: choice });
	expect(form.preferences.shellCreation.input.getValue()).toBe(choice);
	expect(form.getPrefs().shellCreation).toBe(choice);
});

it('uses the wiki preference when old preference JSON has no shell setting', () => {
	const form = new PrefsFormWidget();
	form.setPrefValues({ watchlist: 'watch' });
	expect(form.getPrefs().shellCreation).toBe('wiki');
});

it('applies never, always and threshold policies independently of wiki defaults', () => {
	config.shell.autoCreate = true;
	expect(shouldCreateShell(3, { shellCreation: 'never' })).toBe(false);
	expect(shouldCreateShell(1, { shellCreation: 'always' })).toBe(true);
	expect(shouldCreateShell(0, { shellCreation: 'always' })).toBe(false);
	expect(shouldCreateShell(1, { shellCreation: '2' })).toBe(false);
	expect(shouldCreateShell(2, { shellCreation: '2' })).toBe(true);
	expect(shouldCreateShell(2, { shellCreation: '3' })).toBe(false);
	expect(shouldCreateShell(3, { shellCreation: '3' })).toBe(true);
	expect(shouldCreateShell(1, { shellCreation: 'wiki' })).toBe(true);
});

it('manually wraps Russian projects while preserving local assessments and importance', async () => {
	const banners = list(2);
	banners.addShellTemplateIfNeeeded(true);
	await banners.shellCreationPromise;
	const shell = banners.items.find((item) => item.isShellTemplate);
	expect(shell.name).toBe('Блок проектов статьи');
	expect(shell.parameterList.getParameterItems()).toHaveLength(0);
	expect(shell.classDropdown.isVisible()).toBe(false);
	const text = banners.makeWikitext();
	expect(text).not.toMatch(/needs-(?:image|infobox)/);
	expect(text.match(/уровень=2/g)).toHaveLength(2);
	expect(text.match(/важность=высшая/g)).toHaveLength(2);
	expect(text).not.toContain('Статья проекта Блок');
});

it('allows supported shell aliases, rejects new unsupported fields and preserves existing ones', async () => {
	const model = template('{{Блок проектов статьи|legacy-field=Keep this|}}');
	await loadParamDataAndSuggestions(model);
	const shell = new BannerWidget(model, { preferences: prefs });
	expect(shell.getAddParametersInfo('needs-infobox', 'yes').validName).toBe(false);
	expect(shell.getAddParametersInfo('living', 'yes').name).toBe('blp');
	expect(shell.getAddParametersInfo('living', 'yes').validName).toBe(true);
	expect(shell.makeWikitext()).toContain('legacy-field=Keep this');
});

it('automatically creates the English shell and writes a shared native class', async () => {
	const getConfig = mw.config.get;
	vi.spyOn(mw.config, 'get').mockImplementation((key) => key === 'wgDBname' ? 'enwiki' : getConfig(key));
	const english = (await import('../../src/constants/config.js?english-defaults')).default;
	expect(english.shell.autoCreate).toBe(true);
	expect(english.classDisplayFormat).toBe('native');
	Object.assign(config, english);
	const preferences = { ...english.defaultPrefs, autofillClassFromOthers: false, autofillClassFromOres: false, autofillImportance: false };
	const project = parseTemplates('{{WikiProject History|class=B|importance=High}}', false)[0];
	Object.assign(project, { paramData: {}, classParamName: 'class', importanceParamName: 'importance', classes: ['B', 'C', 'Start', 'Stub'], importances: ['High', 'Low'] });
	const banners = new BannerListWidget({preferences});
	banners.pageInfo = {isArticle: true};
	banners.addItems([new BannerWidget(project, {preferences})]);
	await banners.shellCreationPromise;
	const parsed = parseTemplates(banners.makeWikitext(), true);
	expect(parsed[0].name).toBe('WikiProject banner shell');
	expect(parsed[0].getParam('class').value).toBe('B');
	expect(parsed[1].getParam('class')).toBeUndefined();
	expect(parsed[1].getParam('importance').value).toBe('High');
	expect(banners.items[0].parameterSuggestions.map((item) => item.data)).toEqual(['blp', 'collapsed', 'listas', 'vital']);
	const summary = MainWindow.prototype.makeEditSummary.call({bannerList: banners, existingBannerNames: ['WikiProject History']});
	expect(summary).toContain('Assessment (class B)');
});

it('creates exactly one shell at a user threshold and blocks save while it loads', async () => {
	const banners = list(1, { ...prefs, shellCreation: '2' });
	expect(banners.shellCreationPromise).toBeUndefined();
	banners.addItems([new BannerWidget(template(), { preferences: prefs })]);
	const pending = banners.shellCreationPromise;
	banners.addShellTemplateIfNeeeded();
	expect(banners.shellCreationPromise).toBe(pending);
	expect(() => banners.makeWikitext()).toThrow('not ready');
	await pending;
	expect(banners.items.filter((item) => item.isShellTemplate)).toHaveLength(1);
});

it('does not substitute a shell discovered in the generic wrapper category', async () => {
	const result = await findBannerTemplatesOnTalk({
		wikitext: '{{Блок проектов статьи|{{Статья проекта История|уровень=2}}}}',
		allBanners: { wrappers: ['Блок проектов статьи'], withRatings: ['Статья проекта История'] },
		shellTemplate: config.shellTemplate, bannerNamePrefixes: config.bannerNamePrefixes
	});
	const shell = result.find(isShellTemplate);
	expect(shell).toBeDefined();
	expect(shell.redirectTarget).toBeUndefined();
});

it('replaces shell schemas per wiki and does not inherit Russian or English fields', async () => {
	window.RATER_CONFIG = { shellTemplate: 'Local Wrapper', shell: { parameters: [{name: '1'}, {name: 'status', aliases: ['state']}], classParamName: 'status' } };
	await loadExternalConfig();
	const local = template('{{Local Wrapper|header=Existing value|}}');
	await loadParamDataAndSuggestions(local);
	expect(Object.keys(local.paramData)).toEqual(['1', 'status']);
	expect(local.paramAliases).toEqual({ state: 'status' });
	expect(local.getParam('header').value).toBe('Existing value');
	expect(API.get).not.toHaveBeenCalled();
});

it('shows Roman grades in both menus and saves Arabic grades', () => {
	const project = new BannerWidget(template(), { preferences: prefs });
	expect(project.classDropdown.getMenu().findItemFromData('2').getLabel()).toBe('II');
	expect(project.makeWikitext()).toContain('уровень=2');
	const top = new TopBarWidget();
	const classChoice = top.setAllDropDown.getMenu().getItems().find((item) => item.getData()?.class === '2');
	expect(classChoice.getLabel()).toBe('II');
	expect(displayClassRating('4')).toBe('IV');
	expect(displayClassRating('FA')).toBe('FA');
});

it('generates a Russian edit summary on ruwiki even with an English interface', () => {
	const banners = list(1);
	MainWindow.prototype.onSetClasses.call({bannerList: banners}, 'III');
	MainWindow.prototype.onSetImportances.call({bannerList: banners}, 'средняя');
	const summary = MainWindow.prototype.makeEditSummary.call({bannerList: banners, existingBannerNames: banners.items.map((item) => item.name)});
	expect(summary).toContain('Оценка (уровень 3; важность средняя)');
	expect(summary).toContain('Рейтер');
	expect(summary).not.toContain('Assessment');
	expect(summary).not.toContain('Статья проекта');
});

it('exposes a wrap button whose availability survives preview disabling', () => {
	const top = new TopBarWidget();
	top.setShellAvailable(true);
	const receiver = { wrap: vi.fn() };
	top.connect(receiver, { wrapProjects: 'wrap' });
	top.wrapShellButton.$button.trigger($.Event('click', { which: 1 }));
	expect(receiver.wrap).toHaveBeenCalledOnce();
	top.setDisabled(true);
	expect(top.wrapShellButton.isDisabled()).toBe(true);
	top.setDisabled(false);
	expect(top.wrapShellButton.isDisabled()).toBe(false);
	top.setShellAvailable(false);
	top.setDisabled(false);
	expect(top.wrapShellButton.isDisabled()).toBe(true);
});

it('opens the editor with an automatically created shell ready for serialization', async () => {
	const manager = new OO.ui.WindowManager();
	for (const method of ['getSetupDelay', 'getReadyDelay', 'getHoldDelay', 'getTeardownDelay']) {
		vi.spyOn(manager, method).mockReturnValue(0);
	}
	const dialog = new MainWindow();
	manager.addWindows([dialog]);
	document.body.appendChild(manager.$element[0]);
	const page = {getNamespacePrefix: () => '', getPrefixedText: () => 'Example'};
	const lifecycle = manager.openWindow(dialog, {
		preferences: {...prefs, shellCreation: 'always'},
		banners: [template()], bannerNames: {}, isArticle: true,
		subjectPage: page, talkpage: page, talkWikitext: '{{Статья проекта История|уровень=II|важность=высшая}}'
	});
	await lifecycle.opened;
	expect(dialog.bannerList.items.some((item) => item.isShellTemplate)).toBe(true);
	expect(dialog.topBar.wrapShellButton.isDisabled()).toBe(true);
	expect(dialog.bannerList.makeWikitext()).toContain('{{Блок проектов статьи');
	await manager.closeWindow(dialog).closed;
	await manager.destroy();
	await new Promise((resolve) => setTimeout(resolve, 350));
});

it('gives the project action menu enough width and permits wrapping long labels', () => {
	const project = new BannerWidget(template(), { preferences: prefs });
	expect(project.mainLabelPopupButton.getPopup().width).toBe(360);
	const style = document.createElement('style');
	style.textContent = readFileSync('src/styles/styles.css', 'utf8') + '\nhtml, body { direction: ltr; }';
	document.head.appendChild(style);
	document.body.appendChild(project.$element[0]);
	project.mainLabelPopupButton.getPopup().toggle(true);
	expect(getComputedStyle(project.removeButton.$label[0]).whiteSpace).toBe('normal');
	project.mainLabelPopupButton.getPopup().toggle(false);
	project.$element.remove();
	style.remove();
});
