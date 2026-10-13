import i18n from '@services/i18n.js';
import config from '@constants/config.js';
import { isShellTemplateName } from '@services/templateShell.js';
import { stripAnyTemplateNs, normalizeTemplateName } from '@utils/wikitext.js';
// <nowiki>

// Build banner suggestions list for TopBarWidget
const buildBannerSuggestions = function ( banners ) {
	const removeBannerPrefix = function ( bannerName ) {
		const prefixes = config.bannerNamePrefixes || [];
		for ( const prefix of prefixes ) {
			if ( String( bannerName || '' ).toLowerCase().startsWith( String( prefix || '' ).toLowerCase() ) ) {
				return bannerName.slice( prefix.length );
			}
		}
		return bannerName;
	};
	return [
		...( banners.withRatings || [] ).map( ( name ) => ( { label: removeBannerPrefix( name ), data: { name } } ) ),
		...( banners.withoutRatings || [] ).map( ( name ) => ( { label: removeBannerPrefix( name ), data: { name, withoutRatings: true } } ) ),
		...( banners.wrappers || [] ).map( ( name ) => ( { label: removeBannerPrefix( name ) + ' [' + i18n.t( 'banner-wrapper' ) + ']', data: { name, wrapper: true } } ) ),
		...( banners.notWPBM || [] ).map( ( name ) => ( { label: removeBannerPrefix( name ), data: { name } } ) ),
		...( banners.inactive || [] ).map( ( name ) => ( { label: removeBannerPrefix( name ) + ' [' + i18n.t( 'banner-inactive' ) + ']', data: { name, withoutRatings: true } } ) ),
		...( banners.wir || [] ).map( ( name ) => ( { label: name + ' [' + i18n.t( 'banner-wir' ) + ']', data: { name, withoutRatings: true } } ) )
	].filter( ( suggestion ) => !isShellTemplateName( suggestion.data.name ) && !( config.bannerExclusions || [] )
		.some( ( name ) => normalizeTemplateName( stripAnyTemplateNs( name ) ).toLowerCase() === normalizeTemplateName( stripAnyTemplateNs( suggestion.data.name ) ).toLowerCase() ) );
};

// Infer default class/importance from ORES and preferences
const inferDefaults = function ( params ) {
	const oresClass = params && params.oresClass;
	const preferences = params && params.prefs || {};
	const result = { overallClass: null, overallImportance: null };
	if ( preferences.autofillClassFromOres && oresClass ) {
		result.overallClass = oresClass;
	}
	return result;
};

const makeListAs = function ( subjectTitle ) {
	let name = subjectTitle.getMainText().replace( /\s\(.*\)/, '' );
	if ( !name.includes( ' ' ) ) {
		return name;
	}
	let generationalSuffix = '';
	if ( config.sortKey.suffixPatterns.some( ( pattern ) => new RegExp( pattern ).test( name ) ) ) {
		generationalSuffix = name.slice( name.lastIndexOf( ' ' ) );
		name = name.slice( 0, name.lastIndexOf( ' ' ) );
		if ( !name.includes( ' ' ) ) {
			return name + generationalSuffix;
		}
	}
	const lastName = name.slice( name.lastIndexOf( ' ' ) + 1 ).replace( /,$/, '' );
	const otherNames = name.slice( 0, name.lastIndexOf( ' ' ) );
	return lastName + ', ' + otherNames + generationalSuffix;
};

const addMissingParams = function ( template ) {
	const subjectTitle = mw.Title.newFromText( config.mw.wgPageName ).getSubjectPage();

	// Fill the configured sort-key parameter for configured biography banners.
	const isBiographyBanner = ( config.shell.biographyBannerNames || [] ).includes( template.getTitle().getMainText() ) ||
		( template.redirectTarget && ( config.shell.biographyBannerNames || [] ).includes( template.redirectTarget.getMainText() ) );
	if ( isBiographyBanner && config.sortKey.parameter && !template.getParam( config.sortKey.parameter ) ) {
		template.parameters.push( { name: config.sortKey.parameter, value: makeListAs( subjectTitle ), autofilled: true } );
	}

	// Ensure required/suggested params
	$.each( template.paramData || {}, ( paraName, paraData ) => {
		if ( ( paraData.required || paraData.suggested ) && !template.getParam( paraName ) ) {
			if ( paraData.aliases && paraData.aliases.length ) {
				const aliases = ( template.parameters || [] ).filter( ( p ) => paraData.aliases.includes( p.name ) && p.value );
				if ( aliases.length ) {
					return;
				}
			}
			template.parameters.push( { name: paraName, value: paraData.autovalue || null, autofilled: true } );
		}
	} );
	return template;
};

export { buildBannerSuggestions, inferDefaults, addMissingParams };
// </nowiki>
