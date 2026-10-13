import { getTemplateDataDetails } from '@services/templateData.js';
import config from '@constants/config.js';
import { isShellTemplate } from '@services/templateShell.js';
// <nowiki>

// The TemplateData service owns canonical names, aliases and caching for every load.
const loadParamDataAndSuggestions = function ( template ) {
	if ( isShellTemplate( template ) ) {
		template.paramData = {};
		template.paramAliases = {};
		( config.shell.parameters || [] ).forEach( ( parameter ) => {
			template.paramData[ parameter.name ] = Object.assign( {}, parameter );
			( parameter.aliases || [] ).forEach( ( alias ) => {
				template.paramAliases[ alias ] = parameter.name;
			} );
		} );
		template.classParamName = config.shell.classParamName;
		template.parameterSuggestions = Object.keys( template.paramData )
			.filter( ( name ) => name !== '1' && name !== template.classParamName )
			.map( ( name ) => ( { data: name } ) );
		return $.Deferred().resolve();
	}
	if ( template.paramData ) {
		return $.Deferred().resolve();
	}
	const title = template.redirectTarget || template.getTitle();
	return getTemplateDataDetails( title.getPrefixedText() ).then( ( details ) => {
		template.notemplatedata = !!details.notemplatedata;
		template.paramData = details.paramData || {};
		template.parameterSuggestions = details.parameterSuggestions || [];
		template.paramAliases = details.paramAliases || {};
		template.classParamName = details.classParamName || 'class';
		template.importanceParamName = details.importanceParamName || 'importance';
	} );
};

export { loadParamDataAndSuggestions };
// </nowiki>
