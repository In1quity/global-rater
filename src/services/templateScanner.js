import { buildTemplateRegexFor, extractTemplateName, computeSectionBounds, stripNamespacePrefix, normalizeTemplateName, buildOpenRegexFor, findBlockRange } from '@utils/wikitext.js';
import { Template } from '@utils/models/TemplateModel.js';
import { isShellTemplate } from '@services/templateShell.js';
import { addNamespacePrefix } from '@utils/wikitext.js';
import { getCanonicalName } from '@services/templateRedirects.js';
import { getWithRedirectTo } from '@services/templateRedirects.js';
import { parseTemplates } from '@utils/parseTemplates.js';
import logger from '@services/logger.js';

const log = logger.get( 'templateScanner' );
// <nowiki>

// Scan templates by names with optional section bounds
const scanTemplates = function ( params ) {
	const content = String( params && params.content || '' );
	const names = ( params && params.names ) || [];
	const section = params && params.section;
	const namespaceAliases = ( params && params.namespaceAliases ) || [];
	const lines = content.split( '\n' );
	let text = content;
	if ( section ) {
		const bounds = computeSectionBounds( lines, section, '__TOP__' );
		if ( bounds.start === -1 ) {
			return [];
		}
		text = lines.slice( bounds.start, bounds.end ).join( '\n' );
	}
	// Debug: verify which names individually match the text
	try {
		const matched = [];
		const notMatched = [];
		( Array.isArray( names ) ? names : [ names ] ).forEach( ( nm ) => {
			if ( !nm ) {
				return;
			}
			const oneRe = buildTemplateRegexFor( [ nm ], namespaceAliases );
			if ( oneRe.test( text ) ) {
				matched.push( nm );
			} else {
				notMatched.push( nm );
			}
		} );
		log.debug( 'scanTemplates: matched %d/%d names; examples:', matched.length, ( Array.isArray( names ) ? names.length : ( names ? 1 : 0 ) ) );
		matched.slice( 0, 10 ).forEach( ( nm, i ) => log.debug( '  matched %d: %s', i + 1, nm ) );
		notMatched.slice( 0, 3 ).forEach( ( nm, i ) => log.debug( '  notMatched %d: %s', i + 1, nm ) );
	} catch ( _e ) { /* ignore */ }

	// Parse all templates recursively to find nested ones
	const targetSet = new Set( ( Array.isArray( names ) ? names : [ names ] )
		.filter( Boolean )
		.map( ( n ) => normalizeTemplateName( stripNamespacePrefix( n, namespaceAliases ) ) ) );
	const parsed = parseTemplates( text, true ) || [];
	try {
		log.debug( 'parseTemplates returned %d templates (recursive)', parsed.length );
		parsed.slice( 0, 10 ).forEach( ( tpl, i ) => {
			const nm = normalizeTemplateName( stripNamespacePrefix( tpl.name, namespaceAliases ) );
			const paramCount = ( tpl.parameters || [] ).length;
			log.debug( '  parsed %d: %s (%d params)', i + 1, nm, paramCount );
		} );
	} catch ( _e ) { /* ignore */ }
	const results = [];
	parsed.forEach( ( tpl ) => {
		const nm = normalizeTemplateName( stripNamespacePrefix( tpl.name, namespaceAliases ) );
		if ( targetSet.has( nm ) ) {
			results.push( { name: nm, wikitext: tpl.wikitext } );
		}
	} );
	log.debug( 'Found %d templates from scanTemplates:', results.length );
	results.forEach( ( result, i ) => log.debug( '  %d. %s', i + 1, result.name ) );
	return results;
};

// Build a unique list of template names from banner groups and optional shell template
const buildNameListFromBanners = function ( allBanners, shellTemplate, namespaceAliases ) {
	const names = []
		.concat( allBanners && allBanners.withRatings || [] )
		.concat( allBanners && allBanners.withoutRatings || [] )
		.concat( allBanners && allBanners.wrappers || [] )
		.concat( allBanners && allBanners.notWPBM || [] )
		.concat( allBanners && allBanners.inactive || [] )
		.concat( allBanners && allBanners.wir || [] );
	if ( shellTemplate ) {
		names.push( normalizeTemplateName( stripNamespacePrefix( shellTemplate, namespaceAliases || [] ) ) );
	}
	const uniq = Array.from( new Set( names ) );
	try {
		log.debug( 'buildNameListFromBanners: withRatings=%d withoutRatings=%d wrappers=%d notWPBM=%d inactive=%d wir=%d shell=%s → uniq=%d',
			( allBanners.withRatings || [] ).length,
			( allBanners.withoutRatings || [] ).length,
			( allBanners.wrappers || [] ).length,
			( allBanners.notWPBM || [] ).length,
			( allBanners.inactive || [] ).length,
			( allBanners.wir || [] ).length,
			shellTemplate ? String( shellTemplate ) : 'none',
			uniq.length );
		uniq.slice( 0, 10 ).forEach( ( nm, i ) => log.debug( '  uniq %d: %s', i + 1, nm ) );
	} catch ( _e ) { /* ignore */ }
	return uniq;
};

