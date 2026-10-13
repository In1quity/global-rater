import config from '@constants/config.js';
import BannerWidget from './BannerWidget.js';
import { normaliseYesNo, filterAndMap, uniqueArray } from '@utils/util.js';
import ParameterWidget from './ParameterWidget.js';
import logger from '@services/logger.js';
import i18n from '@services/i18n.js';
import { usesShellClass, canRateBanner, shouldCreateShell, resolveShellClass, formatClassRating } from '@services/shellPolicy.js';
// <nowiki>

const log = logger.get( 'BannerList' );

const BannerListWidget = function BannerListWidget( widgetConfig ) {
	widgetConfig = widgetConfig || {};

	// Call parent constructor
	BannerListWidget.parent.call( this, config );
	OO.ui.mixin.GroupElement.call( this, {
		$group: this.$element
	} );
	this.$element.addClass( 'rater-bannerListWidget' ).css( { padding: '20px 10px 16px 10px' } );

	// Prefs
	this.preferences = widgetConfig.preferences;

	this.oresClass = widgetConfig.oresClass;

	this.changed = false;

	// Events
	this.aggregate( { remove: 'bannerRemove' } );
	this.connect( this, { bannerRemove: 'onBannerRemove' } );

	this.aggregate( { changed: 'bannerChanged' } );
	this.connect( this, { bannerChanged: 'setChanged' } );

	this.aggregate( { biographyBannerChange: 'biographyBannerChanged' } );
	this.connect( this, { biographyBannerChanged: 'syncShellTemplateWithBiographyBanner' } );

	this.aggregate( { updatedSize: 'bannerUpdatedSize' } );
	this.connect( this, { bannerUpdatedSize: 'onUpdatedSize' } );
};

OO.inheritClass( BannerListWidget, OO.ui.Widget );
OO.mixinClass( BannerListWidget, OO.ui.mixin.GroupElement );
/*
methods from mixin:
 - addItems( items, [index] ) : OO.ui.Element  (CHAINABLE)
 - clearItems( ) : OO.ui.Element  (CHAINABLE)
 - findItemFromData( data ) : OO.ui.Element|null
 - findItemsFromData( data ) : OO.ui.Element[]
 - removeItems( items ) : OO.ui.Element  (CHAINABLE)
*/

BannerListWidget.prototype.onUpdatedSize = function () {
	// Emit an "updatedSize" event so the parent window can update size, if needed
	this.emit( 'updatedSize' );
};

BannerListWidget.prototype.setChanged = function () {
	this.changed = true;
};

BannerListWidget.prototype.onBannerRemove = function ( banner ) {
	this.removeItems( [ banner ] );
	this.updateClassPlacement();
	this.setChanged();
	this.onUpdatedSize();
};

BannerListWidget.prototype.syncShellTemplateWithBiographyBanner = function ( biographyBanner ) {
	biographyBanner = biographyBanner || this.items.find(
		( banner ) => ( config.shell.biographyBannerNames || [] ).includes( banner.mainText ) ||
			( config.shell.biographyBannerNames || [] ).includes( banner.redirectTargetMainText )
	);
	if ( !biographyBanner ) {
		return;
	}

	// Find shell template using aliases
	const bannerShellTemplate = this.items.find( ( banner ) => banner.isShellTemplate );
	if ( !bannerShellTemplate ) {
		return;
	}

	const paramsToSync = config.shell.biographyParameters || [];
	paramsToSync.forEach( ( paramToSync ) => {
		if ( !( bannerShellTemplate.paramData || {} )[ paramToSync.target ] ) {
			return;
		}
		const [ biographyParam, shellParam ] = [ biographyBanner, bannerShellTemplate ].map( ( banner, index ) => banner.parameterList.getParameterItems()
			.find( ( parameter ) => parameter.name === ( index ? paramToSync.target : paramToSync.source ) ||
					banner.paramAliases[ parameter.name ] === ( index ? paramToSync.target : paramToSync.source )
			)
		);
		if ( !biographyParam ) {
			return;
		}

		const paramSyncValue = paramToSync.normalise ? normaliseYesNo( biographyParam.value ) : biographyParam.value;
		biographyParam.delete();

		if ( !shellParam && paramSyncValue ) {
			const index = bannerShellTemplate.addParameterLayout.isVisible() ?
				-1 : // Insert at the very end
				bannerShellTemplate.parameterList.items.length - 1; // Insert prior to the "add parameter" button
			bannerShellTemplate.parameterList.addItems( [
				new ParameterWidget( {
					name: paramToSync.target,
					value: paramSyncValue,
					autofilled: true
				},
				bannerShellTemplate.paramData[ paramToSync.target ]
				)
			], index );
		} else if ( !biographyParam.autofilled && paramSyncValue ) {
			shellParam.setValue( paramSyncValue );
			shellParam.setAutofilled();
		}
	} );
};

