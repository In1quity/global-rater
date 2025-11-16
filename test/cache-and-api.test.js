import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './setup.js';
import * as cache from '../src/services/cache.js';
import API from '../src/services/api.js';
import { getTemplateData, getTemplateDataDetails } from '../src/services/templateData.js';

const toPromise = ( maybeDeferred ) => new Promise( ( resolve, reject ) => {
	if ( maybeDeferred && typeof maybeDeferred.then === 'function' ) {
		maybeDeferred.then( resolve, reject );
		return;
	}
	resolve( maybeDeferred );
} );

describe( 'cache.read', () => {
	beforeEach( () => {
		global.localStorage = window.localStorage;
		localStorage.clear();
	} );

	it( 'returns null for missing keys without throwing', () => {
		expect( () => cache.read( 'non-existent' ) ).not.toThrow();
		expect( cache.read( 'non-existent' ) ).toBeNull();
	} );

	it( 'round-trips stored objects', () => {
		const payload = { example: 'value' };
		cache.write( 'example-key', payload, 1, 1 );
		const stored = cache.read( 'example-key' );
		expect( stored ).not.toBeNull();
		expect( stored.value ).toEqual( payload );
	} );
} );

describe( 'API.getRaw URL construction', () => {
	let originalFetch;
	let originalGetUrl;

	beforeEach( () => {
		originalFetch = global.fetch;
		originalGetUrl = mw.util.getUrl;
		global.fetch = vi.fn( () => Promise.resolve( { text: () => Promise.resolve( 'raw-data' ) } ) );
		global.localStorage = window.localStorage;
	} );

	afterEach( () => {
		global.fetch = originalFetch;
		mw.util.getUrl = originalGetUrl;
	} );

	it( 'does not duplicate protocol when server already includes scheme', async () => {
		mw.util.getUrl = () => '/w/index.php?title=Test&action=raw';
		await expect( toPromise( API.getRaw( 'Test' ) ) ).resolves.toBe( 'raw-data' );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
		expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toBe( 'https://ru.wikipedia.org/w/index.php?title=Test&action=raw' );
	} );

	it( 'resolves protocol-relative URLs from mw.util.getUrl', async () => {
		mw.util.getUrl = () => '//ru.wikipedia.org/w/index.php?title=Test&action=raw';
		await expect( toPromise( API.getRaw( 'Test' ) ) ).resolves.toBe( 'raw-data' );
		expect( global.fetch ).toHaveBeenCalledTimes( 1 );
		expect( global.fetch.mock.calls[ 0 ][ 0 ] ).toBe( 'https://ru.wikipedia.org/w/index.php?title=Test&action=raw' );
	} );
} );

describe( 'TemplateData caching separation', () => {
	let apiGetSpy;

	beforeEach( () => {
		global.localStorage = window.localStorage;
		localStorage.clear();
		apiGetSpy = vi.spyOn( API, 'get' ).mockImplementation( ( params ) => {
			if ( params && params.action === 'templatedata' ) {
				return Promise.resolve( {
					pages: {
						123: {
							params: {
								class: {},
								importance: {}
							},
							paramOrder: [ 'class', 'importance' ]
						}
					}
				} );
			}
			return Promise.resolve( {} );
		} );
	} );

	afterEach( () => {
		if ( apiGetSpy ) {
			apiGetSpy.mockRestore();
		}
	} );

	it( 'stores raw TemplateData only under the -templatedata key', async () => {
		const title = 'Template:CacheTest';
		await toPromise( getTemplateData( title ) );
		const rawKey = 'Rater-' + title + '-templatedata';
		const processedKey = 'Rater-' + title + '-params';
		expect( localStorage.getItem( rawKey ) ).not.toBeNull();
		expect( localStorage.getItem( processedKey ) ).toBeNull();
	} );

	it( 'populates processed cache even when raw cache already exists', async () => {
		const title = 'Template:Collision';
		await toPromise( getTemplateData( title ) );
		await toPromise( getTemplateDataDetails( title ) );
		const cachedDetails = cache.read( title + '-params' );
		expect( cachedDetails ).not.toBeNull();
		expect( cachedDetails.value ).toHaveProperty( 'paramData' );
		expect( cachedDetails.value ).toHaveProperty( 'parameterSuggestions' );
	} );
} );
