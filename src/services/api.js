// <nowiki>

// Initialize API with default user agent from build-time constants
const DEFAULT_VERSION = ( typeof RATER_VERSION !== 'undefined' && RATER_VERSION ) || 'dev';
const DEFAULT_DOC_PAGE = ( typeof RATER_DOC_PAGE !== 'undefined' && RATER_DOC_PAGE ) || 'https://en.wikipedia.org/wiki/User:Evad37/Rater';
const API = new mw.Api( {
	ajax: {
		headers: {
			'Api-User-Agent': 'Rater/' + DEFAULT_VERSION + ' ( ' + DEFAULT_DOC_PAGE + ' )'
		}
	}
} );

// Function to update API user agent when config is loaded
API.updateUserAgent = function ( version ) {
	API.defaults.ajax.headers[ 'Api-User-Agent' ] = 'Rater/' + version + ' ( ' + DEFAULT_DOC_PAGE + ' )';
};

/* ---------- API for ORES ---------------------------------------------------------------------- */
API.getORES = function ( revisionID, wiki ) {
	wiki = wiki || 'enwiki';
	return fetch( 'https://ores.wikimedia.org/v3/scores/' + wiki + '?models=articlequality&revids=' + revisionID )
		.then( ( response ) => response.json() );
};

/* ---------- Raw wikitext ---------------------------------------------------------------------- */
const getWindowProtocol = function () {
	try {
		if ( typeof window !== 'undefined' && window.location && window.location.protocol ) {
			return window.location.protocol;
		}
	} catch ( _e ) {}
	return 'https:';
};

const resolveProtocolRelative = function ( url ) {
	const str = String( url || '' );
	if ( str.startsWith( '//' ) ) {
		return getWindowProtocol() + str;
	}
	return str;
};

const absolutizeUrl = function ( path ) {
	const rawPath = String( path || '' );
	if ( /^https?:\/\//i.test( rawPath ) ) {
		return rawPath;
	}
	if ( rawPath.startsWith( '//' ) ) {
		return resolveProtocolRelative( rawPath );
	}
	const normalizedPath = rawPath.startsWith( '/' ) ? rawPath : '/' + rawPath;
	const server = resolveProtocolRelative( mw.config.get( 'wgServer' ) || ( ( typeof window !== 'undefined' && window.location && window.location.origin ) || '' ) );
	if ( !server ) {
		return normalizedPath;
	}
	const trimmedServer = server.replace( /\/+$/, '' );
	return trimmedServer + normalizedPath;
};

API.getRaw = function ( page ) {
	const target = mw.util && typeof mw.util.getUrl === 'function' ? mw.util.getUrl( page, { action: 'raw' } ) : '';
	const url = absolutizeUrl( target );
	return fetch( url )
		.then( ( response ) => response.text() )
		.then( ( data ) => {
			if ( !data ) {
				throw new Error( 'ok-but-empty' );
			}
			return data;
		} );
};

/* ---------- Edit with retry ------------------------------------------------------------------- */
/**
 * @param {String} title
 * @param {Object?} params additional params for the get request
 * @returns {Promise<Object, string>} page, starttime timestamp
 */
const getPage = function ( title, params ) {
	return API.get(
		Object.assign(
			{
				action: 'query',
				format: 'json',
				curtimestamp: 1,
				titles: title,
				prop: 'revisions|info',
				rvprop: 'content|timestamp',
				rvslots: 'main'
			},
			params
		)
	).then( ( response ) => {
		const page = Object.values( response.query.pages )[ 0 ];
		const starttime = response.curtimestamp;
		return [ page, starttime ];
	} );
};

/**
 * @param {Object} page details object from API
 * @param {string} starttime timestamp
 * @param {Function} transform callback that prepares the edit:
 *  {Object} simplifiedPage => {Object|Promise<Object>} edit params
 * @returns {Promise<Object>} params for edit query
 */
const processPage = function ( page, starttime, transform ) {
	const basetimestamp = page.revisions && page.revisions[ 0 ].timestamp;
	const simplifiedPage = {
		pageid: page.pageid,
		missing: page.missing === '',
		redirect: page.redirect === '',
		categories: page.categories,
		ns: page.ns,
		title: page.title,
		content: page.revisions && page.revisions[ 0 ].slots.main[ '*' ]
	};
	return Promise.resolve( transform( simplifiedPage ) )
		.then( ( editParams ) => Object.assign( {
			action: 'edit',
			title: page.title,
			// Protect against errors and conflicts
			assert: 'user',
			basetimestamp: basetimestamp,
			starttimestamp: starttime
		}, editParams )
		);
};

/** editWithRetry
 *
 * Edits a page, resolving edit conflicts, and retrying edits that fail. The
 * tranform function may return a rejected promise if the page should not be
 * edited; the @returns {Promise} will will be rejected with the same rejection
 * values.
 *
 * Note: Unlike [mw.Api#Edit], a missing page will be created, unless the
 * transform callback includes the "nocreate" param.
 *
 * [mw.Api#Edit]: <https://doc.wikimedia.org/mediawiki-core/master/js/#!/api/mw.Api.plugin.edit>
 *
 * @param {String} title page to be edited
 * @param {Object|null} getParams additional params for the get request
 * @param {Function} transform callback that prepares the edit:
 *  {Object} simplifiedPage => {Object|Promise<Object>} params for API editing
 * @returns {Promise<object>} promise, resolved on success, rejected if
 *  page was not edited
 */
API.editWithRetry = function ( title, getParams, transform ) {
	return getPage( title, getParams )
		.then(
		// Succes: process the page
			( args ) => processPage( args[ 0 ], args[ 1 ], transform ),
			// Failure: try again
			() => getPage( title, getParams ).then( ( args ) => processPage( args[ 0 ], args[ 1 ], transform ) )
		)
		.then( ( editParams ) => API.postWithToken( 'csrf', editParams )
			.catch( ( errorCode ) => {
				if ( errorCode === 'editconflict' ) {
					// Try again, starting over
					return API.editWithRetry( title, getParams, transform );
				}
				// Try again
				return API.postWithToken( 'csrf', editParams );
			} )
		);
};

const makeErrorMsg = function ( first, second ) {
	let code, xhr, message;
	if ( typeof first === 'object' && typeof second === 'string' ) {
		// Errors from $.get being rejected (ORES & Raw wikitext)
		const errorObj = first.responseJSON && first.responseJSON.error;
		if ( errorObj ) {
			// Got an api-specific error code/message
			code = errorObj.code;
			message = errorObj.message;
		} else {
			xhr = first;
		}
	} else if ( typeof first === 'string' && typeof second === 'object' ) {
		// Errors from mw.Api object
		const mwErrorObj = second.error;
		if ( mwErrorObj ) {
			// Got an api-specific error code/message
			code = mwErrorObj.code;
			message = mwErrorObj.info;
		} else if ( first === 'ok-but-empty' ) {
			code = null;
			message = 'Got an empty response from the server';
		} else {
			xhr = second && second.xhr;
		}
	}

	if ( code && message ) {
		return `API error ${ code }: ${ message }`;
	} else if ( message ) {
		return `API error: ${ message }`;
	} else if ( xhr ) {
		return `HTTP error ${ xhr.status }`;
	} else if (
		typeof first === 'string' && first !== 'error' &&
		typeof second === 'string' && second !== 'error'
	) {
		return `Error ${ first }: ${ second }`;
	} else if ( typeof first === 'string' && first !== 'error' ) {
		return `Error: ${ first }`;
	} else {
		return 'Unknown API error';
	}
};

export default API;
export { makeErrorMsg };
// </nowiki>
