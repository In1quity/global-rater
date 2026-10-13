import { mostFrequent, filterAndMap, strReplaceAt, normalizeString, findTopLevelDelimiter } from './util.js';
import { Template } from './models/TemplateModel.js';
const LINK_PIPE_RE = /(\[\[[^\]]*?)\|(.*?\]\])/g;
const findTopLevelEqualsIndex = function ( text ) {
	return findTopLevelDelimiter( text, '=' );
};
// <nowiki>

// Parse templates from wikitext (optionally recursively)
const parseTemplates = function ( wikitext, recursive ) {
	if ( !wikitext ) {
		return [];
	}
	// Fast path: no templates present
	if ( !normalizeString( wikitext ).includes( '{{' ) ) {
		return [];
	}

	const result = [];

	const processTemplateText = function ( sIdx, eIdx ) {
		let text = wikitext.slice( sIdx, eIdx );

		const template = new Template( '{{' + text.replace( /\x01/g, '|' ) + '}}' );
		// Offsets in the input string let edits replace complete templates safely.
		template.start = sIdx - 2;
		template.end = eIdx + 2;

		// swap out pipe in links with \x01 control character
		// [[File: ]] can have multiple pipes, so might need multiple passes
		while ( LINK_PIPE_RE.test( text ) ) {
			text = text.replace( LINK_PIPE_RE, '$1\x01$2' );
		}

		// Figure out most-used spacing styles for pipes/equals
		template.pipeStyle = mostFrequent( text.match( /[\s\n]*\|[\s\n]*/g ) ) || ' |';
		template.equalsStyle = mostFrequent( text.replace( /(=[^|]*)=+/g, '$1' ).match( /[\s\n]*=[\s\n]*/g ) ) || '=';
		// Figure out end-braces style
		const endSpacing = text.match( /[\s\n]*$/ );
		template.endBracesStyle = ( endSpacing ? endSpacing[ 0 ] : '' ) + '}}';

		// change '\x01' control characters back to pipes
		// Split top-level only by pipes: respect nested template pipes we replaced with \x01
		const chunks = [];
		{
			let buf = '';
			let depth = 0;
			for ( let i = 0; i < text.length; i++ ) {
				const ch = text[ i ];
				const next = text[ i + 1 ];
				if ( ch === '{' && next === '{' ) {
					depth += 2;
					i++;
					buf += '{{';
					continue;
				}
				if ( ch === '}' && next === '}' ) {
					depth -= 2;
					i++;
					buf += '}}';
					continue;
				}
				if ( ch === '|' && depth === 0 ) {
					chunks.push( buf.replace( /\x01/g, '|' ) );
					buf = '';
					continue;
				}
				buf += ch;
			}
			chunks.push( buf.replace( /\x01/g, '|' ) );
		}

		template.setName( chunks[ 0 ] );

		const parameterChunks = chunks.slice( 1 );

		let unnamedIdx = 1;
		parameterChunks.forEach( ( chunk ) => {
			const part = ( chunk || '' ).trim();
			if ( !part ) {
				return;
			}
			const eq = findTopLevelEqualsIndex( part );
			if ( eq === -1 ) {
				while ( template.getParam( unnamedIdx ) ) {
					unnamedIdx++;
				}
				template.addParam( unnamedIdx, part, chunk );
			} else {
				const k = part.slice( 0, eq ).trim();
				const v = part.slice( eq + 1 ).trim();
				template.addParam( k, v, chunk );
			}
		} );

		result.push( template );
	};

	const n = wikitext.length;

	let numUnclosed = 0;
	let inComment = false;
	let inNowiki = false;
	let inParameter = false;

	let startIndex, endIndex;

	for ( let i = 0; i < n; i++ ) {

		if ( !inComment && !inNowiki && !inParameter ) {

			if ( wikitext[ i ] === '{' && wikitext[ i + 1 ] === '{' && wikitext[ i + 2 ] === '{' && wikitext[ i + 3 ] !== '{' ) {
				inParameter = true;
				i += 2;
			} else if ( wikitext[ i ] === '{' && wikitext[ i + 1 ] === '{' ) {
				if ( numUnclosed === 0 ) {
					startIndex = i + 2;
				}
				numUnclosed += 2;
				i++;
			} else if ( wikitext[ i ] === '}' && wikitext[ i + 1 ] === '}' ) {
				if ( numUnclosed === 2 ) {
					endIndex = i;
					processTemplateText( startIndex, endIndex );
				}
				numUnclosed -= 2;
				i++;
			} else if ( wikitext[ i ] === '|' && numUnclosed > 2 ) {
			// Do not mutate global wikitext; top-level splitting handles nested pipes later
			// intentionally left blank
			} else if ( /^<!--/.test( wikitext.slice( i, i + 4 ) ) ) {
				inComment = true;
				i += 3;
			} else if ( /^<nowiki ?>/.test( wikitext.slice( i, i + 9 ) ) ) {
				inNowiki = true;
				i += 7;
			}

		} else {
			if ( wikitext[ i ] === '|' ) {
				// Do not mutate global wikitext while in comment/nowiki/parameter
				// intentionally left blank
			} else if ( /^-->/.test( wikitext.slice( i, i + 3 ) ) ) {
				inComment = false;
				i += 2;
			} else if ( /^<\/nowiki ?>/.test( wikitext.slice( i, i + 10 ) ) ) {
				inNowiki = false;
				i += 8;
			} else if ( wikitext[ i ] === '}' && wikitext[ i + 1 ] === '}' && wikitext[ i + 2 ] === '}' ) {
				inParameter = false;
				i += 2;
			}
		}

	}

	if ( recursive ) {
		const subtemplates = filterAndMap( result,
			( template ) => /\{\{(?:.|\n)*\}\}/.test( template.wikitext.slice( 2, -2 ) ),
			( template ) => parseTemplates( template.wikitext.slice( 2, -2 ), true )
		);
		const finalResult = result.concat.apply( result, subtemplates );
		return finalResult;
	}
	return result;
};

export { parseTemplates };
// </nowiki>
