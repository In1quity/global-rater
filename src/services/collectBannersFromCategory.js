import API from '@services/api.js';
import { isAfterDate, uniqueArray } from '@utils/util.js';
import * as cache from '@services/cache.js';
import config from '@constants/config.js';
import { normalizeTemplateName, stripNamespacePrefix } from '@utils/wikitext.js';
import logger from '@services/logger.js';
// <nowiki>

const log = logger.get( 'collectBannersFromCategory' );
const dlog = function () {
	try {
		log.debug.apply( null, arguments );
	} catch ( _e ) {}
};

const cacheBanners = function ( banners ) {
	cache.write( 'banners', { source: config.categories, banners }, 2, 60 );
};

/**
 * Gets banners/options from the Api
 *
 * @returns {Promise} Resolved with: banners object, bannerOptions array
 */
const getListOfBannersFromApi = function () {

	const finishedPromise = $.Deferred();
	try {
		dlog( 'Start getListOfBannersFromApi' );
	} catch ( e ) { /* ignore */ }

	// Template namespace is supplied by the current wiki.
	const templateNsName = ( config.mw && config.mw.wgFormattedNamespaces && ( config.mw.wgFormattedNamespaces[ 10 ] || 'Template' ) ) || 'Template';
	try {
		dlog( 'Using template NS:', templateNsName );
	} catch ( e ) { /* ignore */ }

	const categories = Object.keys( config.categories )
		.map( ( abbreviation ) => ( {
			title: config.categories[ abbreviation ],
			abbreviation: abbreviation,
			banners: [],
			processed: $.Deferred()
		} ) )
		// Filter out categories without titles to avoid API errors on other wikis
		.filter( ( cat ) => !!cat.title );
	try {
		dlog( 'Root categories:', categories.map( ( c ) => c.title + ' (' + c.abbreviation + ')' ) );
	} catch ( e ) { /* ignore */ }

	// Edge case: no categories configured
	if ( categories.length === 0 ) {
		const base = { withRatings: [], withoutRatings: [], wrappers: [], notWPBM: [], inactive: [], wir: [] };
		return $.Deferred().resolve( base );
	}

	// Recursively collect all template pages (ns 10) from a category and its subcategories
	const collectTemplatesRecursively = function ( rootCategoryTitle ) {
		const outTitles = [];
		const queue = [];
		const seen = Object.create( null );
		if ( rootCategoryTitle ) {
			queue.push( rootCategoryTitle );
		}

		function queryOne( catTitle, cont ) {
			const params = {
				action: 'query',
				format: 'json',
				list: 'categorymembers',
				cmtitle: catTitle,
				cmprop: 'title|ns',
				cmtype: 'page|subcat',
				cmlimit: '500'
			};
			if ( cont ) {
				$.extend( params, cont );
			}
			return API.get( params ).then( ( result ) => {
				try {
					dlog( 'Fetched:', catTitle, 'members:', ( result && result.query && result.query.categorymembers && result.query.categorymembers.length ) || 0, result && result.continue ? '(cont)' : '' );
				} catch ( e ) { /* ignore */ }
				const members = ( result && result.query && result.query.categorymembers ) || [];
				members.forEach( ( m ) => {
					let title = String( m && m.title || '' );
					if ( m && m.ns === 10 ) {
						// Strip namespace via utility (uses aliases/config)
						title = stripNamespacePrefix( title, [ templateNsName, 'Template' ] );
						outTitles.push( normalizeTemplateName( title ) );
					} else if ( m && m.ns === 14 && !seen[ title ] ) {
						queue.push( title );
					}
				} );
				if ( result && result.continue ) {
					return queryOne( catTitle, result.continue );
				}
			} );
		}

		function step() {
			if ( !queue.length ) {
				const list = uniqueArray( outTitles );
				try {
					dlog( 'Category traversal finished. Unique templates:', list.length );
				} catch ( e ) { /* ignore */ }
				return $.Deferred().resolve( list ).promise();
			}
			const next = queue.shift();
			if ( seen[ next ] ) {
				return step();
			}
			seen[ next ] = true;
			try {
				dlog( 'Traverse subcategory:', next, 'queue:', queue.length );
			} catch ( e ) { /* ignore */ }
			return queryOne( next ).then( step, step );
		}

		return step();
	};

	categories.forEach( ( cat, index, arr ) => {
		$.when( arr[ index - 1 ] && arr[ index - 1 ].processed || true ).then( () => {
			collectTemplatesRecursively( cat.title )
				.then( ( titles ) => {
					categories[ index ].banners = titles || [];
					try {
						dlog( 'Collected for', cat.title, ':', ( titles || [] ).length );
						log.debug( 'Found %d templates in %s:', ( titles || [] ).length, cat.title );
						( titles || [] ).forEach( ( template, i ) => log.debug( '  %d. %s', i + 1, template ) );
					} catch ( e ) { /* ignore */ }
				} )
				.always( () => {
					categories[ index ].processed.resolve();
				} );
		} );
	} );

	categories[ categories.length - 1 ].processed.then( () => {
		const base = { withRatings: [], withoutRatings: [], wrappers: [], notWPBM: [], inactive: [], wir: [] };
		categories.forEach( ( catObject ) => {
			base[ catObject.abbreviation ] = catObject.banners;
		} );
		try {
			dlog( 'Final groups:', Object.keys( base ).map( ( k ) => k + ':' + ( base[ k ] || [] ).length ) );
			Object.keys( base ).forEach( ( k ) => {
				const arr = base[ k ] || [];
				log.debug( '%s (%d):', k, arr.length );
				arr.forEach( ( t, i ) => log.debug( '  %d. %s', i + 1, t ) );
			} );
		} catch ( e ) { /* ignore */ }
		finishedPromise.resolve( base );
	} );

	return finishedPromise;
};

