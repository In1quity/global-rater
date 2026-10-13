import API from '@services/api.js';
import config from '@constants/config.js';
// <nowiki>

const checkSubjectFeatures = function ( subjectPrefixedTitle, subjectIsArticle, categoriesConfig ) {
	const patterns = config.subjectPageCategoryPatterns;
	const hasPatterns = Object.values( patterns ).some( ( values ) => values.length );
	const categories = [];
	let redirectTarget = false;
	const read = ( continuation ) => API.get( Object.assign( {
		action: 'query', format: 'json', formatversion: '2', prop: 'categories',
		titles: subjectPrefixedTitle, redirects: 1, cllimit: 'max'
	}, hasPatterns ? {} : { clcategories: Object.values( categoriesConfig ).filter( Boolean ) }, continuation ) ).then( ( response ) => {
		if ( !response || !response.query || !response.query.pages ) {
			return null;
		}
		redirectTarget = response.query.redirects && response.query.redirects[ 0 ].to || redirectTarget;
		const page = Object.values( response.query.pages )[ 0 ];
		categories.push( ...( page.categories || [] ).map( ( category ) => category.title ) );
		if ( response.continue ) {
			return read( response.continue );
		}
		if ( redirectTarget || !subjectIsArticle ) {
			return { redirectTarget };
		}
		const hasCategory = ( kind ) => categories.includes( categoriesConfig[ kind ] ) ||
			( patterns[ kind ] || [] ).some( ( pattern ) => categories.some( ( title ) => new RegExp( pattern ).test( title ) ) );
		return {
			redirectTarget, disambig: hasCategory( 'disambig' ), stubtag: hasCategory( 'stub' ),
			isGA: hasCategory( 'goodArticle' ), isFA: hasCategory( 'featuredArticle' ), isFL: hasCategory( 'featuredList' )
		};
	} );
	return read().catch( () => null );
};

export { checkSubjectFeatures };
// </nowiki>
