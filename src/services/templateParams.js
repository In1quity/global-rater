import { getTemplateDataDetails } from '@services/templateData.js';
// <nowiki>

// The TemplateData service owns canonical names, aliases and caching for every load.
const loadParamDataAndSuggestions = function ( template ) {
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
