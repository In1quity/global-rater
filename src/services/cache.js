import { isAfterDate } from '@utils/util.js';
import logger from '@services/logger.js';
const log = logger.get( 'cache' );
// <nowiki>

/** write
 * @param {String} key
 * @param {Array|Object} val
 * @param {Number} staleDays Number of days after which the data becomes stale (usable, but should
 *  be updated for next time).
 * @param {Number} expiryDays Number of days after which the cached data may be deleted.
 */
const write = function ( key, val, staleDays, expiryDays ) {
	try {
		const defaultStaleDays = 1;
		const defaultExpiryDays = 30;
		const millisecondsPerDay = 24 * 60 * 60 * 1000;

		const staleDuration = ( staleDays || defaultStaleDays ) * millisecondsPerDay;
		const expiryDuration = ( expiryDays || defaultExpiryDays ) * millisecondsPerDay;

		const stringVal = JSON.stringify( {
			value: val,
			staleDate: new Date( Date.now() + staleDuration ).toISOString(),
			expiryDate: new Date( Date.now() + expiryDuration ).toISOString()
		} );
		localStorage.setItem( 'Rater-' + key, stringVal );
	} catch ( e ) {}
};
/** read
 * @param {String} key
 * @returns {Array|Object|String|Null} Cached array or object, or null if not yet cached or if there was an error.
 */
const read = function ( key ) {
	let val;
	try {
		const storageKey = 'Rater-' + key;
		const stringVal = localStorage.getItem( storageKey );
		if ( stringVal === null || stringVal === '' ) {
			return null;
		}
		val = JSON.parse( stringVal );
	} catch ( e ) {
		log.warn( 'error reading %s from localStorage cache:', key );
		log.warn( '\t%s message: %s%s%s', e.name, e.message, ( e.at ? ' at: ' + e.at : '' ), ( e.text ? ' text: ' + e.text : '' ) );
	}
	return val || null;
};

const isRaterKey = ( key ) => key && key.indexOf( 'Rater-' ) === 0;

const clearItemIfInvalid = function ( key ) {
	if ( !isRaterKey( key ) ) {
		return;
	}
	const item = read( key.replace( 'Rater-', '' ) );
	const isInvalid = !item || !item.expiryDate || isAfterDate( item.expiryDate );
	if ( isInvalid ) {
		localStorage.removeItem( key );
	}
};

const clearInvalidItems = function () {
	// Loop backwards as localStorage length will decrease as items are removed
	for ( let i = localStorage.length; i >= 0; i-- ) {
		setTimeout( clearItemIfInvalid, 100, localStorage.key( i ) );
	}
};

const clearAllItems = function () {
	// Loop backwards as localStorage length will decrease as items are removed
	for ( let i = localStorage.length; i >= 0; i-- ) {
		const key = localStorage.key( i );
		if ( isRaterKey( key ) ) {
			localStorage.removeItem( key );
		}
	}
};

export { write, read, clearItemIfInvalid, clearInvalidItems, clearAllItems };
// </nowiki>
