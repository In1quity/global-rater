import * as cache from '@services/cache.js';
import API from '@services/api.js';
import config from '@constants/config.js';
import logger from '@services/logger.js';
// <nowiki>

const log = logger.get( 'templateData' );

// Fetch and cache TemplateData for a template title (prefixed or not)
const getTemplateData = function ( prefixedTitle ) {
	const title = String( prefixedTitle || '' );
	const key = title + '-templatedata';
	const cached = cache.read( key );
	if ( cached && cached.value && cached.staleDate && !config.forceBypassCache ) {
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
			return $.Deferred().resolve( { notemplatedata: true, params: config.defaultParameterData, paramOrder: [], paramAliases: {} } );
		}
		const params = page.params || {};
		const paramOrder = page.paramOrder || Object.keys( params );
		const value = { notemplatedata: false, params, paramOrder };
		cache.write( key, value, 1 );
		return value;
	} ).catch( () => ( { notemplatedata: true, params: config.defaultParameterData, paramOrder: [], paramAliases: {} } ) );
};

// High-level helper that returns fully processed TD payload for Template.js
// Includes: paramData, parameterSuggestions, paramAliases, classParamName, importanceParamName, notemplatedata
const getTemplateDataDetails = function ( prefixedTitle ) {
	const title = String( prefixedTitle || '' );
	const key = title + '-params';
	const cached = cache.read( key );
	if ( cached && cached.value && cached.staleDate && !config.forceBypassCache ) {
		return $.Deferred().resolve( cached.value );
	}
	return getTemplateData( title ).then( ( base ) => {
		const result = {
			notemplatedata: !!( !base || base.notemplatedata ),
			paramData: ( base && base.params ) || ( config && config.defaultParameterData ) || {},
			parameterSuggestions: [],
			paramAliases: {},
			classParamName: 'class',
			importanceParamName: 'importance'
		};
		// Build aliases map from paramData
		$.each( result.paramData, ( paraName, paraData ) => {
			if ( paraData && Array.isArray( paraData.aliases ) ) {
				paraData.aliases.forEach( ( alias ) => {
					result.paramAliases[ alias ] = paraName;
				} );
			}
			// Try to extract allowed values from description when not provided explicitly
			if ( paraData && paraData.description && /\[.*'.+?'.*?\]/.test( paraData.description.en ) ) {
				try {
					const allowedVals = JSON.parse(
						paraData.description.en
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
		let className = findByNameOrAlias( 'class' );
		let importanceName = findByNameOrAlias( 'importance' );
		if ( !className ) {
			const keys = Object.keys( result.paramData || {} );
			className = keys.find( ( k ) => /class/i.test( String( k ).toLowerCase() ) );
		}
		if ( !importanceName ) {
			const keys2 = Object.keys( result.paramData || {} );
			importanceName = keys2.find( ( k ) => /importance/i.test( String( k ).toLowerCase() ) );
		}
		result.classParamName = className || 'class';
		result.importanceParamName = importanceName || 'importance';

		// Build suggestions list using paramOrder if present
		const order = ( base && base.paramOrder ) || Object.keys( result.paramData );
		const filtered = order.filter( ( name ) => ( name && name !== 'class' && name !== 'importance' ) );
		result.parameterSuggestions = filtered.map( ( paramName ) => {
			const optionObject = { data: paramName };
			const pd = result.paramData[ paramName ];
			const label = pd && pd.label && pd.label.en;
			if ( label ) {
				optionObject.label = label + ' (|' + paramName + '=)';
			}
			return optionObject;
		} );

		cache.write( key, result, 1 );
		return result;
	} );
};

export { getTemplateData, getTemplateDataDetails };
// </nowiki>
