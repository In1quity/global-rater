import config from '@constants/config.js';
import logger from '@services/logger.js';
const log = logger.get( 'autostart' );
import { getPrefs } from '@services/prefs.js';
import API, { makeErrorMsg } from '@services/api.js';
import setupRater from '@services/setup.js';
import { stripAnyTemplateNs } from '@utils/wikitext.js';
// <nowiki>

const autoStart = function autoStart() {

	return getPrefs().then( ( prefs ) => {
		// Check if pref is turned off
		if ( !prefs.autostart ) {
			return;
		}
		// Check if pref is turned off for redirects, and current page is a redirect
		if ( !prefs.autostartRedirects && window.location.search.includes( 'redirect=no' ) ) {
			return;
		}
		// Check if viewing diff/history/old version
		if ( /(action|diff|oldid)/.test( window.location.search ) ) {
			return;
		}
		const subjectTitle = mw.Title.newFromText( config.mw.wgPageName ).getSubjectPage();
		// Check if subject page is the main page
		if ( config.mw.wgIsMainPage ) {
			return;
		}
		// Check subject page namespace
		if (
			prefs.autostartNamespaces &&
			prefs.autostartNamespaces.length &&
			!prefs.autostartNamespaces.includes( config.mw.wgNamespaceNumber )
		) {
			return;
		}

		// If talk page does not exist, can just autostart
		if ( document.querySelector( '#ca-talk.new' ) ) {
			return setupRater();
		}

		// Detect configured project prefixes and meta-template names on the talk page.
		const talkTitle = mw.Title.newFromText( config.mw.wgPageName ).getTalkPage();
		return API.get( {
			action: 'query',
			format: 'json',
			prop: 'templates',
			titles: talkTitle.getPrefixedText(),
			tlnamespace: '10',
			tllimit: '500',
			indexpageids: 1
		} )
			.then( ( result ) => {
				const id = result.query.pageids;
				const templates = result.query.pages[ id ].templates;

				if ( !templates ) {
					return setupRater();
				}

				const hasWikiproject = templates.some( ( template ) => {
					const name = stripAnyTemplateNs( template.title ).toLowerCase();
					return config.bannerNamePrefixes.some( ( prefix ) => name.startsWith( prefix.toLowerCase() ) ) ||
						config.autostartTemplatePatterns.some( ( pattern ) => new RegExp( pattern, 'i' ).test( name ) );
				} );

				if ( !hasWikiproject ) {
					return setupRater();
				}

			},
			( code, jqxhr ) => {
			// Silently ignore failures (just log to console)
				log.warn(
					'[Rater] Error while checking whether to autostart.' +
					( code === null || typeof code === 'undefined' ? '' : ' ' + makeErrorMsg( code, jqxhr ) )
				);
				throw new Error( 'Autostart check failed' );
			} );
	} );

};

export default autoStart;
// </nowiki>
