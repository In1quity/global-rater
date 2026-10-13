import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/components/MainWindow.js', () => ({ default: function MainWindow() {} }));

describe('Rater window isolation', () => {
	beforeEach(() => {
		document.head.innerHTML = '<style>.oo-ui-dialog { position: fixed; padding: 12px; } #mw-teleport-target { top: 20px; }</style>';
		const style = document.createElement('style');
		style.textContent = readFileSync('src/styles/styles.css', 'utf8');
		document.head.appendChild(style);
		document.body.className = 'rater-mainWindow-open';
		document.body.innerHTML = `
			<div class="rater-windowManager oo-ui-windowManager-modal">
				<div id="rater" class="oo-ui-dialog oo-ui-window-active"><div id="rater-content"></div></div>
			</div>
			<div id="mw-teleport-target"><div class="oo-ui-windowManager-modal">
				<div id="confirm" class="oo-ui-dialog oo-ui-window-active"><div id="confirm-content"></div></div>
			</div></div>`;
	});

	afterEach(() => vi.unstubAllGlobals());

	it('keeps external confirmation dialogs fixed while allowing Rater to move', () => {
		expect(window.getComputedStyle(document.getElementById('rater')).position).toBe('static');
		expect(window.getComputedStyle(document.getElementById('confirm')).position).toBe('fixed');
		expect(window.getComputedStyle(document.getElementById('mw-teleport-target')).top).toBe('20px');
	});

	it('places only Rater above Timeless menus and below confirmations', () => {
		const zIndex = Number(window.getComputedStyle(document.getElementById('rater-content')).zIndex);
		expect(zIndex).toBeGreaterThan(350);
		expect(zIndex).toBeLessThan(450);
		expect(window.getComputedStyle(document.getElementById('confirm-content')).zIndex).toBe('');
	});

	it('adds the marker to the actual manager before attaching it', async () => {
		const element = document.createElement('div');
		vi.stubGlobal('OO', {
			Factory: function () { this.register = vi.fn(); },
			ui: { WindowManager: function () { this.$element = { addClass: (name) => element.classList.add(name) }; } }
		});
		vi.stubGlobal('$', () => ({ append: () => document.body.appendChild(element) }));
		await import('../src/services/windowManager.js');
		expect(document.body.contains(element)).toBe(true);
		expect(element.classList.contains('rater-windowManager')).toBe(true);
	});
});
