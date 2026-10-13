import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import config, {createWikiConfig, loadExternalConfig} from '../../src/constants/config.js';
import i18n from '../../src/services/i18n.js';
import API from '../../src/services/api.js';
import {getBannerNames} from '../../src/services/collectBannersFromCategory.js';
import {checkSubjectFeatures} from '../../src/services/subjectPage.js';
import {buildBannerSuggestions} from '../../src/services/autofill.js';
import {loadParamDataAndSuggestions} from '../../src/services/templateParams.js';
import {isClassParameter} from '../../src/services/shellPolicy.js';
import {parseTemplates} from '../../src/utils/parseTemplates.js';
import BannerWidget from '../../src/components/BannerWidget.js';
import BannerListWidget from '../../src/components/BannerListWidget.js';
import ParameterWidget from '../../src/components/ParameterWidget.js';
import MainWindow from '../../src/components/MainWindow.js';
import {prepareLoaderSource, readJsonDirectory} from '../../scripts/localization-data.js';

const initial = JSON.parse(JSON.stringify(config));
beforeEach(() => {
	Object.assign(config, JSON.parse(JSON.stringify(initial)));
	localStorage.clear();
	API.get.mockReset();
});
afterEach(() => {
	Object.assign(config, JSON.parse(JSON.stringify(initial)));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	delete window.RATER_CONFIG;
	delete window.RATER_CONFIG_URL;
});

it('selects profiles by wiki identity rather than interface language', () => {
	expect(createWikiConfig('ruwiki', '//en.wikipedia.org').categories.withRatings).toBe('Категория:Шаблоны проектов:Баннеры');
	expect(createWikiConfig('enwiki', '//ru.wikipedia.org').shell.classLocation).toBe('shell');
	expect(createWikiConfig('', '//ru.wikipedia.org').wiki.profile).toBe('ruwiki');
});

it('uses neutral defaults for unknown sites and never borrows English categories or assessments', () => {
	const unknown = createWikiConfig('examplewiki', 'https://example.org');
	expect(Object.values(unknown.categories).every((value) => value === '')).toBe(true);
	expect(unknown.shellTemplate).toBe('');
	expect(unknown.defaultParameterData).toEqual({});
	expect(unknown.customBanners).toEqual({});
	expect(unknown.ores.enabled).toBe(false);
});

it('keeps independent profile instances and resolves version placeholders', () => {
	const first = createWikiConfig('ruwiki');
	first.shell.parameters[0].name = 'Changed';
	first.bannerDefaults.classes.push('Changed');
	const second = createWikiConfig('ruwiki');
	expect(second.shell.parameters[0].name).toBe('1');
	expect(second.bannerDefaults.classes).not.toContain('Changed');
	expect(second.script.advert).not.toContain('{version}');
});

it('discovers a third wiki file without editing code or inheriting another wiki profile', async () => {
	vi.stubGlobal('RATER_WIKI_CONFIGS', {...globalThis.RATER_WIKI_CONFIGS, examplewiki: {
		wiki: {servers: ['https://example.org']}, categories: {withRatings: 'Category:Local projects'},
		shellTemplate: 'Local wrapper', shell: {parameters: [{name: '1'}, {name: 'quality'}], classParamName: 'quality'},
		bannerDefaults: {classParamName: 'quality', classes: ['good', 'basic']}, assessmentParameters: {class: ['quality']}
	}});
	const {createWikiConfig: factory} = await import('../../src/constants/config.js?third-wiki');
	const local = factory('', 'https://example.org');
	expect(local.wiki.profile).toBe('examplewiki');
	expect(local.categories.withRatings).toBe('Category:Local projects');
	expect(local.categories.wrappers).toBe('');
	expect(local.shell.parameters.map((parameter) => parameter.name)).toEqual(['1', 'quality']);
});

it('retains compatibility with the existing Russian external configuration', async () => {
	window.RATER_CONFIG = {
		categories: {withRatings: 'Категория:Шаблоны проектов:Баннеры', wrappers: ''},
		shellTemplate: 'Шаблон:Блок проектов статьи', ores: {wiki: 'ruwiki'}
	};
	await loadExternalConfig();
	expect(config.shell.parameters.some((parameter) => parameter.name === 'needs-infobox')).toBe(false);
	expect(config.shell.classLocation).toBe('banners');
	expect(config.classDisplayFormat).toBe('roman');
});

