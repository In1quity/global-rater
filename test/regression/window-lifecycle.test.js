import { afterEach, expect, it, vi } from 'vitest';
import MainWindow from '../../src/components/MainWindow.js';
import config from '../../src/constants/config.js';

const managers = [];
async function openEditor() {
	const manager = new OO.ui.WindowManager();
	for (const method of ['getSetupDelay', 'getReadyDelay', 'getHoldDelay', 'getTeardownDelay']) {
		vi.spyOn(manager, method).mockReturnValue(0);
	}
	const dialog = new MainWindow();
	manager.addWindows([dialog]);
	document.body.appendChild(manager.$element[0]);
	managers.push(manager);
	const page = { getPrefixedText: () => 'Example', getNamespacePrefix: () => '' };
	const lifecycle = manager.openWindow(dialog, {
		preferences: { ...config.defaultPrefs, autofillClassFromOthers: false, autofillClassFromOres: false, autofillImportance: false },
		banners: [], bannerNames: {}, isArticle: true,
		subjectPage: page, talkpage: page, talkWikitext: ''
	});
	await lifecycle.opened;
	return { dialog, manager, lifecycle };
}

afterEach(async () => {
	for (const manager of managers.splice(0)) {
		if (manager.getCurrentWindow()) await manager.closeWindow(manager.getCurrentWindow()).closed;
		await manager.destroy();
	}
	vi.restoreAllMocks();
});

it('closes an unchanged editor through its real close button and window lifecycle', async () => {
	const { dialog, manager, lifecycle } = await openEditor();
	expect(dialog.bannerList.changed).toBe(false);
	const closeButton = dialog.actions.get({ actions: [''], visible: true })[0];
	closeButton.$button.trigger($.Event('click', { which: 1 }));
	await lifecycle.closed;
	expect(manager.getCurrentWindow()).toBeNull();
	expect(dialog.isPending()).toBe(false);
});

it('cancels and accepts real discard confirmations, then reopens and closes the editor', async () => {
	const { dialog, manager, lifecycle } = await openEditor();
	dialog.bannerList.changed = true;
	const messageManager = OO.ui.getWindowManager();
	const firstAction = dialog.executeAction('');
	await vi.waitFor(() => expect(messageManager.getCurrentWindow()?.isOpened()).toBe(true));
	await messageManager.getCurrentWindow().executeAction('reject');
	await firstAction;
	expect(dialog.isPending()).toBe(false);
	expect(dialog.isOpened()).toBe(true);
	const secondAction = dialog.executeAction('');
	await vi.waitFor(() => expect(messageManager.getCurrentWindow()?.isOpened()).toBe(true));
	await messageManager.getCurrentWindow().executeAction('accept');
	await secondAction;
	await lifecycle.closed;
	expect(dialog.isPending()).toBe(false);
	expect(manager.getCurrentWindow()).toBeNull();
	const reopened = manager.openWindow(dialog, {
		preferences: config.defaultPrefs, banners: [], bannerNames: {}, isArticle: true,
		subjectPage: { getNamespacePrefix: () => '' }, talkpage: { getPrefixedText: () => 'Example' }, talkWikitext: ''
	});
	await reopened.opened;
	// Closing after reopening still works when previous edits have been discarded.
	dialog.bannerList.changed = false;
	await dialog.executeAction('');
	await reopened.closed;
	expect(dialog.isPending()).toBe(false);
});
