// <nowiki>

// Always bundle English as a local fallback (pre-bundled at build time)
// Use define()-injected fallback to avoid CommonJS require
let fallbackDict;
try {
	// Prefer global injected dictionary if present
	fallbackDict = ( typeof RATER_I18N_EN !== 'undefined' ) ? RATER_I18N_EN : {};
} catch ( _ ) {
	fallbackDict = {};
}

// Cache for loaded dictionaries; prefill with English
const cachedDictionaries = {
	en: fallbackDict,
	ru: typeof RATER_I18N_RU !== 'undefined' ? RATER_I18N_RU : null
};

// In-flight loads to avoid duplicate requests
const pendingLoads = {};

function getLangCode() {
	const userLang = ( mw && mw.config && mw.config.get && mw.config.get( 'wgUserLanguage' ) ) || 'en';
	return ( userLang && userLang.split( '-' )[ 0 ] ) || 'en';
}

function getBaseUrl() {
	// Allow override via global for testing or mirrors
	// Example: window.RaterI18nBaseUrl = "https://gitlab.wikimedia.org/iniquity/rater/-/raw/master/i18n/";
	return ( typeof window !== 'undefined' && window.RaterI18nBaseUrl ) || 'https://gitlab-content.toolforge.org/iniquity/rater/-/raw/master/i18n/';
}

function loadLanguage( langCode ) {
	const code = ( langCode || getLangCode() ) || 'en';
	if ( cachedDictionaries[ code ] ) {
		return $.Deferred().resolve( cachedDictionaries[ code ] ).promise();
	}
	if ( pendingLoads[ code ] ) {
		return pendingLoads[ code ];
	}
	const url = getBaseUrl() + code + '.json';
	const deferred = $.Deferred();
	pendingLoads[ code ] = deferred.promise();
	$.getJSON( url )
		.done( ( dict ) => {
			cachedDictionaries[ code ] = dict || {};
			delete pendingLoads[ code ];
			deferred.resolve( cachedDictionaries[ code ] );
		} )
		.fail( () => {
			// Keep it missing; fall back to English at lookup time
			delete pendingLoads[ code ];
			deferred.resolve( fallbackDict );
		} );
	return deferred.promise();
}

function translate( key, langCode ) {
	const code = langCode || getLangCode();
	const dict = cachedDictionaries[ code ];
	const en = fallbackDict || {};
	return ( dict && dict[ key ] ) || en[ key ] || key;
}

// Kick off background load for the user's language (non-blocking)
try {
	loadLanguage( getLangCode() );
} catch ( e ) { /* ignore */ }

export default {
	t: translate,
	getLangCode,
	load: loadLanguage
};
// </nowiki>
