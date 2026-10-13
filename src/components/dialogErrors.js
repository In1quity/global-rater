import { makeErrorMsg } from '@services/api.js';
import i18n from '@services/i18n.js';
// <nowiki>

const createDialogError = function ( titleKey, code, details ) {
	const element = document.createElement( 'div' );
	const title = document.createElement( 'strong' );
	title.className = 'rater-mainWindow-errorStrong';
	title.textContent = i18n.t( titleKey );
	const message = document.createElement( 'span' );
	message.className = 'rater-mainWindow-errorMessage';
	message.textContent = code instanceof Error ? code.message : makeErrorMsg( code, details );
	element.appendChild( title );
	element.appendChild( message );
	// OO.ui.Error accepts strings and jQuery objects, not bare DOM elements.
	return new OO.ui.Error( $( element ) );
};

export { createDialogError };
// </nowiki>
