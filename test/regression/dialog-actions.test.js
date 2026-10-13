import { afterEach, describe, expect, it, vi } from 'vitest';
import MainWindow from '../../src/components/MainWindow.js';
import API from '../../src/services/api.js';

function dialog() {
	const result = new MainWindow();
	result.setManager(new OO.ui.WindowManager());
	result.$body = $('<div>');
	result.bannerList = { changed: true, validateClassPlacement: vi.fn() };
	result.close = vi.fn(() => $.Deferred().promise());
	result.showErrors = vi.fn();
	result.updateSize = vi.fn();
	result.talkpage = { getPrefixedText: () => 'Обсуждение:Вредные советы' };
	result.transformTalkWikitext = vi.fn(() => '{{Статья проекта Литература|уровень=2}}');
	result.makeEditSummary = vi.fn(() => 'Assessment');
	return result;
}

afterEach(() => vi.restoreAllMocks());

describe('dialog actions with real OOUI processes', () => {
	it('finishes the discard action without waiting for the window teardown', async () => {
		vi.spyOn(OO.ui, 'confirm').mockReturnValue($.Deferred().resolve(true).promise());
		const window = dialog();
		await window.executeAction('');
		expect(window.close).toHaveBeenCalledOnce();
		expect(window.isPending()).toBe(false);
	});

	it('leaves the editor usable after cancelling discard', async () => {
		vi.spyOn(OO.ui, 'confirm').mockReturnValue($.Deferred().resolve(false).promise());
		const window = dialog();
		await window.executeAction('');
		expect(window.close).not.toHaveBeenCalled();
		expect(window.isPending()).toBe(false);
	});

	it.each(['preview', 'changes'])('releases pending state if %s throws before its API request', async (action) => {
		const window = dialog();
		window.transformTalkWikitext.mockImplementation(() => { throw new Error('Cannot render template'); });
		await expect(Promise.resolve(window.executeAction(action))).rejects.toBeDefined();
		expect(window.isPending()).toBe(false);
	});

	it('releases pending state on preview API rejection', async () => {
		API.post.mockReturnValue($.Deferred().reject('timeout').promise());
		const window = dialog();
		await expect(Promise.resolve(window.executeAction('preview'))).rejects.toBeDefined();
		expect(window.isPending()).toBe(false);
		const errors = window.showErrors.mock.calls[0][0];
		expect(errors[0].getMessageText()).toContain('timeout');
		expect(errors[0].getMessageText()).not.toContain('[object HTMLDivElement]');
	});

	it('releases pending state when shared classes need a user choice', async () => {
		const window = dialog();
		window.bannerList.validateClassPlacement.mockImplementation(() => { throw new Error('Choose a shared class'); });
		await expect(Promise.resolve(window.executeAction('preview'))).rejects.toBeDefined();
		expect(window.isPending()).toBe(false);
	});

	it('completes preview, scrolls the preview to the top, and permits returning to edit', async () => {
		API.post.mockReturnValue($.Deferred().resolve({ parse: { text: { '*': '<div>Literature banner</div>' } } }).promise());
		const window = dialog();
		window.parsedContentWidget = new OO.ui.LabelWidget();
		window.parsedContentContainer = new OO.ui.FieldsetLayout();
		window.parsedContentLayout = new OO.ui.PanelLayout();
		window.editLayout = new OO.ui.PanelLayout();
		window.contentArea = new OO.ui.StackLayout({ items: [window.editLayout, window.parsedContentLayout] });
		window.topBar = { setDisabled: vi.fn() };
		window.$body.scrollTop(500);
		await window.executeAction('preview');
		expect(window.isPending()).toBe(false);
		expect(window.$body.scrollTop()).toBe(0);
		expect(window.contentArea.getCurrentItem()).toBe(window.parsedContentLayout);
		await window.executeAction('back');
		expect(window.contentArea.getCurrentItem()).toBe(window.editLayout);
		expect(window.topBar.setDisabled).toHaveBeenLastCalledWith(false);
	});

	it('limits long previews to the viewport height', () => {
		const context = {
			contentArea: { getCurrentItem: () => ({ $element: { outerHeight: () => 10000, children: () => ({ outerHeight: () => 10000 }) } }) },
			$head: { outerHeight: () => 73 }, $foot: { outerHeight: () => 50 }
		};
		expect(MainWindow.prototype.getBodyHeight.call(context)).toBeLessThan(window.innerHeight);
	});
});