it.each(['raw', 'API'])('loads a published %s profile through a wiki URL placeholder', async (kind) => {
	window.RATER_CONFIG_URL = 'https://www.mediawiki.org/w/api.php?titles=User:Iniquity/rater/data/{wiki}.json&origin=*';
	const profile = {shell: {parameters: [{name: '1'}, {name: 'local-field'}]}, script: {advert: 'version {version}'}};
	const data = kind === 'raw' ? JSON.stringify(profile) : {query: {pages: [{revisions: [{slots: {main: {content: JSON.stringify(profile)}}}]}]}};
	const request = vi.fn().mockResolvedValue({ok: true, json: async () => data});
	vi.stubGlobal('fetch', request);
	await loadExternalConfig();
	expect(request.mock.calls[0][0]).toContain('rater/data/ruwiki.json');
	expect(config.shell.parameters.map((parameter) => parameter.name)).toEqual(['1', 'local-field']);
	expect(config.script.advert).not.toContain('{version}');
});

it('rejects a missing remote profile without replacing a working bundled profile', async () => {
	window.RATER_CONFIG_URL = 'https://example.org/config';
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({query: {pages: [{missing: true}]}})}));
	await expect(loadExternalConfig()).rejects.toThrow('config-page-not-found');
	expect(config.categories).toEqual(initial.categories);
});

it('does not allow external config to mutate object prototypes', async () => {
	window.RATER_CONFIG = JSON.parse('{"__proto__":{"raterInjected":true},"shell":{"constructor":{"prototype":{"raterInjected":true}}}}');
	await loadExternalConfig();
	expect({}.raterInjected).toBeUndefined();
	expect(config.shell.raterInjected).toBeUndefined();
});

it('traverses nested categories once, handles pagination and avoids cycles', async () => {
	config.categories = {withRatings: 'Category:Root'};
	API.get.mockImplementation((params) => {
		const members = params.cmtitle === 'Category:Root' ? [
			{ns: 10, title: 'Шаблон:Статья проекта История'}, {ns: 14, title: 'Category:Child'}
		] : params.cmcontinue ? [{ns: 10, title: 'Шаблон:Статья проекта Литература'}, {ns: 14, title: 'Category:Root'}] : [
			{ns: 10, title: 'Шаблон:Статья проекта История'}, {ns: 14, title: 'Category:Child'}
		];
		return $.Deferred().resolve({query: {categorymembers: members}, ...(params.cmtitle === 'Category:Child' && !params.cmcontinue ? {continue: {cmcontinue: 'next'}} : {})}).promise();
	});
	const banners = await getBannerNames();
	expect(banners.withRatings).toEqual(['Статья проекта История', 'Статья проекта Литература']);
	expect(API.get).toHaveBeenCalledTimes(3);
	await getBannerNames();
	expect(API.get).toHaveBeenCalledTimes(3);
});

it('reloads the project list when its configured category source changes', async () => {
	config.categories = {withRatings: 'Category:First'};
	API.get.mockImplementation((params) => $.Deferred().resolve({query: {categorymembers: [{ns: 10, title: 'Шаблон:' + params.cmtitle.slice(9)}]}}).promise());
	expect((await getBannerNames()).withRatings).toEqual(['First']);
	config.categories.withRatings = 'Category:Second';
	expect((await getBannerNames()).withRatings).toEqual(['Second']);
	expect(API.get).toHaveBeenCalledTimes(2);
});

it('excludes configured helper templates while preserving actual project banners', () => {
	const suggestions = buildBannerSuggestions({withRatings: ['Статья проекта', 'Уровень статьи', 'Блок проектов статьи', 'Статья проекта История']});
	expect(suggestions.map((suggestion) => suggestion.data.name)).toEqual(['Статья проекта История']);
});

it('detects localized stub categories and direct featured membership across continued responses', async () => {
	API.get.mockImplementation((params) => $.Deferred().resolve(params.clcontinue ? {
		query: {pages: [{categories: [{title: 'Категория:Незавершённые статьи о писателях'}, {title: config.subjectPageCategories.featuredArticle}]}]}
	} : {query: {pages: [{categories: [{title: 'Категория:Писатели'}]}]}, continue: {clcontinue: 'next'}}).promise());
	const result = await checkSubjectFeatures('Example', true, config.subjectPageCategories);
	expect(result.stubtag).toBe(true);
	expect(result.isFA).toBe(true);
	expect(result.isGA).toBe(false);
	expect(API.get.mock.calls[0][0]).not.toHaveProperty('clcategories');
});

