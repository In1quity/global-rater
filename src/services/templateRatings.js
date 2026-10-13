import API from '@services/api.js';
import config from '@constants/config.js';
import * as cache from '@services/cache.js';
import { isShellTemplate } from '@services/templateShell.js';
// <nowiki>

const loadRatings = function ( template ) {
	const done = $.Deferred();

	if ( isShellTemplate( template ) ) {
		template.classes = [ ...config.bannerDefaults.classes ];
		template.importances = [];
		return done.resolve();
	} else if ( ( template.classes && template.importances ) || template.withoutRatings ) {
		return done.resolve();
	}

	const mainText = template.getTitle().getMainText();

	// Prefer TemplateData-defined values when available
	const tdClasses = ( template.getDataForParam && ( template.getDataForParam( 'suggestedvalues', template.classParamName ) || template.getDataForParam( 'allowedValues', template.classParamName ) ) );
	const tdImportances = ( template.getDataForParam && ( template.getDataForParam( 'suggestedvalues', template.importanceParamName ) || template.getDataForParam( 'allowedValues', template.importanceParamName ) ) );
	if ( Array.isArray( tdClasses ) && tdClasses.length ) {
		template.classes = tdClasses;
	}
	if ( Array.isArray( tdImportances ) && tdImportances.length ) {
		template.importances = tdImportances;
	}
	if ( ( template.paramData && template.paramData[ template.importanceParamName ] ) && ( !Array.isArray( template.importances ) || template.importances.length === 0 ) ) {
		template.importances = config.bannerDefaults.importances.slice();
	}
	if ( Array.isArray( template.classes ) && template.classes.length && Array.isArray( template.importances ) && template.importances.length ) {
		cache.write( mainText + '-ratings', { classes: template.classes, importances: template.importances }, 1 );
		return done.resolve();
	}

	const redirectTargetOrMainText = template.redirectTarget ? template.redirectTarget.getMainText() : mainText;
	if ( config.customBanners[ redirectTargetOrMainText ] ) {
		template.classes = config.customBanners[ redirectTargetOrMainText ].classes;
		template.importances = config.customBanners[ redirectTargetOrMainText ].importances;
		return done.resolve();
	}

	const cachedRatings = cache.read( mainText + '-ratings' );
	if (
		cachedRatings &&
		cachedRatings.value &&
		cachedRatings.staleDate &&
		cachedRatings.value.classes !== null && cachedRatings.value.classes !== undefined &&
		cachedRatings.value.importances !== null && cachedRatings.value.importances !== undefined
	) {
		template.classes = cachedRatings.value.classes;
		template.importances = cachedRatings.value.importances;
		const cacheHasImportances = Array.isArray( template.importances ) && template.importances.length > 0;
		if ( cacheHasImportances ) {
			done.resolve();
		}
	}

	let wikitextToParse = '';
	const classKey = template.classParamName || config.bannerDefaults.classParamName;
	const importanceKey = template.importanceParamName || config.bannerDefaults.importanceParamName;
	if ( !config.ratingDetection.parseTitle || ( !config.ratingDetection.classCategoryPattern && !config.ratingDetection.importanceCategoryPattern ) ) {
		template.classes = template.classes || ( classKey ? config.bannerDefaults.classes.slice() : [] );
		template.importances = template.importances || ( importanceKey ? config.bannerDefaults.importances.slice() : [] );
		return done.resolve();
	}
	config.bannerDefaults.extendedClasses.forEach( ( classname, index ) => {
		wikitextToParse += '{{' + mainText + '|' + classKey + '=' + classname + '|' + importanceKey + '=' + ( config.bannerDefaults.extendedImportances[ index ] || '' ) + '}}\n';
	} );

	return API.get( {
		action: 'parse',
		title: config.ratingDetection.parseTitle,
		text: wikitextToParse,
		prop: 'categorieshtml'
	} )
		.then( ( result ) => {
			const catsHtml = result.parse.categorieshtml[ '*' ];
			const extendedClasses = config.bannerDefaults.extendedClasses.filter( ( cl ) => config.ratingDetection.classCategoryPattern && catsHtml.includes( config.ratingDetection.classCategoryPattern.replace( /\{value\}/g, cl ) ) );
			template.classes = [ ...config.bannerDefaults.classes, ...extendedClasses ];
			template.importances = config.bannerDefaults.extendedImportances.filter( ( imp ) => config.ratingDetection.importanceCategoryPattern && catsHtml.includes( config.ratingDetection.importanceCategoryPattern.replace( /\{value\}/g, imp ) ) );
			cache.write( mainText + '-ratings', { classes: template.classes, importances: template.importances }, 1 );
			return true;
		} );
};

export { loadRatings };
// </nowiki>
