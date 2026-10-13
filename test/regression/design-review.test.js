import { beforeEach, expect, it, vi } from 'vitest';
import config from '../../src/constants/config.js';
import { parseTemplates } from '../../src/utils/parseTemplates.js';
import { Template } from '../../src/utils/models/TemplateModel.js';
import { loadParamDataAndSuggestions } from '../../src/services/templateParams.js';
import { serializeTemplate } from '../../src/utils/serializeTemplate.js';
import API from '../../src/services/api.js';
import BannerWidget from '../../src/components/BannerWidget.js';
import BannerListWidget from '../../src/components/BannerListWidget.js';
import MainWindow from '../../src/components/MainWindow.js';

const prefs = { bypassRedirects: false, autofillClassFromOthers: false, autofillClassFromOres: false, autofillImportance: false, collapseParamsLowerLimit: 6 };
function banner(text) {
	const template = parseTemplates(text, false)[0];
	template.paramData = {};
	template.classes = ['B', 'AL'];
	template.importances = ['High'];
	return new BannerWidget(template, { preferences: prefs, isArticle: true });
}
function list(items) {
	const result = new BannerListWidget({ preferences: prefs });
	result.pageInfo = { isArticle: true };
	result.addItems(items);
	return result;
}
beforeEach(() => {
	localStorage.clear();
	API.get.mockReset();
	config.forceBypassCache = false;
	config.shellTemplate = 'WikiProject banner shell';
	config.shell = { autoCreate: false, minProjects: null, classLocation: 'shell', classParamName: 'class' };
	config.classFormat = 'native';
	config.bannerDefaults.classes = ['B'];
});

it('requires a supported shared choice instead of discarding AL from a project', () => {
	const project = banner('{{WikiProject Military history|class=AL|importance=High}}');
	const banners = list([banner('{{WikiProject banner shell|}}'), project]);
	expect(() => banners.makeWikitext()).toThrow('cannot be stored');
	expect(project.classDropdown.getValue()).toBe('AL');
	expect(project.originalClassValue).toBe('AL');
	MainWindow.prototype.onSetClasses.call({ bannerList: banners }, 'B');
	expect(banners.makeWikitext()).toContain('shell|class=B|');
	expect(banners.makeWikitext()).toContain('importance=High');
});

it('does not autofill over an unsupported original shell class', () => {
	const shell = banner('{{WikiProject banner shell|class=AL|}}');
	const banners = list([shell, banner('{{WikiProject Literature|class=B}}')]);
	expect(() => banners.makeWikitext()).toThrow();
	expect(shell.originalClassValue).toBe('AL');
	expect(shell.classChanged).toBeFalsy();
});

it('keeps an unsupported project class when there is no shell', () => {
	const banners = list([banner('{{WikiProject Military history|class=AL|importance=High}}')]);
	expect(banners.makeWikitext()).toContain('class=AL');
});

it('uses the same canonical parameter on cold and warm loads without matching taskforce-class', async () => {
	API.get.mockImplementation(() => $.Deferred().resolve({ pages: { 1: {
		params: { 'taskforce-class': { suggestedvalues: ['B'] } }, paramOrder: ['taskforce-class']
	} } }).promise());
	const cold = new Template();
	cold.name = 'WikiProject Audit';
	await loadParamDataAndSuggestions(cold);
	const warm = new Template();
	warm.name = cold.name;
	await loadParamDataAndSuggestions(warm);
	expect(warm.classParamName).toBe('class');
	expect(warm.classParamName).toBe(cold.classParamName);
	expect(warm.paramAliases).toEqual(cold.paramAliases);
	expect(API.get).toHaveBeenCalledOnce();
});

it('honors cache bypass for processed metadata as well as raw data', async () => {
	API.get.mockImplementation(() => $.Deferred().resolve({ pages: { 1: {
		params: { 'уровень': { aliases: ['class'] } }
	} } }).promise());
	const first = new Template();
	first.name = 'WikiProject Audit';
	await loadParamDataAndSuggestions(first);
	config.forceBypassCache = true;
	API.get.mockImplementation(() => $.Deferred().resolve({ pages: { 1: {
		params: { 'quality': { aliases: ['class'] } }
	} } }).promise());
	const second = new Template();
	second.name = first.name;
	await loadParamDataAndSuggestions(second);
	expect(second.classParamName).toBe('quality');
	expect(API.get).toHaveBeenCalledTimes(2);
});

it('repeated validation and serialization preserve widget state and produce no resize events', () => {
	const shell = banner('{{WikiProject banner shell|listas=Name|}}');
	shell.nonStandardTemplates = '{{Unrelated notice}}';
	const project = banner('{{WikiProject Literature|class=B|importance=High}}');
	const banners = list([shell, project]);
	const receiver = { resized: vi.fn() };
	banners.connect(receiver, { updatedSize: 'resized' });
	const before = { items: shell.parameterList.getParameterItems().slice(), changed: shell.changed, classChanged: shell.classChanged, autofilled: shell.classDropdown.autofilled };
	banners.validateClassPlacement();
	const first = banners.makeWikitext();
	expect(banners.makeWikitext()).toBe(first);
	expect(first).toContain('listas=Name');
	expect(first).toContain('{{Unrelated notice}}');
	expect(receiver.resized).not.toHaveBeenCalled();
	expect(shell.parameterList.getParameterItems()).toEqual(before.items);
	expect(shell.changed).toBe(before.changed);
	expect(shell.classChanged).toBe(before.classChanged);
	expect(shell.classDropdown.autofilled).toBe(before.autofilled);
});

it('serializes plain parameters, retaining styles and omitting invalid fields', () => {
	expect(serializeTemplate({ name: 'Example', pipeStyle: '\n| ', equalsStyle: ' = ', endBracesStyle: '\n}}', parameters: [
		{ name: 'one', value: 'Text' }, { name: 'empty', value: '' }, { name: 'bad', value: 'Invalid', isInvalid: true }
	] })).toBe('{{Example\n| one = Text\n| empty = \n}}');
});

it('serializes positional shell contents with a single closing newline', () => {
	expect(serializeTemplate({ name: 'Shell', isShellTemplate: true, parameters: [
		{ name: 'class', value: 'B' }, { name: '1', value: '\n{{Project}}\n\n' }
	] })).toBe('{{Shell|class=B|\n{{Project}}\n}}');
});
