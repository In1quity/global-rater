import { beforeEach, describe, expect, it } from 'vitest';
import API from '../../src/services/api.js';
import { getTemplateData, getTemplateDataDetails } from '../../src/services/templateData.js';
import * as cache from '../../src/services/cache.js';
import BannerWidget from '../../src/components/BannerWidget.js';
import config from '../../src/constants/config.js';

const title = 'Шаблон:Статья проекта Литература';
const payload = { pages: { 1: { params: {
	'уровень': { aliases: ['class'], suggestedvalues: ['I', 'II', 'III', 'IV'] },
	'важность': { aliases: ['importance'], suggestedvalues: ['высшая', 'высокая', 'средняя', 'низкая'] }
}, paramOrder: ['уровень', 'важность'] } } };

describe('TemplateData cache and Russian canonical parameters', () => {
	beforeEach(() => {
		localStorage.clear();
		API.get.mockReset().mockImplementation(() => $.Deferred().resolve(payload).promise());
	});

	it('returns the same processed details on cold and warm loads', async () => {
		const first = await getTemplateDataDetails(title);
		const second = await getTemplateDataDetails(title);
		expect(first.classParamName).toBe('уровень');
		expect(first.importanceParamName).toBe('важность');
		expect(second).toEqual(first);
		expect(second.paramData['важность'].suggestedvalues).toContain('средняя');
		expect(API.get).toHaveBeenCalledOnce();
	});

	it('keeps raw and processed TemplateData in different cache entries', async () => {
		await getTemplateDataDetails(title);
		const raw = await getTemplateData(title);
		const processed = await getTemplateDataDetails(title);
		expect(raw.params['важность']).toBeDefined();
		expect(processed.paramData['важность']).toBeDefined();
		expect(API.get).toHaveBeenCalledOnce();
	});

	it('ignores legacy entries that may contain raw data instead of parameter details', async () => {
		cache.write(title + '-params', { params: {}, paramOrder: [] }, 1);
		const processed = await getTemplateDataDetails(title);
		expect(processed.paramData['важность']).toBeDefined();
		expect(API.get).toHaveBeenCalledOnce();
	});

	it('loads localized parameter metadata before detecting ratings for a newly added Literature banner', async () => {
		config.classFormat = 'arabic';
		API.get.mockImplementation((params) => $.Deferred().resolve(params.action === 'query' ? { query: { pages: {} } } : payload).promise());
		const result = await BannerWidget.newFromTemplateName('Статья проекта Литература', {}, {
			preferences: { bypassRedirects: false, collapseParamsLowerLimit: 6 }, isArticle: true
		});
		expect(result.classParamName).toBe('уровень');
		expect(result.importanceParamName).toBe('важность');
		expect(result.classDropdown.getMenu().findItemFromData('2')).toBeDefined();
		expect(result.importanceDropdown.getMenu().findItemFromData('средняя')).toBeDefined();
		expect(API.get.mock.calls.some(([params]) => params.action === 'parse')).toBe(false);
	});
});
