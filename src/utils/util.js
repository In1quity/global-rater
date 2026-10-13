import config from '@constants/config.js';
// <nowiki>

// Various utility functions and objects that might be used in multiple places

const isAfterDate = function ( dateString ) {
	return new Date( dateString ) < new Date();
};

const normaliseYesNo = function ( val ) {
	if ( val === null || typeof val === 'undefined' ) {
		return val;
	}
	const lower = String( val ).trim().toLowerCase();
	return config.booleanAliases[ lower ] || lower;
};

/**
 *
 * @param {Array} array
 * @param {Function} filterPredicate (currentVal, currentIndex, array) => {boolean}
 * @param {Function} mapTransform (currentVal, currentIndex, array) => {any}
 * @returns {Array}
 */
const filterAndMap = function ( array, filterPredicate, mapTransform ) {
	return array.reduce(
		( accumulated, currentVal, currentIndex ) => {
			if ( filterPredicate( currentVal, currentIndex, array ) ) {
				return [ ...accumulated, mapTransform( currentVal, currentIndex, array ) ];
			}
			return accumulated;
		},
		[]
	);
};

// Remove internal control characters before displaying in UI or saving
const sanitizeControlChars = function ( text ) {
	if ( text === null || typeof text === 'undefined' ) {
		return text;
	}
	return String( text ).replace( /[\x01\x02]/g, '' );
};

/**
 *
 * @param {string[]|number[]} array
 * @returns {string|null} item with the highest frequency
 * e.g. `mostFrequent(["apple", "apple", "orange"])` returns `"apple"`
 */
function mostFrequent( array ) {
	if ( !array || !Array.isArray( array ) || array.length === 0 ) {
		return null;
	}
	const map = {};
	let mostFreq = null;
	array.forEach( ( item ) => {
		map[ item ] = ( map[ item ] || 0 ) + 1;
		if ( mostFreq === null || map[ item ] > map[ mostFreq ] ) {
			mostFreq = item;
		}
	} );
	return mostFreq;
}

/**
 *
 * @param {string[]|number[]} array
 * @returns {string[]|number[]} array with only unique values
 * e.g. `uniqueArray(["apple", "apple", "orange"])` returns `["apple", "orange"]`
 */
function uniqueArray( array ) {
	if ( !array || !Array.isArray( array ) || array.length === 0 ) {
		return [];
	}
	const seen = {};
	const unique = [];
	array.forEach( ( item ) => {
		if ( !seen[ item ] ) {
			unique.push( item );
			seen[ item ] = true;
		}
	} );
	return unique;
}

const normaliseRating = function ( value, kind ) {
	if ( !value ) {
		return value;
	}
	const lower = String( value ).toLowerCase();
	const aliases = kind === 'classes' ? config.bannerDefaults.classAliases : config.bannerDefaults.importanceAliases;
	const options = ( config.bannerDefaults[ kind ] || [] ).concat(
		kind === 'classes' ? config.bannerDefaults.extendedClasses : config.bannerDefaults.extendedImportances,
		...Object.values( config.customBanners ).map( ( banner ) => banner[ kind ] || [] )
	);
	return options.find( ( option ) => String( option ).toLowerCase() === lower ) || ( aliases || {} )[ lower ] || value;
};
const classMask = ( value ) => normaliseRating( value, 'classes' );
const importanceMask = ( value ) => normaliseRating( value, 'importances' );

// String utilities
const strReplaceAt = function ( string, index, char ) {
	return string.slice( 0, index ) + char + string.slice( index + 1 );
};

const normalizeString = function ( value ) {
	return String( value === null || typeof value === 'undefined' ? '' : value );
};

const findTopLevelDelimiter = function ( text, delimiter, openChar = '{', closeChar = '}' ) {
	const s = normalizeString( text );
	let depth = 0;
	for ( let i = 0; i < s.length; i++ ) {
		const ch = s[ i ];
		const next = s[ i + 1 ];
		if ( ch === openChar && next === openChar ) {
			depth += 2;
			i++;
			continue;
		}
		if ( ch === closeChar && next === closeChar ) {
			depth -= 2;
			i++;
			continue;
		}
		if ( ch === delimiter && depth === 0 ) {
			return i;
		}
	}
	return -1;
};

export {
	isAfterDate,
	filterAndMap,
	normaliseYesNo,
	mostFrequent,
	uniqueArray,
	classMask,
	importanceMask,
	strReplaceAt,
	normalizeString,
	findTopLevelDelimiter
};
// </nowiki>
