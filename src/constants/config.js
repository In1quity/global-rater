import defaults from '../../rater/data/default.json';
// <nowiki>

const version = typeof RATER_VERSION !== 'undefined' ? RATER_VERSION : '0.0.0';
const wikiProfiles = typeof RATER_WIKI_CONFIGS !== 'undefined' ? RATER_WIKI_CONFIGS : {};

const deepMerge = function ( target, source ) {
	if ( !source || typeof source !== 'object' || Array.isArray( source ) ) {
		return target;
	}
	Object.keys( source ).forEach( ( key ) => {
		if ( [ '__proto__', 'constructor', 'prototype', '$schema' ].includes( key ) ) {
			return;
		}
		const value = source[ key ];
		if ( Array.isArray( value ) ) {
			target[ key ] = JSON.parse( JSON.stringify( value ) );
		} else if ( value && typeof value === 'object' ) {
			target[ key ] = deepMerge( target[ key ] && typeof target[ key ] === 'object' ? target[ key ] : {}, value );
		} else {
			target[ key ] = value;
		}
	} );
	return target;
};

const normaliseServer = ( server ) => String( server || '' ).replace( /^(?:https?:)?\/\//, '' ).replace( /\/$/, '' ).toLowerCase();

const createWikiConfig = function ( dbName, server, mwSettings = {} ) {
	const profileName = Object.prototype.hasOwnProperty.call( wikiProfiles, dbName ) ? dbName :
		Object.keys( wikiProfiles ).find( ( name ) => ( wikiProfiles[ name ].wiki && wikiProfiles[ name ].wiki.servers || [] )
			.some( ( site ) => normaliseServer( site ) === normaliseServer( server ) ) );
	const result = deepMerge( JSON.parse( JSON.stringify( defaults ) ), wikiProfiles[ profileName ] );
	result.wiki.id = dbName || profileName || '';
	result.wiki.profile = profileName || 'default';
	result.mw = mwSettings;
	result.script.version = version;
	result.script.advert = result.script.advert.replace( /\{version\}/g, version );
	const namespaceNames = Object.keys( mwSettings.wgNamespaceIds || {} ).filter( ( name ) => mwSettings.wgNamespaceIds[ name ] === 10 );
	result.templateNamespaceAliases = Array.from( new Set( ( result.templateNamespaceAliases || [] )
		.concat( mwSettings.wgFormattedNamespaces && mwSettings.wgFormattedNamespaces[ 10 ] || [], namespaceNames ) ) );
	return result;
};

const config = createWikiConfig( mw.config.get( 'wgDBname' ), mw.config.get( 'wgServer' ), mw.config.get( [
	'skin', 'wgPageName', 'wgNamespaceNumber', 'wgUserName', 'wgFormattedNamespaces',
	'wgNamespaceIds', 'wgMonthNames', 'wgRevisionId', 'wgScriptPath', 'wgServer', 'wgCategories', 'wgIsMainPage'
] ) );

// Optional site-local overrides retain compatibility with existing installations.
const loadExternalConfig = function () {
	const apply = ( data ) => {
		let source = typeof data === 'string' ? JSON.parse( data ) : data;
		if ( source && source.query && source.query.pages ) {
			const page = Object.values( source.query.pages )[ 0 ];
			const content = page.revisions && page.revisions[ 0 ].slots.main;
			if ( !content ) {
				throw new Error( 'config-page-not-found' );
			}
			source = JSON.parse( content.content === undefined ? content[ '*' ] : content.content );
		}
		deepMerge( config, source );
		config.script.advert = config.script.advert.replace( /\{version\}/g, config.script.version );
	};
	if ( window.RATER_CONFIG && typeof window.RATER_CONFIG === 'object' ) {
		apply( window.RATER_CONFIG );
		return Promise.resolve();
	}
	if ( typeof window.RATER_CONFIG_URL === 'string' && window.RATER_CONFIG_URL ) {
		const url = window.RATER_CONFIG_URL.replace( /\{wiki\}/g, encodeURIComponent( config.wiki.id ) );
		return fetch( url ).then( ( response ) => {
			if ( response.ok === false ) {
				throw new Error( 'config-request-failed' );
			}
			return response.json();
		} ).then( apply );
	}
	return Promise.resolve();
};

export default config;
export { config, createWikiConfig, loadExternalConfig };
// </nowiki>