BannerListWidget.prototype.addShellTemplateIfNeeeded = function ( manual ) {
	const projectCount = this.items.filter( ( banner ) => !banner.isShellTemplate ).length;
	if ( !projectCount || ( !manual && !shouldCreateShell( projectCount, this.preferences ) ) || this.shellCreationPromise ) {
		return this;
	}
	if (
		!this.items.some( ( banner ) => banner.isShellTemplate )
	) {
		this.shellCreationPromise = BannerWidget.newFromTemplateName(
			config.shellTemplate,
			{ withoutRatings: true },
			{ preferences: this.preferences, isArticle: this.pageInfo && this.pageInfo.isArticle }
		).then( ( shellBannerWidget ) => {
			this.shellCreationPromise = null;
			const count = this.items.filter( ( banner ) => !banner.isShellTemplate ).length;
			if ( !count || ( !manual && !shouldCreateShell( count, this.preferences ) ) || this.items.some( ( banner ) => banner.isShellTemplate ) ) {
				return;
			}
			OO.ui.mixin.GroupElement.prototype.addItems.call( this, [ shellBannerWidget ], 0 );
			this.updateClassPlacement();
			// Autofill ratings (if able to)
			this.autofillClassRatings();
			this.syncShellTemplateWithBiographyBanner();
			this.setChanged();
			// emit updatedSize event
			this.onUpdatedSize();
		} ).catch( () => {
			this.shellCreationPromise = null;
			mw.notify( i18n.t( 'error-shell-required' ), { type: 'error' } );
		} );
	}

	return this;
};

BannerListWidget.prototype.addItems = function ( items, index ) {

	if ( items.length === 0 ) {
		return this;
	}

	// Call mixin method to do the adding
	OO.ui.mixin.GroupElement.prototype.addItems.call( this, items, index );
	this.updateClassPlacement();

	// Autofill ratings (if able to, and if enabled in preferences)
	this.autofillClassRatings();
	this.autofillImportanceRatings();
	this.addShellTemplateIfNeeeded();

	// emit updatedSize event
	this.onUpdatedSize();

	return this;
};

BannerListWidget.prototype.autofillClassRatings = function () {
	const shell = this.items.find( ( banner ) => banner.isShellTemplate );
	const forShell = usesShellClass() && !!shell;
	// Only autofill if set in preferences
	if ( !this.preferences.autofillClassFromOthers && !this.preferences.autofillClassFromOres && !forShell ) {
		return;
	}
	// Check what banners already have (safely handle null selected item)
	const selectedClassValues = [];
	this.items.forEach( ( banner ) => {
		if ( banner.isShellTemplate || !banner.hasClassRatings ) {
			return;
		}
		const selected = banner.classDropdown.getMenu().findSelectedItem();
		if ( selected ) {
			const data = selected.getData();
			if ( data ) {
				selectedClassValues.push( data );
			}
		}
	} );
	const uniqueClassRatings = uniqueArray( selectedClassValues );
	// Can't autofill if there isn't either a single value, or no value
	if ( uniqueClassRatings.length > 1 ) {
		return;
	}
	// Determine what to autofill with
	let autoClass;
	if ( uniqueClassRatings.length === 1 && ( this.preferences.autofillClassFromOthers || forShell ) ) {
		autoClass = uniqueClassRatings[ 0 ];
	} else if ( uniqueClassRatings.length === 0 && this.preferences.autofillClassFromOres && this.oresClass ) {
		// Don't autofill above C-class
		switch ( this.oresClass ) {
			case 'Stub': case 'Start': case 'C': case 'List':
				autoClass = this.oresClass;
		}
	} else {
		// nothing to do
		return;
	}
	// Do the autofilling
	this.items.forEach( ( banner ) => {
		if ( banner.isShellTemplate !== forShell ) {
			return;
		}
		if ( banner.isShellTemplate && banner.originalClassValue && !banner.classChanged ) {
			return;
		}
		if ( !banner.hasClassRatings && !banner.isShellTemplate ) {
			return;
		}
		const classItem = banner.classDropdown.getMenu().findSelectedItem();
		if ( classItem && classItem.getData() ) {
			return;
		}
		if ( !banner.classDropdown.getMenu().findItemFromData( autoClass ) ) {
			return;
		}
		banner.classDropdown.getMenu().selectItemByData( autoClass );
		banner.classDropdown.setAutofilled( true );
	} );
};

