import { setupRater, API, makeErrorMsg, windowManager } from './services/index.js';
import logger from './services/logger.js';
import i18n from './services/i18n.js';
import './styles/styles.css';
import { config, loadExternalConfig } from './constants/index.js';
// <nowiki>

const log = logger.get( 'app' );

function startApp() {
	log.info( 'startApp called' );

	const showMainWindow = ( data ) => {
		if ( !data || !data.success ) {
			return;
		}
		// Add css class to body to enable background scrolling
		document.getElementsByTagName( 'body' )[ 0 ].classList.add( 'rater-mainWindow-open' );
		// Open the window
		windowManager.openWindow( 'main', data )
			.closed.then( ( result ) => {
				document.getElementsByTagName( 'body' )[ 0 ].classList.remove( 'rater-mainWindow-open' );
				// Restart if needed
				if ( result && result.restart ) {
					windowManager.removeWindows( [ 'main' ] )
						.then( setupRater )
						.then( showMainWindow, showSetupError );
					return;
				}
				// Show notification when saved successfully
				if ( result && result.success ) {
					const span = document.createElement( 'span' );
					const strong = document.createElement( 'strong' );
					strong.textContent = i18n.t( 'notify-saved' );
					span.appendChild( strong );
					if ( result.upgradedStub ) {
						const br = document.createElement( 'br' );
						const stub = document.createElement( 'span' );
						stub.textContent = i18n.t( 'notify-stub' );
						span.appendChild( br );
						span.appendChild( stub );
					}
					mw.notify(
						span,
						{ autoHide: true, autoHideSeconds: 'long', tag: 'Rater-saved' }
					);
				}
			} );
	};

	function showSetupError( code, jqxhr ) {
		return OO.ui.alert(
			makeErrorMsg( code, jqxhr ),
			{ title: i18n.t( 'app-setup-error' ) }
		);
	}

	// When the bundle is loaded on demand, start immediately
	setupRater().then( showMainWindow, showSetupError );
}

// Ensure i18n is loaded before constructing UI so initial labels are localized
log.info( 'Starting initialization' );
try {
	// Ensure external per-wiki config (if any) is loaded before i18n/UI
	loadExternalConfig().then( () => {
		log.info( 'External config loaded' );
		// Update API user agent with config version
		if ( config && config.script && config.script.version ) {
			API.updateUserAgent( config.script.version );
		}
		return Promise.all( [ i18n.load(), i18n.load( config.editSummaryLanguage ) ] );
	} ).then( () => {
		log.info( 'i18n loaded' );
		startApp();
	} ).catch( ( e ) => {
		log.error( 'Error in initialization:', e );
		startApp();
	} );
} catch ( e ) {
	log.error( 'Error in initialization:', e );
	startApp();
}
// </nowiki>
