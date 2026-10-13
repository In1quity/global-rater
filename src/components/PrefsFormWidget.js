import config from '@constants/config.js';
import i18n from '@services/i18n.js';
// <nowiki>

function PrefsFormWidget( prefsConfig ) {
	// Configuration initialization
	const prefsOptions = prefsConfig || {};
	// Call parent constructor
	PrefsFormWidget.super.call( this, prefsOptions );

	this.$element.addClass( 'rater-prefsFormWidget' );

	this.layout = new OO.ui.FieldsetLayout( {
		label: i18n.t( 'dialog-prefs' ),
		$element: this.$element
	} );

	this.preferences = {
		autostart: {
			input: new OO.ui.ToggleSwitchWidget(),
			label: i18n.t( 'prefs-autostart' )
		},
		autostartRedirects: {
			input: new OO.ui.ToggleSwitchWidget(),
			label: i18n.t( 'prefs-autostart-redirects' )
		},
		autostartNamespaces: {
			input: new mw.widgets.NamespacesMultiselectWidget(),
			label: i18n.t( 'prefs-autostart-namespaces' )
		},
		bypassRedirects: {
			input: new OO.ui.ToggleSwitchWidget(),
			label: i18n.t( 'prefs-bypass-redirects' )
		},
		autofillClassFromOthers: {
			input: new OO.ui.ToggleSwitchWidget(),
			label: i18n.t( 'prefs-autofill-class-others' )
		},
		autofillClassFromOres: {
			input: new OO.ui.ToggleSwitchWidget(),
			label: i18n.t( 'prefs-autofill-class-ores' )
		},
		autofillImportance: {
			input: new OO.ui.ToggleSwitchWidget(),
			label: i18n.t( 'prefs-autofill-importance' )
		},
		collapseParamsLowerLimit: {
			input: new OO.ui.NumberInputWidget( { min: 1 } ),
			label: i18n.t( 'prefs-min-params' )
		},
		shellCreation: {
			input: new OO.ui.DropdownInputWidget( {
				value: 'wiki',
				options: [
					{ data: 'wiki', label: i18n.t( 'prefs-shell-wiki' ) },
					{ data: 'never', label: i18n.t( 'prefs-shell-never' ) },
					{ data: 'always', label: i18n.t( 'prefs-shell-always' ) },
					{ data: '2', label: i18n.t( 'prefs-shell-two' ) },
					{ data: '3', label: i18n.t( 'prefs-shell-three' ) }
				]
			} ),
			label: i18n.t( 'prefs-shell-creation' )
		},
		watchlist: {
			input: new OO.ui.ButtonSelectWidget( {
				items: [
					new OO.ui.ButtonOptionWidget( {
						data: 'preferences',
						label: i18n.t( 'prefs-watchlist-default' ),
						title: i18n.t( 'prefs-watchlist-default-title' )
					} ),
					new OO.ui.ButtonOptionWidget( {
						data: 'watch',
						label: i18n.t( 'prefs-watchlist-always' ),
						title: i18n.t( 'prefs-watchlist-always-title' )
					} ),
					new OO.ui.ButtonOptionWidget( {
						data: 'nochange',
						label: i18n.t( 'prefs-watchlist-never' ),
						title: i18n.t( 'prefs-watchlist-never-title' )
					} )
				]
			} ).selectItemByData( 'preferences' ),
			label: i18n.t( 'prefs-watchlist-label' )
		},
		resetCache: {
			input: new OO.ui.ButtonWidget( {
				label: i18n.t( 'prefs-reset-cache' ),
				title: i18n.t( 'prefs-reset-cache-title' ),
				flags: [ 'destructive' ]
			} )
		}
	};

	const groups = [
		{ label: 'prefs-group-startup', names: [ 'autostart', 'autostartRedirects', 'autostartNamespaces' ] },
		{ label: 'prefs-group-assessments', names: [ 'autofillClassFromOthers', 'autofillClassFromOres', 'autofillImportance' ] },
		{ label: 'prefs-group-projects', names: [ 'shellCreation', 'bypassRedirects', 'collapseParamsLowerLimit' ] },
		{ label: 'prefs-group-saving', names: [ 'watchlist', 'resetCache' ] }
	];
	this.layout.addItems( groups.map( ( group ) => new OO.ui.FieldsetLayout( {
		label: i18n.t( group.label ),
		classes: [ 'rater-prefsFormWidget-section' ],
		items: group.names.map( ( prefName ) => {
			const preference = this.preferences[ prefName ];
			const isToggle = preference.input instanceof OO.ui.ToggleSwitchWidget;
			return new OO.ui.FieldLayout( preference.input, {
				label: preference.label,
				align: isToggle ? 'left' : 'top',
				classes: isToggle ? [ 'rater-prefsFormWidget-toggle' ] : []
			} );
		} )
	} ) ) );

	this.preferences.resetCache.input.connect( this, { click: 'onResetCacheClick' } );
}
OO.inheritClass( PrefsFormWidget, OO.ui.Widget );

PrefsFormWidget.prototype.setPrefValues = function ( prefs ) {
	prefs = Object.assign( {}, config.defaultPrefs, prefs );
	for ( const prefName in prefs ) {
		const value = prefs[ prefName ];
		const input = this.preferences[ prefName ] && this.preferences[ prefName ].input;
		switch ( input && input.constructor.name ) {
			case 'OoUiButtonSelectWidget':
				input.selectItemByData( value );
				break;
			case 'OoUiNumberInputWidget':
			case 'OoUiDropdownInputWidget':
			case 'OoUiToggleSwitchWidget':
				input.setValue( value );
				break;
			case 'MwWidgetsNamespacesMultiselectWidget':
				input.clearItems();
				value.forEach( ( ns ) => input.addTag(
					ns.toString(),
					ns === 0 ?
						i18n.t( 'namespace-main' ) :
						config.mw.wgFormattedNamespaces[ ns ]
				)
				);
				break;
		}
	}
};

PrefsFormWidget.prototype.getPrefs = function () {
	const prefs = {};
	for ( const prefName in this.preferences ) {
		const input = this.preferences[ prefName ].input;
		let value;
		switch ( input.constructor.name ) {
			case 'OoUiButtonSelectWidget':
				value = input.findSelectedItem().getData();
				break;
			case 'OoUiToggleSwitchWidget':
			case 'OoUiDropdownInputWidget':
				value = input.getValue();
				break;
			case 'OoUiNumberInputWidget':
				value = Number( input.getValue() ); // widget uses strings, not numbers!
				break;
			case 'MwWidgetsNamespacesMultiselectWidget':
				value = input.getValue().map( Number ); // widget uses strings, not numbers!
				break;
		}
		prefs[ prefName ] = value;
	}
	return prefs;
};

PrefsFormWidget.prototype.onResetCacheClick = function () {
	OO.ui.confirm( i18n.t( 'confirm-reset-cache' ) )
		.then( ( confirmed ) => {
			if ( confirmed ) {
				this.emit( 'resetCache' );
			}
		} );
};

export default PrefsFormWidget;
// </nowiki>
