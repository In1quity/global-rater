import { parseTemplates } from '@utils/parseTemplates.js';
import { getShellTemplateAliasesSync } from '@services/templateShell.js';
import { computeTopInsertIndex, stripAnyTemplateNs, normalizeTemplateName } from '@utils/wikitext.js';
import config from '@constants/config.js';
// <nowiki>

const applyBannerInsert = function ( talkWikitext, bannersWikitext, existingBannerNames ) {
	const block = String( bannersWikitext || '' ).trim();
	const base = String( talkWikitext || '' );
	if ( !base ) {
		return block;
	}
	const normalize = ( name ) => normalizeTemplateName( stripAnyTemplateNs( name ) ).toLowerCase();
	const managedNames = new Set( ( existingBannerNames || [] ).concat( getShellTemplateAliasesSync() ).map( normalize ) );
	// Only replace top-level templates. Nested banners are replaced with their shell.
	const ranges = parseTemplates( base, false ).filter( ( template ) => managedNames.has( normalize( template.name ) ) );
	if ( ranges.length ) {
		let result = '';
		let cursor = 0;
		ranges.forEach( ( template, index ) => {
			result += base.slice( cursor, template.start ) + ( index === 0 ? block : '' );
			cursor = template.end;
		} );
		return result + base.slice( cursor );
	}
	if ( !block ) {
		return base;
	}
	const lines = base.split( '\n' );
	const at = computeTopInsertIndex( lines, existingBannerNames || [], getShellTemplateAliasesSync(), config.templateNamespaceAliases || [] );
	lines.splice( at, 0, block );
	return lines.join( '\n' );
};

export { applyBannerInsert };
// </nowiki>