// High-level scan: build names list from banners and scan talk wikitext
const scanTalkBanners = function ( params ) {
	const wikitext = String( params && params.wikitext || '' );
	const allBanners = params && params.allBanners || {};
	const shellTemplate = params && params.shellTemplate;
	const namespaceAliases = params && params.namespaceAliases || [];
	const uniqNames = buildNameListFromBanners( allBanners, shellTemplate, namespaceAliases );
	try {
		log.debug( 'scanTalkBanners: scanning with %d names', uniqNames.length );
	} catch ( _e ) { /* ignore */ }
	return scanTemplates( { content: wikitext, names: uniqNames, namespaceAliases } );
};

export { scanTemplates, buildNameListFromBanners, scanTalkBanners };

// Maintenance-style: find RQ/shell-like blocks by open regex and '}}' closing line
const findShellBlocks = function ( params ) {
	const content = String( params && params.content || '' );
	const names = ( params && params.names ) || [];
	const section = params && params.section;
	const namespaceAliases = ( params && params.namespaceAliases ) || [];
	const topMarker = ( params && params.topMarker ) || '__TOP__';
	const lines = content.split( '\n' );
	let startIdx = 0;
	let endIdx = lines.length;
	if ( section ) {
		const b = computeSectionBounds( lines, section, topMarker );
		if ( b.start === -1 ) {
			return [];
		}
		startIdx = b.start;
		endIdx = b.end;
	}
	const openRe = buildOpenRegexFor( names, namespaceAliases );
	if ( !openRe ) {
		return [];
	}
	const ranges = [];
	let i = startIdx;
	while ( i < endIdx ) {
		const range = findBlockRange( lines, i, endIdx, openRe );
		if ( !range ) {
			break;
		}
		ranges.push( {
			start: range.start,
			end: range.end,
			wikitext: lines.slice( range.start, range.end + 1 ).join( '\n' )
		} );
		i = range.end + 1;
	}
	return ranges;
};

