import { afterEach, expect, it, vi } from 'vitest';
import MainWindow from '../../src/components/MainWindow.js';
import { createDialogError } from '../../src/components/dialogErrors.js';
import API from '../../src/services/api.js';

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

it('passes readable, escaped error contents through real OOUI', () => {
	const error = createDialogError('error-could-not-save', 'protectedpage', { error: { code: 'protectedpage', info: '<b>Protected page</b>' } });
	expect(error.getMessageText()).toContain('Protected page');
	expect(error.getMessageText()).not.toContain('[object HTMLDivElement]');
	expect(error.message.find('b')).toHaveLength(0);
	expect(createDialogError('error-could-not-save', new Error('Empty result')).getMessageText()).toContain('Empty result');
});

it('supplies a supported title label to OOUI', () => {
	const label = new OO.ui.LabelWidget({ label: MainWindow.static.title });
	expect(label.$label.find('a')).toHaveLength(2);
	expect(label.$label.text()).toContain('Rater');
});

it.each(['UI', 'raw wikitext'])('refocuses search after a duplicate alert (%s) without loading another banner', async (source) => {
	const selected = { name: 'WikiProject Literature' };
	const searchBox = { pushPending: vi.fn(), popPending: vi.fn(), focus: vi.fn() };
	const alert = $.Deferred();
	vi.spyOn(OO.ui, 'alert').mockReturnValue(alert.promise());
	const context = {
		topBar: { searchBox },
		bannerList: { items: source === 'UI' ? [{ mainText: selected.name }] : [] },
		talkWikitext: '{{WikiProject Literature|class=B}}'
	};
	const action = MainWindow.prototype.onSearchSelect.call(context, selected);
	expect(searchBox.popPending).toHaveBeenCalledOnce();
	expect(searchBox.focus).not.toHaveBeenCalled();
	alert.resolve();
	await action;
	expect(searchBox.focus).toHaveBeenCalledOnce();
});

it('replaces and removes body drag handlers across repeated setups and teardown', async () => {
	const add = vi.spyOn(document.body, 'addEventListener');
	const remove = vi.spyOn(document.body, 'removeEventListener');
	const manager = new OO.ui.WindowManager();
	const dialog = new MainWindow();
	manager.addWindows([dialog]);
	document.body.appendChild(manager.$element[0]);
	const firstCalls = add.mock.calls.length;
	dialog.makeDraggable();
	const initialHandlers = add.mock.calls.slice(firstCalls).filter(([name]) => /^(?:pointer|mouse)(?:move|up)$/.test(name));
	expect(initialHandlers).toHaveLength(2);
	dialog.makeDraggable();
	for (const [name, handler] of initialHandlers) {
		expect(remove).toHaveBeenCalledWith(name, handler);
	}
	const cleanup = vi.spyOn(dialog, 'removeDragHandlers');
	await dialog.getTeardownProcess({}).execute();
	expect(cleanup).toHaveBeenCalledOnce();
	expect(dialog.removeDragHandlers).toBeNull();
	const dragCalls = add.mock.calls.filter(([name]) => /^(?:pointer|mouse)(?:move|up)$/.test(name));
	for (const [name, handler] of dragCalls) {
		expect(remove).toHaveBeenCalledWith(name, handler);
	}
});

it.each([
	['//ru.wikipedia.org', '/w/index.php?title=Example&action=raw'],
	['https://ru.wikipedia.org', '/w/index.php?title=Example&action=raw'],
	['https://ru.wikipedia.org', '//ru.wikipedia.org/w/index.php?title=Example&action=raw'],
	['https://ru.wikipedia.org', 'https://ru.wikipedia.org/w/index.php?title=Example&action=raw']
])('resolves raw page URLs with server %s and page URL %s', async (server, pageUrl) => {
	vi.spyOn(mw.config, 'get').mockReturnValue(server);
	vi.spyOn(mw.util, 'getUrl').mockReturnValue(pageUrl);
	const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ text: async () => 'wikitext' });
	await expect(API.getRaw('Example')).resolves.toBe('wikitext');
	expect(fetch).toHaveBeenCalledWith('https://ru.wikipedia.org/w/index.php?title=Example&action=raw');
});

it.each([
	'<div class="mw-parser-output"><p>Legacy preview</p></div>',
	'<div class="mw-parser-output"><section data-mw-section-id="0"><div typeof="mw:Transclusion"><p>Parsoid preview</p></div><a href="https://ru.wikipedia.org/wiki/Example">Link</a></section></div>'
])('renders preview HTML without assuming the parser nesting structure', async (html) => {
	API.post.mockReturnValue($.Deferred().resolve({ parse: { text: { '*': html } } }).promise());
	const manager = new OO.ui.WindowManager();
	const dialog = new MainWindow();
	manager.addWindows([dialog]);
	dialog.transformTalkWikitext = () => '{{Project}}';
	dialog.makeEditSummary = () => 'Assessment';
	dialog.talkpage = { getPrefixedText: () => 'Talk:Example' };
	await dialog.executeAction('preview');
	expect(dialog.parsedContentWidget.$label.find('.mw-parser-output')).toHaveLength(1);
	expect(dialog.parsedContentWidget.$label.text()).toContain('preview');
	expect(dialog.isPending()).toBe(false);
});

it('retains table rows and cells from the compare API response', async () => {
	API.post.mockReturnValue($.Deferred().resolve({ compare: { '*': '<tr><td class="diff-deletedline">Old content</td><td class="diff-addedline">New content</td></tr>' } }).promise());
	const manager = new OO.ui.WindowManager();
	const dialog = new MainWindow();
	manager.addWindows([dialog]);
	dialog.talkWikitext = '{{Old project}}';
	dialog.transformTalkWikitext = () => '{{New project}}';
	dialog.makeEditSummary = () => 'Assessment';
	dialog.talkpage = { getPrefixedText: () => 'Talk:Example' };
	await dialog.executeAction('changes');
	expect(dialog.parsedContentWidget.$label.find('table.diff td.diff-deletedline').text()).toBe('Old content');
	expect(dialog.parsedContentWidget.$label.find('table.diff td.diff-addedline').text()).toBe('New content');
	expect(dialog.isPending()).toBe(false);
});
