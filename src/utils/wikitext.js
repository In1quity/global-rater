// <nowiki>
import config from '@constants/config.js';
import { normalizeString } from './util.js';

// Utilities for line-based wikitext operations aligned with maintenance-core

// Precompiled/common regexes
const WS_NBSP_CLASS = '[\\s\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]+'; // whitespace incl. various NBSPs (double-escaped for new RegExp)
const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

const stripSubstitutionPrefix = function ( title ) {
	const aliases = config.substitution.aliases || [];
	if ( !aliases.length ) {
		return title;
	}
	return String( title ).replace( new RegExp( '^(?:' + aliases.map( ( alias ) => alias.replace( ESCAPE_REGEX, '\\$&' ) ).join( '|' ) + '):', 'i' ), '' );
};

// Collapse spaces and strip simple warning symbol sequences from headings
const sanitizeSectionName = function ( text ) {
	const base = normalizeString( text );
	return base.replace( /\u26A0\uFE0F?/g, '' ).replace( /\s+/g, ' ' ).trim();
};

// Compute section bounds for a given section name within an array of lines
// The top section (above first heading) is designated by MT_TOP_SECTION-like name
const computeSectionBounds = function ( lines, sectionName, topMarker ) {
	const headingRe = /^={2,}\s*(.*?)\s*={2,}(?:\s*<!--.*?-->)?\s*$/;
	const top = topMarker || '__TOP__';
	if ( sectionName === top ) {
		let end = lines.length;
		for ( let i = 0; i < lines.length; i++ ) {
			if ( headingRe.test( ( lines[ i ] || '' ).trim() ) ) {
				end = i;
				break;
			}
		}
		return { start: 0, end: end };
	}
	let start = -1;
	let endIdx = lines.length;
	for ( let j = 0; j < lines.length; j++ ) {
		const m = ( lines[ j ] || '' ).trim().match( headingRe );
		if ( m ) {
			const t = sanitizeSectionName( m[ 1 ] || '' );
			if ( t === sectionName ) {
				start = j + 1;
				continue;
			}
			if ( start !== -1 ) {
				endIdx = j;
				break;
			}
		}
	}
	return { start: start, end: endIdx };
};

