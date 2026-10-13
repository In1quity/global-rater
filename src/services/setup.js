import config from '@constants/config.js';
import i18n from '@services/i18n.js';
import API from '@services/api.js';
import { Template } from '@utils/models/TemplateModel.js';
import { getShellTemplateAliases } from '@services/templateShell.js';
import { loadParamDataAndSuggestions } from '@services/templateParams.js';
import { loadRatings } from '@services/templateRatings.js';
import { addMissingParams } from '@services/autofill.js';
import { getWithRedirectTo } from '@services/templateRedirects.js';
import { stripNamespacePrefix, normalizeTemplateName } from '@utils/wikitext.js';
import { findBannerTemplatesOnTalk } from '@services/templateScanner.js';
// Aliases utilities (namespace-aware)
import { collectAliasesForNames } from '@utils/aliases.js';
import { getBannerNames } from '@services/collectBannersFromCategory.js';
import * as cache from '@services/cache.js';
import windowManager from '@services/windowManager.js';
import { openLoadDialogCodex } from '@components/LoadDialog.js';
import { getPrefs } from '@services/prefs.js';
import logger from '@services/logger.js';
import { filterAndMap } from '@utils/util.js';
import { fetchTalkWikitext, fetchLatestRevId } from '@services/pageContent.js';
import { getPrediction as getOresPrediction } from '@services/ores.js';
import { checkSubjectFeatures } from '@services/subjectPage.js';
// <nowiki>

const log = logger.get( 'setup' );

