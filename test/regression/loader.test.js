import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
	delete mw.loader;
	delete mw.util.addPortletLink;
});

it.each([false, true])('binds the returned portlet element with missing actions portlet=%s and preserves the public API', async (missingActions) => {
	const link = document.createElement('li');
	link.id = 'ca-rater';
	const addPortletLink = vi.fn((portlet) => missingActions && portlet === 'p-cactions' ? null : link);
	mw.util.addPortletLink = addPortletLink;
	const load = vi.fn();
	mw.loader = { using: vi.fn(() => $.Deferred().resolve().promise()), load };
	vi.resetModules();
	await import('../../index.js');
	await vi.waitFor(() => expect(addPortletLink).toHaveBeenCalled());
	$(link).trigger('click');
	await vi.waitFor(() => expect(load).toHaveBeenCalled());
	expect(mw.util.addPortletLink).toBe(addPortletLink);
	expect(addPortletLink).toHaveBeenCalledTimes(missingActions ? 2 : 1);
	expect(load.mock.calls[0][0]).toContain('User:Iniquity/rater-core.js');
});