/**
 * Gets banners from cache, if there and not too old
 *
 * @returns {Promise} Resolved with banners object
 */
const getBannersFromCache = function () {
	const cachedBanners = cache.read( 'banners' );
	if (
		!cachedBanners ||
		!cachedBanners.value ||
		!cachedBanners.value.banners ||
		JSON.stringify( cachedBanners.value.source ) !== JSON.stringify( config.categories ) ||
		!cachedBanners.staleDate
	) {
		try {
			dlog( 'Cache miss: banners' );
		} catch ( e ) { /* ignore */ }
		return $.Deferred().reject();
	}
	if ( isAfterDate( cachedBanners.staleDate ) ) {
		// Update in the background; still use old list until then
		try {
			dlog( 'Cache stale: refreshing in background' );
		} catch ( e ) { /* ignore */ }
		getListOfBannersFromApi().then( cacheBanners );
	}
	try {
		dlog( 'Cache hit: banners' );
		// Also print cached groups and items for debugging
		const b = cachedBanners.value.banners;
		const groups = [ 'withRatings', 'withoutRatings', 'wrappers', 'notWPBM', 'inactive', 'wir' ];
		groups.forEach( ( k ) => {
			const arr = b[ k ] || [];
			log.debug( '%s (%d):', k, arr.length );
			arr.forEach( ( t, i ) => log.debug( '  %d. %s', i + 1, t ) );
		} );
	} catch ( e ) { /* ignore */ }
	return $.Deferred().resolve( cachedBanners.value.banners );
};

/**
 * Gets banner names, grouped by type (withRatings, withoutRatings, wrappers, notWPBM)
 * @returns {Promise<Object>} Object of string arrays keyed by type (withRatings, withoutRatings, wrappers, notWPBM)
 */
const getBannerNames = () => getBannersFromCache()
	.then( ( banners ) => {
		// Ensure all keys exist
		if ( !banners.withRatings || !banners.withoutRatings || !banners.wrappers || !banners.notWPBM || !banners.inactive || !banners.wir ) {
			getListOfBannersFromApi().then( cacheBanners );
			return $.extend(
				{ withRatings: [], withoutRatings: [], wrappers: [], notWPBM: [], inactive: [], wir: [] },
				banners
			);
		}
		// Success: pass through
		return banners;
	} )
	.catch( () => {
		// Failure: get from Api, then cache them
		const bannersPromise = getListOfBannersFromApi();
		bannersPromise.then( cacheBanners );
		return bannersPromise;
	} );

export { getBannerNames };
// </nowiki>
