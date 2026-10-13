// <nowiki>

// Serialize plain template data without constructing or changing UI components.
const serializeTemplate = function ( template ) {
	const pipe = template.pipeStyle || '|';
	const equals = template.equalsStyle || '=';
	const parameters = template.parameters.filter( ( parameter ) => !parameter.isInvalid )
		.map( ( parameter ) => {
			if ( template.isShellTemplate && String( parameter.name ) === '1' ) {
				return pipe + ( parameter.value || '' );
			}
			return pipe + parameter.name + equals + ( parameter.value || '' );
		} ).join( '' );
	return ( '{{' + template.name + parameters + ( template.endBracesStyle || '}}' ) )
		.replace( /\n+}}$/, '\n}}' );
};

export { serializeTemplate };
// </nowiki>