const setupRater = function ( clickEvent ) {
	if ( clickEvent ) {
		clickEvent.preventDefault();
	}

	const setupCompletedPromise = $.Deferred();

	const currentPage = mw.Title.newFromText( config.mw.wgPageName );
	const talkPage = currentPage && currentPage.getTalkPage();
	const subjectPage = currentPage && currentPage.getSubjectPage();
	const subjectIsArticle = config.mw.wgNamespaceNumber <= 1;

	// Get preferences (task 0)
	const prefsPromise = getPrefs();

	// Get lists of all banners (task 1)
	const bannersPromise = $.when( getBannerNames(), getShellTemplateAliases() ).then( ( banners ) => banners );

	// Load talk page (task 2)
	const loadTalkPromise = fetchTalkWikitext( talkPage.getPrefixedText() );

	// Parse talk page for banners (task 3)
	const parseTalkPromise = loadTalkPromise.then( ( wikitext ) => bannersPromise.then( ( allBanners ) => findBannerTemplatesOnTalk( {
		wikitext,
		allBanners,
		namespaceAliases: config.templateNamespaceAliases || [],
		shellTemplate: config && config.shellTemplate,
		bannerNamePrefixes: config.bannerNamePrefixes || []
	} )
	) );

	// Retrieve and store TemplateData first, then classes/importances (task 4)
	const templateDetailsPromise = parseTalkPromise.then( ( templates ) => {
		const perTemplate = templates.map( ( template ) => loadParamDataAndSuggestions( template ).then( () => loadRatings( template ) ) );
		return Promise.all( perTemplate ).then( () => {
			templates.forEach( ( t ) => {
				addMissingParams( t );
			} );
			return templates;
		} );
	} );

	// Check subject page features (task 5) - but don't error out if request fails
	const subjectPageCheckPromise = checkSubjectFeatures( subjectPage.getPrefixedText(), subjectIsArticle, config.subjectPageCategories )
		.then( ( res ) => {
			if ( res && res.redirectTarget ) {
				return res;
			}
			if ( res ) {
				return Object.assign( {}, res, { isList: !res.isFL && /^Lists? of/.test( subjectPage.getPrefixedText() ) } );
			}
			return res;
		} );

	// Retrieve rating from ORES (task 6, only needed for articles) - but don't error out if request fails
	const shouldGetOres = ( subjectIsArticle ); // TODO: Don't need to get ORES for redirects or disambigs
	let oresPromise = null;
	if ( shouldGetOres ) {
		const latestRevIdPromise = !currentPage.isTalkPage() ?
			Promise.resolve( config.mw.wgRevisionId ) :
			fetchLatestRevId( subjectPage.getPrefixedText() );
		oresPromise = latestRevIdPromise.then( ( latestRevId ) => getOresPrediction( latestRevId ) );
	}

	// Open the load dialog (Codex) and keep a handle to unmount later
	const dialogPromises = [
		// Align with tasks order in LoadDialogCodex (0..6)
		prefsPromise,
		bannersPromise,
		loadTalkPromise,
		parseTalkPromise,
		templateDetailsPromise,
		subjectPageCheckPromise,
		shouldGetOres && oresPromise
	];
	log.debug( 'openLoadDialogCodex', {
		shouldGetOres: shouldGetOres,
		length: dialogPromises.length,
		types: dialogPromises.map( ( p ) => ( p ? typeof p.then : 'falsy' ) )
	} );
	const loadDialogMountPromise = openLoadDialogCodex( {
		promises: dialogPromises,
		ores: shouldGetOres
	} );

	Promise.allSettled( [
		prefsPromise,
		loadTalkPromise,
		templateDetailsPromise,
		bannersPromise,
		subjectPageCheckPromise,
		shouldGetOres ? oresPromise : Promise.resolve( null )
	] ).then(
		// All succeded
		( settled ) => {
			log.debug( 'allSettled statuses', settled.map( ( s, i ) => ( { i, status: s && s.status } ) ) );
			const preferences = settled[ 0 ] && settled[ 0 ].status === 'fulfilled' ? settled[ 0 ].value : null;
			const talkWikitext = settled[ 1 ] && settled[ 1 ].status === 'fulfilled' ? settled[ 1 ].value : null;
			const banners = settled[ 2 ] && settled[ 2 ].status === 'fulfilled' ? settled[ 2 ].value : null; // parsed templates list
			const bannerNames = settled[ 3 ] && settled[ 3 ].status === 'fulfilled' ? settled[ 3 ].value : null; // list of all banner names
			const subjectPageCheck = settled[ 4 ] && settled[ 4 ].status === 'fulfilled' ? settled[ 4 ].value : null;
			const oresPredicition = settled[ 5 ] && settled[ 5 ].status === 'fulfilled' ? settled[ 5 ].value : null;
			const result = {
				success: true,
				talkpage: talkPage,
				subjectPage: subjectPage,
				talkWikitext: talkWikitext,
				banners: banners,
				bannerNames: bannerNames,
				preferences: preferences,
				isArticle: subjectIsArticle
			};
			if ( subjectPageCheck ) {
				for ( const key in subjectPageCheck ) {
					if ( Object.prototype.hasOwnProperty.call( subjectPageCheck, key ) ) {
						result[ key ] = subjectPageCheck[ key ];
					}
				}
			}
			// Pass ORES data through when available (keep compatibility with consumers)
			if ( oresPredicition ) {
				result.ores = oresPredicition;
			}
			log.debug( 'result summary', {
				banners: result.banners ? result.banners.length : 0,
				bannerNames: result.bannerNames ? result.bannerNames.length : 0,
				preferences: !!result.preferences,
				isArticle: result.isArticle,
				pageInfo: !!result.pageInfo,
				resoresPresent: !!result.ores
			} );
			// Close Codex dialog gracefully: toggle open=false to let Codex clean up body classes, then unmount
			loadDialogMountPromise.then( ( m ) => {
				try {
					// Defocus before hiding to avoid aria-hidden on focused descendant
					const active = document.activeElement;
					if ( active && typeof active.blur === 'function' ) {
						active.blur();
					}
					if ( m && m.app ) {
						m.app.open = false;
					}
				} catch ( _ ) {}
				setTimeout( () => {
					try {
						m.unmount();
					} catch ( _ ) {}
				}, 150 );
			} );
			setupCompletedPromise.resolve( result );

		}
	).catch( ( err ) => {
		const code = err && err.code;
		const info = err;
		setupCompletedPromise.reject( code, info );
		cache.clearInvalidItems();
	} );
	// Cleanup cache on success path too
	setupCompletedPromise.always( () => {
		cache.clearInvalidItems();
	} );
	return setupCompletedPromise;
};

export default setupRater;
// </nowiki>
