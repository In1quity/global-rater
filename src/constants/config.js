// <nowiki>
const version = ( typeof RATER_VERSION !== 'undefined' ) ? RATER_VERSION : '0.0.0';
const wikiDbName = mw.config.get( 'wgDBname' );
const isRussianWiki = wikiDbName ? wikiDbName === 'ruwiki' :
	/^(?:https?:)?\/\/ru\.wikipedia\.org$/.test( mw.config.get( 'wgServer' ) || '' );

// A global object that stores all the page and user configuration and settings
const config = {
	// Script info
	script: {
		// Advert to append to edit summaries
		advert: isRussianWiki ? ` ([[mw:User:Iniquity/rater.js#${ version }|Рейтер]])` : ` ([[WP:RATER#${ version }|Rater]])`,
		version: version
	},
	ores: {
		wiki: 'enwiki',
		// Top-tier classes to aggregate with baselineClass in ORES summary
		topTierClasses: [ 'FA', 'GA' ],
		// Baseline class for ORES aggregation label
		baselineClass: 'B'
	},
	// Default preferences, if user subpage raterPrefs.json does not exist
	defaultPrefs: {
		autostart: false,
		autostartRedirects: false,
		autostartNamespaces: [ 0 ],
		bypassRedirects: true,
		autofillClassFromOthers: true,
		autofillClassFromOres: true,
		autofillImportance: true,
		collapseParamsLowerLimit: 6,
		shellCreation: 'wiki',
		watchlist: 'preferences'
	},
	// MediaWiki configuration values
	mw: mw.config.get( [
		'skin',
		'wgPageName',
		'wgNamespaceNumber',
		'wgUserName',
		'wgFormattedNamespaces',
		'wgMonthNames',
		'wgRevisionId',
		'wgScriptPath',
		'wgServer',
		'wgCategories',
		'wgIsMainPage'
	] ),
	bannerDefaults: {
		classes: [
			'FA',
			'FL',
			'A',
			'GA',
			'B',
			'C',
			'Start',
			'Stub',
			'List'
		],
		importances: [
			'Top',
			'High',
			'Mid',
			'Low'
		],
		extendedClasses: [
			'Category',
			'Draft',
			'File',
			'FM',
			'Portal',
			'Project',
			'Template',
			'Bplus',
			'Future',
			'Current',
			'Disambig',
			'NA',
			'Redirect',
			'Book'
		],
		extendedImportances: [
			'Top',
			'High',
			'Mid',
			'Low',
			'Bottom',
			'NA'
		]
	},
	customBanners: {
		'WikiProject Military history': {
			classes: [
				'FA',
				'FL',
				'A',
				'GA',
				'B',
				'C',
				'Start',
				'Stub',
				'List',
				'AL',
				'BL',
				'CL',
				'Category',
				'Draft',
				'File',
				'Portal',
				'Project',
				'Template',
				'Disambig',
				'Redirect',
				'Book'
			],
			importances: []
		},
		'WikiProject Portals': {
			classes: [
				'FPo',
				'Complete',
				'Substantial',
				'Basic',
				'Incomplete',
				'Meta',
				'List',
				'Category',
				'Draft',
				'File',
				'Project',
				'Template',
				'Disambig',
				'NA',
				'Redirect'
			],
			importances: [
				'Top',
				'High',
				'Mid',
				'Low',
				'Bottom',
				'NA'
			]
		},
		'WikiProject Video games': {
			classes: [
				'FA', 'FL', 'FM', 'GA', 'B', 'C', 'Start', 'Stub', 'List', 'Category', 'Draft', 'File', 'Portal', 'Project', 'Template', 'Disambig', 'Redirect'
			],
			importances: [
				'Top', 'High', 'Mid', 'Low', 'NA'
			]
		}
	},
	categories: {
		withRatings: 'Category:WikiProject banners with quality assessment',
		withoutRatings: 'Category:WikiProject banners without quality assessment',
		wrappers: 'Category:WikiProject banner wrapper templates',
		notWPBM: 'Category:WikiProject banner templates not based on WPBannerMeta',
		inactive: 'Category:Inactive WikiProject banners',
		wir: 'Category:Wrapper templates for WikiProject Women in Red'
	},
	subjectPageCategories: {
		disambig: 'Category:All disambiguation pages',
		stub: 'Category:All stub articles',
		goodArticle: 'Category:Good articles',
		featuredArticle: 'Category:Featured articles',
		featuredList: 'Category:Featured lists'
	},
	// Array of valid banner name prefixes (case-insensitive)
	bannerNamePrefixes: [
		'WP ',
		'WikiProject '
	],
	// Main shell template name - aliases will be fetched via API
	shellTemplate: isRussianWiki ? 'Блок проектов статьи' : 'WikiProject banner shell',
	// Per-wiki assessment policy, overridable through RATER_CONFIG/RATER_CONFIG_URL.
	shell: {
		autoCreate: !isRussianWiki,
		minProjects: null,
		classLocation: isRussianWiki ? 'banners' : 'shell',
		classParamName: isRussianWiki ? 'уровень' : 'class',
		aliases: [],
		// Arrays are replaced by external config, so another wiki inherits no extra fields.
		parameters: isRussianWiki ? [
			{ name: '1' },
			{ name: 'collapsed', label: { en: 'Collapsed', ru: 'Свёрнутый блок' }, suggestedvalues: [ 'yes', 'no' ] },
			{ name: 'header', label: { en: 'Header', ru: 'Заголовок блока' } },
			{ name: 'blp', aliases: [ 'living' ], label: { en: 'Living person', ru: 'Живущий человек' }, suggestedvalues: [ 'yes', 'no' ] },
			{ name: 'blpo', label: { en: 'Other living people', ru: 'Другие живущие люди' }, suggestedvalues: [ 'yes', 'no' ] },
			{ name: 'activepol', label: { en: 'Active politician', ru: 'Действующий политик' }, suggestedvalues: [ 'yes', 'no' ] }
		] : [
			{ name: '1' },
			{ name: 'class' },
			{ name: 'blp', aliases: [ 'living' ], label: { en: 'Living person' }, suggestedvalues: [ 'yes', 'no' ] },
			{ name: 'collapsed', label: { en: 'Collapsed' }, suggestedvalues: [ 'yes', 'no' ] },
			{ name: 'listas', label: { en: 'Sort key' } },
			{ name: 'vital', label: { en: 'Vital article' } }
		],
		biographyBannerNames: isRussianWiki ? [] : [ 'WikiProject Biography' ],
		biographyParameters: isRussianWiki ? [] : [
			{ source: 'living', target: 'blp', normalise: true },
			{ source: 'listas', target: 'listas', normalise: false }
		]
	},
	classFormat: isRussianWiki ? 'arabic' : 'native',
	classDisplayFormat: isRussianWiki ? 'roman' : 'native',
	editSummaryLanguage: isRussianWiki ? 'ru' : 'en',
	defaultParameterData: {
		auto: {
			label: {
				en: 'Auto-rated'
			},
			description: {
				en: "Automatically rated by a bot. Allowed values: ['yes']."
			},
			autovalue: 'yes'
		},
		listas: {
			label: {
				en: 'List as'
			},
			description: {
				en: 'Sortkey for talk page'
			}
		},
		small: {
			label: {
				en: 'Small?'
			},
			description: {
				en: "Display a small version. Allowed values: ['yes']."
			},
			autovalue: 'yes'
		},
		attention: {
			label: {
				en: 'Attention required?'
			},
			description: {
				en: "Immediate attention required. Allowed values: ['yes']."
			},
			autovalue: 'yes'
		},
		'needs-image': {
			label: {
				en: 'Needs image?'
			},
			description: {
				en: "Request that an image or photograph of the subject be added to the article. Allowed values: ['yes']."
			},
			aliases: [
				'needs-photo'
			],
			autovalue: 'yes',
			suggested: true
		},
		'needs-infobox': {
			label: {
				en: 'Needs infobox?'
			},
			description: {
				en: "Request that an infobox be added to the article. Allowed values: ['yes']."
			},
			aliases: [
				'needs-photo'
			],
			autovalue: 'yes',
			suggested: true
		}
	}
};

