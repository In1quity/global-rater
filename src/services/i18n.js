import config from '@constants/config.js';
// <nowiki>

const cachedDictionaries = Object.assign( {}, typeof RATER_I18N_DICTIONARIES !== 'undefined' ? RATER_I18N_DICTIONARIES : {} );
const pendingLoads = {};

const getLangCode = function () {
	const language = mw.config.get( 'wgUserLanguage' ) || config.i18n.fallbackLanguage;
	return cachedDictionaries[ language ] ? language : language.split( '-' )[ 0 ];
};
const getFallback = () => cachedDictionaries[ config.i18n.fallbackLanguage ] || {};

const loadLanguage = function ( langCode ) {
	const code = langCode || getLangCode();
	if ( cachedDictionaries[ code ] ) {
		return $.Deferred().resolve( cachedDictionaries[ code ] ).promise();
	}
	if ( pendingLoads[ code ] ) {
		return pendingLoads[ code ];
	}
	const deferred = $.Deferred();
	pendingLoads[ code ] = deferred.promise();
	$.getJSON( ( window.RaterI18nBaseUrl || config.i18n.baseUrl ) + code + '.json' )
		.done( ( dictionary ) => {
			cachedDictionaries[ code ] = dictionary || {};
			delete pendingLoads[ code ];
			deferred.resolve( cachedDictionaries[ code ] );
		} )
		.fail( () => {
			delete pendingLoads[ code ];
			deferred.resolve( getFallback() );
		} );
	return deferred.promise();
};

const translate = function ( key, langCode, parameters = {} ) {
	const dictionary = cachedDictionaries[ langCode || getLangCode() ] || {};
	const message = dictionary[ key ] || getFallback()[ key ] || key;
	return String( message ).replace( /\{(\w+)\}/g, ( match, name ) => parameters[ name ] === undefined ? match : parameters[ name ] );
};

// TemplateData can contain multilingual labels; profile descriptors can reference i18n keys.
const metadataText = function ( data, property ) {
	if ( !data ) {
		return '';
	}
	if ( data[ property + 'Key' ] ) {
		return translate( data[ property + 'Key' ] );
	}
	const values = data[ property ];
	return typeof values === 'string' ? values : values &&
		( values[ getLangCode() ] || values[ config.i18n.fallbackLanguage ] || Object.values( values )[ 0 ] ) || '';
};

export default { t: translate, getLangCode, load: loadLanguage, metadataText };
// </nowiki>