// Escape template names for safe regex usage and allow spaces/nbsp variations
const escapeTplName = function ( name ) {
	const base = String( name || '' );
	return base
		.replace( ESCAPE_REGEX, '\\$&' )
		.replace( /[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, WS_NBSP_CLASS );
};

// Build a regex that matches any provided template names including optional params/multiline
const buildTemplateRegexFor = function ( names, namespaceAliases ) {
	const list = Array.isArray( names ) ? names : [ names ];
	const filtered = list.map( ( n ) => String( n || '' ).trim() ).filter( Boolean )
		.sort( ( a, b ) => b.length - a.length ); // prefer longest names first
	if ( filtered.length === 0 ) {
		return /a^/;
	}
	const alt = filtered.map( escapeTplName ).join( '|' );
	const ns = Array.isArray( namespaceAliases ) ? namespaceAliases : [];
	const nsPart = ns.length ? '(?:' + ns.map( ( n ) => String( n ).replace( ESCAPE_REGEX, '\\$&' ) ).join( '|' ) + ':)?' : '';
	const pattern = '\\{\\{\\s*' + nsPart + '(?:' + alt + ')(?:\\s*\\|[\\s\\S]*?)?\\s*\\}\\}';
	return new RegExp( pattern, 'ig' );
};

// Extract plain template name from code like "{{Name|...}}"
const extractTemplateName = function ( code ) {
	return String( code || '' ).split( '|' )[ 0 ].replace( /[{}]/g, '' );
};

// Build regex for opening line of a block for a given set of names
// Matches start {{ Ns?:Name and lookahead for |, }} or end
const buildOpenRegexFor = function ( names, namespaceAliases ) {
	const list = ( Array.isArray( names ) ? names : [ names ] )
		.map( ( n ) => String( n || '' ).trim() ).filter( Boolean )
		.sort( ( a, b ) => b.length - a.length );
	if ( list.length === 0 ) {
		return null;
	}
	const alt = list.map( escapeTplName ).join( '|' );
	const ns = Array.isArray( namespaceAliases ) ? namespaceAliases : [];
	const nsPart = ns.length ? '(?:' + ns.map( ( n ) => String( n ).replace( ESCAPE_REGEX, '\\$&' ) ).join( '|' ) + ':)?' : '';
	// NOTE: lookahead allows either '|' (params continue), or '}}' (single-line), or end-of-line
	return new RegExp( '^\\{\\{\\s*' + nsPart + '(?:' + alt + ')(?=\\s*(?:\\||}}|$))', 'i' );
};

// Normalize multiline block: trim trailing spaces per line, collapse >2 newlines, trim ends
const normalizeBlockText = function ( text ) {
	return String( text || '' )
		.replace( /\s+$/gm, '' )
		.replace( /\n{3,}/g, '\n\n' )
		.trim();
};

// Normalize template name for internal comparisons (spaces and nbsp)
const normalizeTemplateName = function ( name ) {
	return String( name || '' ).replace( /[ _\u00A0]+/g, ' ' ).trim();
};

// Build optional namespace part for regexes from aliases list
const buildOptionalNamespacePart = function ( namespaceAliases ) {
	const ns = Array.isArray( namespaceAliases ) ? namespaceAliases : [];
	if ( !ns.length ) {
		return '';
	}
	return '(?:' + ns.map( ( n ) => String( n ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) ).join( '|' ) + ':)?';
};

// Strip namespace prefix from a title using provided aliases (falls back to config if missing)
const stripNamespacePrefix = function ( title, namespaceAliases ) {
	const base = String( title || '' );
	const ns = Array.isArray( namespaceAliases ) && namespaceAliases.length ? namespaceAliases : ( ( config && Array.isArray( config.templateNamespaceAliases ) ) ? config.templateNamespaceAliases : [ 'Template' ] );
	const re = new RegExp( '^(' + ns.map( ( n ) => String( n ).replace( ESCAPE_REGEX, '\\$&' ) ).join( '|' ) + '):', 'i' );
	return base.replace( re, '' );
};

// Add namespace prefix (first alias) to a name if not already present
const addNamespacePrefix = function ( name, namespaceAliases ) {
	const base = String( name || '' );
	const ns = Array.isArray( namespaceAliases ) && namespaceAliases.length ? namespaceAliases : ( ( config && Array.isArray( config.templateNamespaceAliases ) ) ? config.templateNamespaceAliases : [ 'Template' ] );
	const first = ns[ 0 ] || '';
	if ( !first ) {
		return base;
	}
	const re = new RegExp( '^(' + ns.map( ( n ) => String( n ).replace( ESCAPE_REGEX, '\\$&' ) ).join( '|' ) + '):', 'i' );
	if ( re.test( base ) ) {
		return base;
	}
	return first + ':' + base;
};

// Normalize removing localized Template: namespace
const stripAnyTemplateNs = function ( title ) {
	const templateNsName = ( config.mw && config.mw.wgFormattedNamespaces && ( config.mw.wgFormattedNamespaces[ 10 ] || 'Template' ) ) || 'Template';
	const re = new RegExp( '^(?:Template|' + String( templateNsName ).replace( ESCAPE_REGEX, '\\$&' ) + '):', 'i' );
	return String( title || '' ).replace( re, '' );
};

const normalizeTemplateTitle = function ( name ) {
	return normalizeTemplateName( stripAnyTemplateNs( name ) );
};

// Check if a line opens a shell template; uses buildOpenRegexFor for robustness
// Signature: (firstLine, nsAliases, aliases)
const isShellOpenLine = function ( line, namespaceAliases, shellAliases ) {
	const first = String( line || '' ).trim();
	const re = buildOpenRegexFor( shellAliases || [], namespaceAliases || [] );
	return !!( re && re.test( first ) );
};

// Compute a top insertion index skipping empty lines and leading non-target template blocks
// Accepts explicit shellAliases to avoid depending on services from utils layer
const computeTopInsertIndex = function ( lines, existingBannerNames, shellAliases, namespaceAliases ) {
	const nsAliases = Array.isArray( namespaceAliases ) ? namespaceAliases : [];
	const shellOpen = buildOpenRegexFor( shellAliases || [], nsAliases );
	const bannerOpen = Array.isArray( existingBannerNames ) && existingBannerNames.length ? buildOpenRegexFor( existingBannerNames, nsAliases ) : null;
	let i = 0;
	while ( i < lines.length ) {
		const t = ( lines[ i ] || '' ).trim();
		if ( t === '' ) {
			i++;
			continue;
		}
		if ( ( shellOpen && shellOpen.test( t ) ) || ( bannerOpen && bannerOpen.test( t ) ) ) {
			break;
		}
		if ( /^\{\{/.test( t ) ) {
			let j = i + 1;
			let closed = false;
			while ( j < lines.length ) {
				const u = ( lines[ j ] || '' ).trim();
				if ( u === '}}' ) {
					j++;
					closed = true;
					break;
				}
				j++;
			}
			i = closed ? j : i + 1;
			continue;
		}
		break;
	}
	return i;
};

// Find a block range delimited by open (matched by openRegex) and a closing '}}'
const findBlockRange = function ( lines, startIdx, endIdx, openRegex ) {
	let rqStart = -1;
	let rqEnd = -1;
	for ( let i = startIdx; i < endIdx; i++ ) {
		const line = ( lines[ i ] || '' ).trim();
		if ( rqStart === -1 && openRegex.test( line ) ) {
			rqStart = i;
		}
		if ( rqStart !== -1 && line === '}}' ) {
			rqEnd = i;
			break;
		}
	}
	if ( rqStart !== -1 && rqEnd !== -1 ) {
		return { start: rqStart, end: rqEnd };
	}
	return null;
};

// Check if any of templateNames occurs within sectionName inside content
const isAnyTemplateInSection = function ( content, templateNames, sectionName, namespaceAliases, topMarker ) {
	const lines = String( content || '' ).split( '\n' );
	const bounds = computeSectionBounds( lines, sectionName, topMarker );
	if ( bounds.start === -1 ) {
		return false;
	}
	const sectionText = lines.slice( bounds.start, bounds.end ).join( '\n' );
	const re = buildTemplateRegexFor( templateNames || [], namespaceAliases );
	return re.test( sectionText );
};

// Filter those templates that are not present in the given section
const filterNewTemplates = function ( content, sectionName, list, aliasesMap, namespaceAliases, topMarker ) {
	const result = [];
	( list || [] ).forEach( ( t ) => {
		const code = t.code || ( '{{' + t.name + '}}' );
		const name = extractTemplateName( code );
		const aliases = ( aliasesMap && aliasesMap[ name ] ) || [ name ];
		if ( !isAnyTemplateInSection( content, aliases, sectionName, namespaceAliases, topMarker ) ) {
			result.push( code );
		}
	} );
	return result;
};

// High-level helper: check whether any of the names (or a single name) exists in content
// Performs a quick whole-text regex scan and a top-section scan for robustness
const containsTemplate = function ( params ) {
	const content = String( params && params.content || '' );
	const names = ( params && params.names ) || [];
	const namespaceAliases = ( params && params.namespaceAliases ) || [];
	const topMarker = ( params && params.topMarker ) || '__TOP__';
	const list = Array.isArray( names ) ? names : [ names ];
	if ( !content || list.length === 0 ) {
		return false;
	}
	const re = buildTemplateRegexFor( list, namespaceAliases );
	if ( re.test( content ) ) {
		return true;
	}
	return isAnyTemplateInSection( content, list, topMarker, namespaceAliases );
};

// Find all template blocks for given names in content; returns array of { name, wikitext }
const findTemplatesByNames = function ( content, names, namespaceAliases ) {
	const text = String( content || '' );
	const list = Array.isArray( names ) ? names : [ names ];
	if ( !text || list.length === 0 ) {
		return [];
	}
	const re = buildTemplateRegexFor( list, namespaceAliases );
	const out = [];
	let m;
	while ( ( m = re.exec( text ) ) ) {
		const code = m[ 0 ];
		const nm = extractTemplateName( code );
		out.push( { name: normalizeTemplateName( stripNamespacePrefix( nm, namespaceAliases ) ), wikitext: code } );
	}
	return out;
};

export { sanitizeSectionName, computeSectionBounds, escapeTplName, buildTemplateRegexFor, extractTemplateName, buildOpenRegexFor, findBlockRange, isAnyTemplateInSection, filterNewTemplates, containsTemplate, normalizeTemplateName, buildOptionalNamespacePart, stripNamespacePrefix, addNamespacePrefix, findTemplatesByNames, stripAnyTemplateNs, stripSubstitutionPrefix, normalizeTemplateTitle, WS_NBSP_CLASS, ESCAPE_REGEX, normalizeBlockText, isShellOpenLine, computeTopInsertIndex };
// </nowiki>