if ( isRussianWiki ) {
	config.bannerNamePrefixes = [ 'Статья проекта ' ];
	config.bannerDefaults.classes = [ 'I', 'II', 'III', 'IV', 'ИС', 'ХС', 'ДС', 'ИСП', 'список' ];
	config.bannerDefaults.importances = [ 'высшая', 'высокая', 'средняя', 'низкая' ];
}

/**
 * Deep-merge helper for external config overrides
 */
const deepMerge = function ( target, source ) {
	if ( !source || typeof source !== 'object' ) {
		return target;
	}
	Object.keys( source ).forEach( ( key ) => {
		const sourceVal = source[ key ];
		const targetVal = target[ key ];
		if ( Array.isArray( sourceVal ) ) {
			// Arrays: replace entirely
			target[ key ] = sourceVal.slice();
		} else if ( sourceVal && typeof sourceVal === 'object' ) {
			target[ key ] = deepMerge( targetVal && typeof targetVal === 'object' ? targetVal : {}, sourceVal );
		} else {
			target[ key ] = sourceVal;
		}
	} );
	return target;
};

/**
 * Load external per-wiki config from either window.RATER_CONFIG (object) or
 * window.RATER_CONFIG_URL (JSON URL). Returns a Promise.
 */
const loadExternalConfig = function () {
	try {
		if ( window && window.RATER_CONFIG && typeof window.RATER_CONFIG === 'object' ) {
			deepMerge( config, window.RATER_CONFIG );
			return Promise.resolve();
		}
		if ( window && window.RATER_CONFIG_URL && typeof window.RATER_CONFIG_URL === 'string' ) {
			return fetch( window.RATER_CONFIG_URL )
				.then( ( response ) => response.json() )
				.then( ( data ) => {
					try {
						const obj = ( typeof data === 'string' ) ? JSON.parse( data ) : data;
						if ( obj && typeof obj === 'object' ) {
							deepMerge( config, obj );
						}
					} catch ( _ ) { /* ignore parse error */ }
				} );
		}
	} catch ( _ ) { /* ignore */ }
	return Promise.resolve();
};

export default config;
export { config, loadExternalConfig };
// </nowiki>
