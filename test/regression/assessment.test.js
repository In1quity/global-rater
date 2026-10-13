import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../../src/constants/config.js';
import { parseTemplates } from '../../src/utils/parseTemplates.js';
import { applyBannerInsert } from '../../src/utils/wikitext-apply.js';
import { shouldCreateShell, formatClassRating } from '../../src/services/shellPolicy.js';
import BannerWidget from '../../src/components/BannerWidget.js';
import BannerListWidget from '../../src/components/BannerListWidget.js';
import MainWindow from '../../src/components/MainWindow.js';

const prefs = { bypassRedirects: false, autofillClassFromOthers: false, autofillClassFromOres: false, autofillImportance: true, collapseParamsLowerLimit: 6 };
function banner(text) {
	const template = parseTemplates(text, false)[0];
	template.paramData = {};
	template.paramAliases = { class: 'уровень', importance: 'важность' };
	template.classParamName = 'уровень';
	template.importanceParamName = 'важность';
	template.classes = ['I', 'II', 'III', 'IV'];
	template.importances = ['высшая', 'высокая', 'средняя', 'низкая'];
	return new BannerWidget(template, { preferences: prefs, isArticle: true });
}
function list(items) {
	const result = new BannerListWidget({ preferences: prefs });
	result.pageInfo = { isArticle: true };
	result.addItems(items);
	return result;
}