it('uses configured local grades for ORES and importance autofill', () => {
	const preferences = {...config.defaultPrefs, autofillClassFromOthers: false, shellCreation: 'never'};
	const model = parseTemplates('{{Статья проекта История}}', false)[0];
	Object.assign(model, {paramData: {}, classParamName: 'уровень', importanceParamName: 'важность', classes: ['III', 'IV'], importances: ['низкая', 'высокая']});
	const banners = new BannerListWidget({preferences, oresClass: 'III'});
	banners.pageInfo = {isArticle: true};
	banners.addItems([new BannerWidget(model, {preferences, isArticle: true})]);
	expect(banners.items[0].classDropdown.getValue()).toBe('3');
	expect(banners.items[0].importanceDropdown.getValue()).toBe('низкая');
	expect(banners.makeWikitext()).toContain('уровень=3');
});

it('keeps English wiki rules with a Russian interface and localizes parameter metadata independently', () => {
	Object.assign(config, createWikiConfig('enwiki', '', config.mw));
	const get = mw.config.get;
	vi.spyOn(mw.config, 'get').mockImplementation((key) => key === 'wgUserLanguage' ? 'ru' : get(key));
	expect(config.shell.classLocation).toBe('shell');
	expect(i18n.t('prefs-group-startup')).toBe('Запуск');
	expect(i18n.t('summary-assessment', config.editSummaryLanguage)).toBe('Assessment');
	expect(i18n.metadataText({labelKey: 'parameter-shell-header'}, 'label')).toBe('Заголовок блока');
});

it('does not mutate parameter definitions when widgets construct checkboxes', () => {
	const data = {allowedValues: ['yes']};
	new ParameterWidget({name: 'example', value: 'yes'}, data);
	expect(data.allowedValues).toEqual(['yes']);
});

it('localizes confirmation messages and keeps template names literal', () => {
	const get = mw.config.get;
	vi.spyOn(mw.config, 'get').mockImplementation((key) => key === 'wgUserLanguage' ? 'ru' : get(key));
	expect(i18n.t('alert-banner-existing', null, {name: 'Литература'})).toBe('Шаблон {{Литература}} уже добавлен');
	expect(i18n.t('button-more-parameters', null, {count: 3})).toBe('Ещё параметры (3)');
	const dialog = new MainWindow();
	expect(MainWindow.static.title.text()).toContain('обсуждение');
	expect(MainWindow.static.title.find('a')[0].getAttribute('href')).toContain('mw:User:Iniquity/rater.js');
});

it('localizes the published loader from language files before the core is loaded', async () => {
	const add = vi.fn();
	const source = prepareLoaderSource(readFileSync('index.js', 'utf8'), readJsonDirectory('i18n'), 'en');
	const context = {
		mw: {config: {get: (key) => Array.isArray(key) ? {wgNamespaceNumber: 0, wgPageName: 'Example'} : 'ru'},
			loader: {using: () => Promise.resolve()}, util: {addPortletLink: add}},
		document: {getElementById: () => null}, $: () => ({length: 0, on: () => {}})
	};
	context.$.when = () => Promise.resolve();
	vm.runInNewContext(source, context);
	await vi.waitFor(() => expect(add).toHaveBeenCalled());
	expect(add.mock.calls[0][4]).toBe('Оценить качество и важность');
});

it('loads configured assessment parameter names instead of hardcoded language aliases', async () => {
	config.assessmentParameters = {class: ['quality'], importance: ['priority']};
	config.bannerDefaults.classParamName = 'quality';
	config.bannerDefaults.importanceParamName = 'priority';
	API.get.mockImplementation(() => $.Deferred().resolve({pages: {1: {params: {quality: {aliases: ['q']}, priority: {}}}}}).promise());
	const model = parseTemplates('{{Local project|q=good|priority=high}}', false)[0];
	await loadParamDataAndSuggestions(model);
	expect(model.classParamName).toBe('quality');
	expect(model.importanceParamName).toBe('priority');
	expect(model.paramAliases.q).toBe('quality');
	expect(isClassParameter(model, 'q')).toBe(true);
	expect(isClassParameter(model, 'class')).toBe(false);
});
