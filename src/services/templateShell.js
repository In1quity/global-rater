import config from '@constants/config.js';
import { stripAnyTemplateNs, stripSubstitutionPrefix } from '@utils/wikitext.js';
import { getTemplateAliases } from '@utils/aliases.js';
// <nowiki>

const cachedShellAliases = new Map();

const getShellTemplateAliasesSync = function () {
	const result = cachedShellAliases.get( config.shellTemplate );
	return [ config.shellTemplate ].concat( config.shell.aliases || [], result && result.aliases || [] );
};

// Shell aliases source: reuse aliases service to avoid duplication
const getShellTemplateAliases = function () {
	const title = config.shellTemplate;
	if ( cachedShellAliases.has( title ) ) {
		return cachedShellAliases.get( title );
	}
	const result = getTemplateAliases( title ).then( ( list ) => {
		result.aliases = Array.isArray( list ) ? list : [];
		return getShellTemplateAliasesSync();
	} ).catch( () => getShellTemplateAliasesSync() );
	cachedShellAliases.set( title, result );
	return result;
};

const normalizeNs = ( name ) => stripSubstitutionPrefix( stripAnyTemplateNs( name ) ).replace( /_/g, ' ' ).trim().toLowerCase();

const isShellTemplateName = ( name ) => getShellTemplateAliasesSync().some( ( alias ) => normalizeNs( alias ) === normalizeNs( name ) );

const isShellTemplate = function ( template ) {
	const mainText = template.redirectTarget ? template.redirectTarget.getMainText() : template.getTitle().getMainText();
	return isShellTemplateName( mainText );
};

export { isShellTemplate, isShellTemplateName, getShellTemplateAliases, getShellTemplateAliasesSync };
// </nowiki>