describe('per-wiki assessment policy and reported wikitext regressions', () => {
	beforeEach(() => {
		config.shellTemplate = 'Блок проектов статьи';
		config.shell = { autoCreate: false, minProjects: null, classLocation: 'banners', classParamName: 'уровень' };
		config.classFormat = 'arabic';
		config.bannerDefaults.classes = ['I', 'II', 'III', 'IV'];
	});
	afterEach(() => vi.restoreAllMocks());

	it('does not create shells on ruwiki by default, supports always and threshold modes', () => {
		expect(shouldCreateShell(4)).toBe(false);
		config.shell.minProjects = 3;
		expect(shouldCreateShell(2)).toBe(false);
		expect(shouldCreateShell(3)).toBe(true);
		config.shell.autoCreate = true;
		expect(shouldCreateShell(1)).toBe(true);
		expect(shouldCreateShell(0)).toBe(false);
	});

	it('supports preferred numeric notation while preserving letter grades', () => {
		expect(formatClassRating('II')).toBe('2');
		expect(formatClassRating('FA')).toBe('FA');
		config.classFormat = 'roman';
		expect(formatClassRating('4')).toBe('IV');
		config.classFormat = 'native';
		expect(formatClassRating('III')).toBe('III');
	});

	it('keeps importance, including unsupported values, when setting all classes', () => {
		const banners = list([
			banner('{{Статья проекта История|уровень=2|важность=средняя}}'),
			banner('{{Статья проекта Литература|уровень=4|важность=наивысшая}}'),
			banner('{{Статья проекта Славяне|уровень=III|важность=высшая}}')
		]);
		MainWindow.prototype.onSetClasses.call({ bannerList: banners }, '2');
		const text = banners.makeWikitext();
		expect(text).toContain('История|уровень=2|важность=средняя');
		expect(text).toContain('Литература|уровень=2|важность=наивысшая');
		expect(text).toContain('Славяне|уровень=2|важность=высшая');
		expect(text).not.toContain('Блок проектов');
	});

	it('retains an existing shell but sets classes only in project banners', () => {
		const banners = list([
			banner('{{Блок проектов статьи|уровень=III|{{Статья проекта История|уровень=4|важность=средняя}}}}'),
			banner('{{Статья проекта История|уровень=4|важность=средняя}}')
		]);
		MainWindow.prototype.onSetClasses.call({ bannerList: banners }, '2');
		const templates = parseTemplates(banners.makeWikitext(), true);
		expect(templates[0].parameters.some((p) => p.name === 'уровень')).toBe(false);
		expect(templates[1].getParam('уровень').value).toBe('2');
		expect(templates[1].getParam('важность').value).toBe('средняя');
	});

	it('writes a shared class only in the shell, and local classes if no shell exists', () => {
		config.shell.classLocation = 'shell';
		const local = banner('{{Статья проекта История|уровень=II|важность=средняя}}');
		const banners = list([local]);
		expect(banners.makeWikitext()).toContain('уровень=2');
		banners.addItems([banner('{{Блок проектов статьи|}}')]);
		const text = banners.makeWikitext();
		const templates = parseTemplates(text, true);
		expect(templates[0].getParam('уровень').value).toBe('2');
		expect(templates[1].getParam('уровень')).toBeUndefined();
		expect(templates[1].getParam('важность').value).toBe('средняя');
	});

	it('requires an explicit shared choice before collapsing conflicting classes', () => {
		config.shell.classLocation = 'shell';
		const banners = list([
			banner('{{Блок проектов статьи|}}'),
			banner('{{Статья проекта История|уровень=II}}'),
			banner('{{Статья проекта Литература|уровень=IV}}')
		]);
		expect(() => banners.makeWikitext()).toThrow('different assessments');
		MainWindow.prototype.onSetClasses.call({ bannerList: banners }, '2');
		expect(banners.makeWikitext().match(/уровень=/g)).toHaveLength(1);
	});

	it('replaces a compact nested shell without leaving extra closing braces', () => {
		const original = '{{Блок проектов статьи|{{Статья проекта Славяне|важность=высшая|уровень=III}}\n{{Статья проекта Славистика|уровень=2|важность=высшая}}}}\n\n== Тема ==\nТекст';
		const desired = '{{Блок проектов статьи|\n{{Статья проекта Славяне|уровень=2|важность=высшая}}\n{{Статья проекта История|уровень=2}}\n{{Статья проекта Литература|уровень=2}}\n}}';
		expect(applyBannerInsert(original, desired, ['Статья проекта Славяне', 'Статья проекта Славистика'])).toBe(desired + '\n\n== Тема ==\nТекст');
	});

	it('preserves surrounding templates and discussions when unwrapping a compact shell', () => {
		const notice = "{{Сообщение ЗЛВ|даты=26—29 мая 2026|текст='''[[kids.kremlin.ru|Обращения Президента России]]'''|архив=2026-05#26—29 мая}}";
		const original = notice + '\n{{Блок проектов статьи|{{статья проекта Литература|уровень=1|важность=высокая}}\n{{Статья проекта Славистика|уровень=1|важность=низкая}}{{Статья проекта Лингвистика|уровень=3|важность=средняя}}{{Статья проекта Образование|уровень=1|важность=средняя}}}}\n{{Ежегодные просмотры}}\n\n== Тема ==\nТекст';
		const desired = '{{Статья проекта Образование|уровень=2|важность=средняя}}';
		expect(applyBannerInsert(original, desired, [])).toBe(notice + '\n' + desired + '\n{{Ежегодные просмотры}}\n\n== Тема ==\nТекст');
	});

	it('updates shell header parameters and handles multiline nested project templates', () => {
		const original = '{{Блок проектов статьи|уровень=3|\n{{Статья проекта История\n|уровень=3\n|важность=средняя\n}}\n}}\n{{Ежегодные просмотры}}';
		const desired = '{{Блок проектов статьи|уровень=2|\n{{Статья проекта История|важность=средняя}}\n}}';
		expect(applyBannerInsert(original, desired, [])).toBe(desired + '\n{{Ежегодные просмотры}}');
	});

	it('does not edit commented templates and preserves blank lines outside banners', () => {
		const original = '<!-- {{Статья проекта История|уровень=III}} -->\n{{Статья проекта История|уровень=III}}\n\n== Тема ==\n\nТекст';
		expect(applyBannerInsert(original, '{{Статья проекта История|уровень=2}}', ['Статья проекта История'])).toBe(original.replace('\n{{Статья проекта История|уровень=III}}', '\n{{Статья проекта История|уровень=2}}'));
	});

	it('creates only one shell when the threshold is reached during asynchronous loading', async () => {
		config.shell.minProjects = 2;
		let finish;
		const createShell = vi.spyOn(BannerWidget, 'newFromTemplateName').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
		const banners = list([banner('{{Статья проекта История|уровень=2}}')]);
		expect(createShell).not.toHaveBeenCalled();
		banners.addItems([banner('{{Статья проекта Литература|уровень=2}}')]);
		banners.addShellTemplateIfNeeeded();
		expect(createShell).toHaveBeenCalledOnce();
		finish(banner('{{Блок проектов статьи|}}'));
		await banners.shellCreationPromise;
		expect(banners.items.filter((item) => item.isShellTemplate)).toHaveLength(1);
	});

	it('writes English letter assessments only in the banner shell', () => {
		config.classFormat = 'native';
		config.shellTemplate = 'WikiProject banner shell';
		config.shell.classLocation = 'shell';
		config.shell.classParamName = 'class';
		config.bannerDefaults.classes = ['FA', 'GA', 'B', 'C', 'Start', 'Stub'];
		const project = parseTemplates('{{WikiProject Literature|class=B|importance=High}}', false)[0];
		project.classes = config.bannerDefaults.classes;
		project.importances = ['High', 'Low'];
		project.paramData = {};
		const banners = list([
			banner('{{WikiProject banner shell|class=B|}}'),
			new BannerWidget(project, { preferences: prefs, isArticle: true })
		]);
		const templates = parseTemplates(banners.makeWikitext(), true);
		expect(templates[0].getParam('class').value).toBe('B');
		expect(templates[1].getParam('class')).toBeUndefined();
		expect(templates[1].getParam('importance').value).toBe('High');
	});

	it('still allows explicitly clearing an importance value', () => {
		const project = banner('{{Статья проекта Литература|уровень=III|важность=высшая}}');
		project.importanceDropdown.getMenu().selectItemByData(null);
		project.onImportanceChange();
		expect(project.makeWikitext()).not.toContain('высшая');
	});
});