// High-level: extract banner Template instances from talk wikitext using maintenance-core style
const findBannerTemplatesOnTalk = function ( params ) {
	const wikitext = String( params && params.wikitext || '' );
	const allBanners = params && params.allBanners || {};
	const namespaceAliases = params && params.namespaceAliases || [];
	const shellTemplate = params && params.shellTemplate;
	const bannerNamePrefixes = Array.isArray( params && params.bannerNamePrefixes ) ? params.bannerNamePrefixes : [];

	// Step 1: scan by names derived from collectBanners and optional shell
	const found = scanTalkBanners( { wikitext, allBanners, shellTemplate, namespaceAliases } );

	// Step 2: map to Template instances with normalized name for downstream logic
	const templates = found.map( ( f ) => {
		const arr = parseTemplates( f.wikitext, false ) || [];
		const t = arr[ 0 ] || new Template( f.wikitext );
		t.setName( normalizeTemplateName( stripNamespacePrefix( f.name, namespaceAliases ) ) );
		return t;
	} );
	log.debug( 'Found %d templates from found templates:', templates.length );
	templates.forEach( ( template, i ) => {
		log.debug( '  %d. %s', i + 1, template.name );
		// Log parsed parameters from wikitext
		if ( template.parameters && template.parameters.length > 0 ) {
			log.debug( '    → parsed %d parameters:', template.parameters.length );
			template.parameters.forEach( ( param, idx ) => {
				const displayValue = String( param.value || '' ).length > 50 ?
					String( param.value || '' ).slice( 0, 47 ) + '...' :
					param.value;
				log.debug( '      %d. |%s=%s', idx + 1, param.name, displayValue );
			} );
		} else {
			log.debug( '    → no parameters parsed' );
		}
	} );

	// Step 3: resolve redirects/aliases, wrap into native Promise for await compatibility
	return new Promise( ( resolve ) => {
		try {
			log.debug( 'Resolving redirects for %d templates', templates.length );
		} catch ( _e ) { /* ignore */ }
		getWithRedirectTo( templates ).then( ( resolved ) => {
			// Prefer resolved only if it preserves Template instances; otherwise fallback to original templates
			const base = Array.isArray( resolved ) ? resolved : [ resolved ];
			const allHaveGetTitle = base.every( ( it ) => it && typeof it.getTitle === 'function' );
			const list = allHaveGetTitle ? base : templates;
			// Coerce any non-Template entries to Template instances to satisfy downstream expectations
			const templList = list.map( ( item ) => {
				if ( item && typeof item.getTitle === 'function' ) {
					return item;
				}
				const nameOrTitle = ( item && ( item.name || item.title ) ) || '';
				const tplWikitext = ( item && item.wikitext ) || ( nameOrTitle ? '{{' + nameOrTitle + '}}' : '' );
				const t = new Template( tplWikitext );
				if ( nameOrTitle ) {
					t.setName( normalizeTemplateName( stripNamespacePrefix( nameOrTitle, namespaceAliases ) ) );
				}
				return t;
			} );

			// Step 4: filter to banners and set flags
			const filtered = templList.filter( ( template ) => {
				// Shell template passes immediately
				if ( isShellTemplate( template ) ) {
					return true;
				}
				// Evaluate known banner lists
				const mainText = ( template.getTitle && typeof template.getTitle === 'function' ) ?
					getCanonicalName( template ) :
					stripNamespacePrefix( ( template.title || template.name || '' ), namespaceAliases );
				const isListed = ( allBanners.withRatings || [] ).includes( mainText ) ||
                ( allBanners.withoutRatings || [] ).includes( mainText ) ||
                ( allBanners.wrappers || [] ).includes( mainText ) ||
                ( allBanners.notWPBM || [] ).includes( mainText ) ||
                ( allBanners.inactive || [] ).includes( mainText ) ||
                ( allBanners.wir || [] ).includes( mainText );
				const hasKnownPrefix = bannerNamePrefixes.some( ( prefix ) => typeof prefix === 'string' && mainText && mainText.indexOf( prefix ) === 0 );
				return isListed || hasKnownPrefix;
			} ).map( ( template ) => {
				if ( isShellTemplate( template ) ) {
					return template;
				}
				const mainText = ( template.getTitle && typeof template.getTitle === 'function' ) ?
					getCanonicalName( template ) :
					'';
				if ( ( allBanners.wrappers || [] ).includes( mainText ) ) {
					template.redirectTarget = mw.Title.newFromText( addNamespacePrefix( 'Subst:' + mainText ) );
				}
				if ( ( allBanners.withoutRatings || [] ).includes( mainText ) || ( allBanners.wir || [] ).includes( mainText ) ) {
					template.withoutRatings = true;
				}
				if ( ( allBanners.inactive || [] ).includes( mainText ) ) {
					template.inactiveProject = true;
				}
				return template;
			} );
			// Diagnostics: what was dropped and why
			try {
				const keptSet = new Set( filtered.map( ( t ) => ( t.getTitle && t.getTitle().getMainText() ) || t.name ) );
				templList.slice( 0, 20 ).forEach( ( t, idx ) => {
					const nm = ( t.getTitle && t.getTitle().getMainText() ) || t.name || 'unknown';
					if ( keptSet.has( nm ) ) {
						log.debug( '  kept %d: %s', idx + 1, nm );
						return;
					}
					const isListed = ( allBanners.withRatings || [] ).includes( nm ) ||
						( allBanners.withoutRatings || [] ).includes( nm ) ||
						( allBanners.wrappers || [] ).includes( nm ) ||
						( allBanners.notWPBM || [] ).includes( nm ) ||
						( allBanners.inactive || [] ).includes( nm ) ||
						( allBanners.wir || [] ).includes( nm );
					const hasKnownPrefix = bannerNamePrefixes.some( ( prefix ) => typeof prefix === 'string' && nm && nm.indexOf( prefix ) === 0 );
					const reason = isListed || hasKnownPrefix ? 'filtered by type (non-banner after redirect?)' : 'not listed and no known prefix';
					log.debug( '  dropped %d: %s → %s', idx + 1, nm, reason );
				} );
			} catch ( _e ) { /* ignore */ }
			const finalTemplates = filtered.filter( ( t ) => t && typeof t.getTitle === 'function' );
			log.debug( 'Found %d templates from final filtered templates:', finalTemplates.length );
			finalTemplates.forEach( ( template, i ) => {
				const name = template.name || ( template.getTitle && template.getTitle() && template.getTitle().getMainText() ) || 'unknown';
				log.debug( '  %d. %s', i + 1, name );
			} );
			resolve( finalTemplates );
		} ).catch( () => {
			// Fallback: return original templates if API fails
			resolve( Array.isArray( templates ) ? templates : [ templates ] );
		} );
	} );
};

export { findBannerTemplatesOnTalk, findShellBlocks };
// </nowiki>
