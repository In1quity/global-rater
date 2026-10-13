import config from '@constants/config.js';
import i18n from '@services/i18n.js';
import SuggestionLookupTextInputWidget from './SuggestionLookupTextInputWidget.js';
import { buildBannerSuggestions } from '@services/autofill.js';
import { formatClassRating, displayClassRating } from '@services/shellPolicy.js';
// <nowiki>

// Helper function to remove the first matching prefix from banner name
function removeBannerPrefix( bannerName ) {
	const prefixes = config.bannerNamePrefixes || [];
	for ( const prefix of prefixes ) {
		if ( bannerName.toLowerCase().startsWith( prefix.toLowerCase() ) ) {
			return bannerName.slice( prefix.length );
		}
	}
	return bannerName;
}

function TopBarWidget( opts ) {
	// Configuration initialization
	opts = Object.assign(
		{
			expanded: false,
			framed: false,
			padded: false
		},
		opts || {}
	);
	// Call parent constructor
	TopBarWidget.super.call( this, opts );
	this.$overlay = opts.$overlay;

	// Search box
	this.searchBox = new SuggestionLookupTextInputWidget( {
		placeholder: i18n.t( 'topbar-add-wikiproject' ),
		$overlay: this.$overlay
	} );
	this.searchBox.$element.addClass( 'rater-topBarWidget-searchBox' );
	if ( opts && opts.banners ) {
		this.searchBox.setSuggestions( buildBannerSuggestions( opts.banners ) );
	}

	// Add button
	this.addBannerButton = new OO.ui.ButtonWidget( {
		icon: 'add',
		title: i18n.t( 'button-add' ),
		flags: 'progressive'
	} );
	this.addBannerButton.$element.addClass( 'rater-topBarWidget-addButton' );
	const searchContainer = document.createElement( 'div' );
	searchContainer.className = 'rater-topBarWidget-searchContainer';
	searchContainer.appendChild( this.searchBox.$element[ 0 ] );
	searchContainer.appendChild( this.addBannerButton.$element[ 0 ] );

	// Set all classes/importances
	// in the style of a popup button with a menu (is actually a dropdown with a hidden label, because that makes the coding easier.)
	this.setAllDropDown = new OO.ui.DropdownWidget( {
		icon: 'tag',
		label: i18n.t( 'topbar-set-all' ),
		invisibleLabel: true,
		menu: {
			items: [
				new OO.ui.MenuSectionOptionWidget( {
					label: i18n.t( 'topbar-classes' )
				} ),
				new OO.ui.MenuOptionWidget( {
					data: { class: null },
					label: new OO.ui.HtmlSnippet( '<span class="rater-bannerWidget-labelMuted">(' + i18n.t( 'topbar-no-class' ) + ')</span>' )
				} ),
				...Array.from( new Set( config.bannerDefaults.classes.map( formatClassRating ) ) ).map( ( classname ) => new OO.ui.MenuOptionWidget( {
					data: { class: classname },
					label: displayClassRating( classname )
				} )
				),
				new OO.ui.MenuSectionOptionWidget( {
					label: i18n.t( 'topbar-importances' )
				} ),
				new OO.ui.MenuOptionWidget( {
					data: { importance: null },
					label: new OO.ui.HtmlSnippet( '<span class="rater-bannerWidget-labelMuted">(' + i18n.t( 'topbar-no-importance' ) + ')</span>' )
				} ),
				...config.bannerDefaults.importances.map( ( importance ) => new OO.ui.MenuOptionWidget( {
					data: { importance: importance },
					label: importance
				} )
				)
			]
		},
		$overlay: this.$overlay
	} );
	this.setAllDropDown.$element.addClass( 'rater-topBarWidget-setAllDropdown' );
	this.setAllDropDown.$element[ 0 ].setAttribute( 'title', i18n.t( 'topbar-set-all' ) );

	// Remove all banners button
	this.removeAllButton = new OO.ui.ButtonWidget( {
		icon: 'trash',
		title: i18n.t( 'button-remove-all' ),
		flags: 'destructive'
	} );

	// Clear all parameters button
	this.clearAllButton = new OO.ui.ButtonWidget( {
		icon: 'cancel',
		title: i18n.t( 'button-clear-all' ),
		flags: 'destructive'
	} );

	// Group the buttons together
	this.wrapShellButton = new OO.ui.ButtonWidget( {
		label: i18n.t( 'button-wrap-projects' ),
		title: i18n.t( 'button-wrap-projects-title' )
	} ).setDisabled( true );
	this.shellAvailable = false;
	this.menuButtons = new OO.ui.ButtonGroupWidget( {
		items: [
			this.wrapShellButton,
			this.removeAllButton,
			this.clearAllButton
		]
	} );
	this.menuButtons.$element.addClass( 'rater-topBarWidget-menuButtons' );
	// Include the dropdown in the group
	this.menuButtons.$element[ 0 ].insertBefore( this.setAllDropDown.$element[ 0 ], this.menuButtons.$element[ 0 ].firstChild );

	// Put everything into a layout
	this.$element.addClass( 'rater-topBarWidget' );
	this.$element[ 0 ].appendChild( searchContainer );
	this.$element[ 0 ].appendChild( this.menuButtons.$element[ 0 ] );

	/* --- Event handling --- */

	this.searchBox.connect( this, {
		enter: 'onSearchSelect',
		choose: 'onSearchSelect'
	} );
	this.addBannerButton.connect( this, { click: 'onSearchSelect' } );
	this.setAllDropDown.getMenu().connect( this, { choose: 'onRatingChoose' } );
	this.removeAllButton.connect( this, { click: 'onRemoveAllClick' } );
	this.clearAllButton.connect( this, { click: 'onClearAllClick' } );
	this.wrapShellButton.connect( this, { click: 'onWrapShellClick' } );
}
OO.inheritClass( TopBarWidget, OO.ui.PanelLayout );

TopBarWidget.prototype.onSearchSelect = function ( data ) {
	this.emit( 'searchSelect', data );
};

TopBarWidget.prototype.onRatingChoose = function ( item ) {
	const data = item.getData();
	if ( data.class || data.class === null ) {
		this.emit( 'setClasses', data.class );
	}
	if ( data.importance || data.importance === null ) {
		this.emit( 'setImportances', data.importance );
	}
};

TopBarWidget.prototype.onRemoveAllClick = function () {
	this.emit( 'removeAll' );
};

TopBarWidget.prototype.onClearAllClick = function () {
	this.emit( 'clearAll' );
};

TopBarWidget.prototype.onWrapShellClick = function () {
	this.emit( 'wrapProjects' );
};

TopBarWidget.prototype.setShellAvailable = function ( available ) {
	this.shellAvailable = available;
	this.wrapShellButton.setDisabled( this.disabled || !available );
};

TopBarWidget.prototype.setDisabled = function ( disable ) {
	this.disabled = disable;
	this.wrapShellButton.setDisabled( disable || !this.shellAvailable );
	[
		this.searchBox,
		this.addBannerButton,
		this.setAllDropDown,
		this.removeAllButton,
		this.clearAllButton
	].forEach( ( widget ) => widget.setDisabled( disable ) );
};

export default TopBarWidget;
// </nowiki>
