// <nowiki>
import i18n from '@services/i18n.js';

// Lightweight Codex/Vue loader and mounting helpers inspired by sm/maintenance-core.js

let cachedCodex = null;

/**
 * Lazily load Vue and Codex via ResourceLoader and cache the result
 * @returns {Promise<{ createMwApp: Function, Codex: any, components: any }>} Codex utilities
 */
export const ensureCodex = function () {
	if ( cachedCodex ) {
		return Promise.resolve( cachedCodex );
	}
	if ( typeof mw === 'undefined' || !mw.loader || typeof mw.loader.using !== 'function' ) {
		return Promise.reject( new Error( i18n.t( 'error-resource-loader' ) ) );
	}
	return mw.loader.using( [ 'vue', '@wikimedia/codex' ] ).then( () => {
		const VueMod = mw.loader.require( 'vue' );
		const createMwApp = ( VueMod && ( VueMod.createMwApp || VueMod.createApp ) ) || VueMod.createApp;
		const CodexPkg = mw.loader.require( '@wikimedia/codex' );
		const components = CodexPkg && ( CodexPkg.components || CodexPkg );
		cachedCodex = { createMwApp, Codex: CodexPkg, components };
		return cachedCodex;
	} );
};

/**
 * Mount a Vue app to a new detached root and append to body
 * @param {object} appOptions Vue createApp options
 * @returns {{ app: any, root: HTMLElement, unmount: Function }}
 */
export const mountCodexApp = function ( appOptions ) {
	const root = document.createElement( 'div' );
	root.className = 'rater-cdx-root';
	document.body.appendChild( root );
	return ensureCodex().then( ( libs ) => {
		const app = libs.createMwApp( appOptions );
		// Register commonly used Codex components by default
		Object.keys( libs.components || {} ).forEach( ( key ) => {
			try {
				app.component( key, libs.components[ key ] );
			} catch ( _ ) {}
		} );
		const vm = app.mount( root );
		const unmount = function () {
			try {
				app.unmount();
			} catch ( _ ) {}
			if ( root && root.parentNode ) {
				root.parentNode.removeChild( root );
			}
		};
		return { app: vm, root, unmount };
	} );
};

// Convenience: confirm dialog using CdxDialog (basic)
export const codexConfirm = function ( messageHtml, titleText ) {
	return ensureCodex().then( () => mountCodexApp( {
		data() {
			return {
				open: true, title: titleText || '', msg: messageHtml || '',
				primaryAction: { label: i18n.t( 'button-ok' ) },
				defaultAction: { label: i18n.t( 'action-cancel' ) }
			};
		},
		template: '<cdx-dialog v-model:open="open" :use-close-button="true" :title="title" @default="onCancel" @close="onCancel" :primary-action="primaryAction" :default-action="defaultAction" @primary="onOk"><div v-html="msg"></div></cdx-dialog>',
		methods: {
			onOk() {
				this.open = false;
			},
			onCancel() {
				this.open = false;
			}
		}
	} ) ).then( ( mounted ) => new Promise( ( resolve ) => {
		const checkClosed = () => {
			if ( !mounted.root.parentNode ) {
				resolve( false );
				return;
			}
			setTimeout( checkClosed, 50 );
		};
		// Resolve on unmount signal via events
		mounted.app.$watch( 'open', ( val ) => {
			if ( val === false ) {
				mounted.unmount();
				resolve( true );
			}
		} );
		checkClosed();
	} ) );
};

export default { ensureCodex, mountCodexApp, codexConfirm };

// </nowiki>
