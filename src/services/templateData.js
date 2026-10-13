import * as cache from '@services/cache.js';
import API from '@services/api.js';
import config from '@constants/config.js';
import logger from '@services/logger.js';
import i18n from '@services/i18n.js';
// <nowiki>

const log = logger.get( 'templateData' );

const makeFallbackTemplateData = () => ( {
	notemplatedata: true,
	params: config.defaultParameterData,
	paramOrder: Object.keys( config.defaultParameterData ),
	paramAliases: {}
} );

// Fetch and cache TemplateData for a template title (prefixed or not)
const getTemplateData = function ( prefixedTitle ) {
	const title = String( prefixedTitle || '' );
	const key = title + '-templatedata';
	const cached = cache.read( key );
	if ( cached && cached.value && !cached.value.notemplatedata && cached.staleDate && !config.forceBypassCache ) {
		return $.Deferred().resolve( cached.value );
	}
	return API.get( {
		action: 'templatedata',
		titles: title,
		redirects: 1,
		includeMissingTitles: 1
	} ).then( ( result ) => {
		const id = result && $.map( result.pages, ( _value, k ) => k );
		const page = result && result.pages && result.pages[ id ];

		// Log API response
		try {
			log.debug( 'TemplateData API response for "%s":', title );
			if ( !page ) {
				log.debug( '  → no page data returned' );
			} else if ( page.notemplatedata ) {
				log.debug( '  → notemplatedata: true (no TemplateData extension data)' );
			} else if ( !page.params ) {
				log.debug( '  → no params in response' );
			} else {
				const paramCount = Object.keys( page.params ).length;
				log.debug( '  → received %d parameters from API', paramCount );
			}
		} catch ( _e ) { /* ignore */ }

		if ( !page || page.notemplatedata || !page.params ) {
			return makeFallbackTemplateData();
		}
		const params = page.params || {};
		const paramOrder = page.paramOrder || Object.keys( params );
		const value = { notemplatedata: false, params, paramOrder };
		cache.write( key, value, 1 );
		return value;
	} ).catch( makeFallbackTemplateData );
};

// High-level helper that returns fully processed metadata for banner models
// Includes: paramData, parameterSuggestions, paramAliases, classParamName, importanceParamName, notemplatedata
const getTemplateDataDetails = function ( prefixedTitle ) {
	const title = String( prefixedTitle || '' );
	const key = title + '-params-v3-' + JSON.stringify( config.assessmentParameters ) + '-' + i18n.getLangCode();
	const cached = cache.read( key );
	if ( cached && cached.value && !cached.value.notemplatedata && cached.staleDate && !config.forceBypassCache ) {
		return $.Deferred().resolve( cached.value );
	}
	return getTemplateData( title ).then( ( base ) => {
		const result = {
			notemplatedata: !!( !base || base.notemplatedata ),
			paramData: ( base && base.params ) || ( config && config.defaultParameterData ) || {},
			parameterSuggestions: [],
			paramAliases: {},
			classParamName: config.bannerDefaults.classParamName,
			importanceParamName: config.bannerDefaults.importanceParamName
		};
		// Build aliases map from paramData
		$.each( result.paramData, ( paraName, paraData ) => {
			if ( paraData && Array.isArray( paraData.aliases ) ) {
				paraData.aliases.forEach( ( alias ) => {
					result.paramAliases[ alias ] = paraName;
				} );
			}
			// Try to extract allowed values from description when not provided explicitly
			const description = paraData && Object.values( paraData.description || {} ).find( ( text ) => /\[.*'.+?'.*?\]/.test( text ) );
			if ( paraData && !paraData.allowedValues && description ) {
				try {
					const allowedVals = JSON.parse(
						description
							.replace( /^.*\[/, '[' )
							.replace( /"/g, '\\"' )
							.replace( /'/g, '"' )
							.replace( /,\s*]/, ']' )
							.replace( /].*$/, ']' )
					);
					result.paramData[ paraName ].allowedValues = allowedVals;
				} catch ( e ) { /* ignore parse issues */ }
			}
		} );
		// Compute canonical names
		const findByNameOrAlias = function ( target ) {
			const lcTarget = String( target || '' ).toLowerCase();
			for ( const keyName in result.paramData ) {
				if ( Object.prototype.hasOwnProperty.call( result.paramData, keyName ) ) {
					if ( String( keyName ).toLowerCase() === lcTarget ) {
						return keyName;
					}
				}
			}
			for ( const alias in result.paramAliases ) {
				if ( Object.prototype.hasOwnProperty.call( result.paramAliases, alias ) ) {
					if ( String( alias ).toLowerCase() === lcTarget ) {
						return result.paramAliases[ alias ];
					}
				}
			}
			return null;
		};
		result.classParamName = config.assessmentParameters.class.map( findByNameOrAlias ).find( Boolean ) || config.bannerDefaults.classParamName;
		result.importanceParamName = config.assessmentParameters.importance.map( findByNameOrAlias ).find( Boolean ) || config.bannerDefaults.importanceParamName;

		// Build suggestions list using paramOrder if present
		const order = ( base && base.paramOrder ) || Object.keys( result.paramData );
		const filtered = order.filter( ( name ) => name &&
			( result.paramAliases[ name ] || name ) !== result.classParamName &&
			( result.paramAliases[ name ] || name ) !== result.importanceParamName );
		result.parameterSuggestions = filtered.map( ( paramName ) => {
			const optionObject = { data: paramName };
			const pd = result.paramData[ paramName ];
			const label = i18n.metadataText( pd, 'label' );
			if ( label ) {
				optionObject.label = label + ' (|' + paramName + '=)';
			}
			return optionObject;
		} );

		// Fallback schemas depend on wiki configuration and must not outlive it in storage.
		if ( !result.notemplatedata ) {
			cache.write( key, result, 1 );
		}
		return result;
	} );
};

export { getTemplateData, getTemplateDataDetails };
// </nowiki>