BannerListWidget.prototype.autofillImportanceRatings = function () {
	if ( !this.preferences.autofillImportance ) {
		return;
	}
	const isRegularArticle = this.pageInfo && this.pageInfo.isArticle && !this.pageInfo.redirect && !this.pageInfo.isDisambig;
	if ( !isRegularArticle ) {
		return;
	}
	// TODO: Should try to find a smarter, banner-specific way of determining importance.
	// Maybe do something with  ORES's "drafttopic" model.
	const autoImportance = 'Low';
	this.items.forEach( ( banner ) => {
		if ( !banner.hasImportanceRatings || banner.originalImportanceValue ) {
			return;
		}
		const importanceItem = banner.importanceDropdown.getMenu().findSelectedItem();
		if ( importanceItem && importanceItem.getData() ) {
			return;
		}
		banner.importanceDropdown.getMenu().selectItemByData( autoImportance );
		banner.importanceDropdown.setAutofilled( true );
	} );
};

BannerListWidget.prototype.setPreferences = function ( prefs ) {
	this.preferences = prefs;
	this.items.forEach( ( banner ) => banner.setPreferences( prefs ) );
	this.autofillClassRatings();
	this.autofillImportanceRatings();
	this.addShellTemplateIfNeeeded();
};

BannerListWidget.prototype.makeWikitext = function () {
	const shellTemplate = this.items.find( ( banner ) => banner.isShellTemplate );
	const classValue = this.validateClassPlacement();
	const bannersWikitext = filterAndMap(
		this.items,
		( banner ) => !banner.isShellTemplate,
		( banner ) => banner.makeWikitext( { includeClass: canRateBanner( banner, !!shellTemplate ) } )
	).join( '\n' );
	log.debug( '[makeWikitext] items=%d, nonShellLen=%d', this.items.length, bannersWikitext.length );
	if ( !shellTemplate ) {
		return bannersWikitext;
	}
	return shellTemplate.makeWikitext( {
		classValue: usesShellClass() && classValue !== undefined ? classValue : shellTemplate.classDropdown.getValue(),
		innerContent: '\n' + bannersWikitext + '\n' +
			( shellTemplate.nonStandardTemplates ? shellTemplate.nonStandardTemplates + '\n' : '' )
	} );
};

BannerListWidget.prototype.validateClassPlacement = function () {
	const shell = this.items.find( ( banner ) => banner.isShellTemplate );
	if ( !shell && ( this.shellCreationPromise || shouldCreateShell( this.items.filter( ( banner ) => !banner.isShellTemplate ).length, this.preferences ) ) ) {
		throw new Error( i18n.t( 'error-shell-required' ) );
	}
	if ( !usesShellClass() || !shell ) {
		return;
	}
	const result = resolveShellClass( {
		projectClasses: this.items.filter( ( banner ) => !banner.isShellTemplate && banner.hasClassRatings )
			.map( ( banner ) => banner.classDropdown.getValue() ),
		shellClass: shell.classDropdown.getValue() || ( !shell.classChanged && formatClassRating( shell.originalClassValue ) ),
		hasExplicitClass: !!( shell.classChanged && !shell.classDropdown.autofilled ),
		allowedClasses: shell.classDropdown.getMenu().getItems().map( ( item ) => item.getData() )
	} );
	if ( result.error ) {
		throw new Error( i18n.t( result.error ) );
	}
	return result.value;
};

BannerListWidget.prototype.updateClassPlacement = function () {
	const hasShell = this.items.some( ( banner ) => banner.isShellTemplate );
	this.items.forEach( ( banner ) => {
		banner.inShell = hasShell;
		if ( banner.classDropdown ) {
			banner.classDropdown.toggle( canRateBanner( banner ) );
		}
	} );
};

export default BannerListWidget;
// </nowiki>
