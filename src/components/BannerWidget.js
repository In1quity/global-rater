import ParameterListWidget from './ParameterListWidget.js';
import i18n from '@services/i18n.js';
import ParameterWidget from './ParameterWidget.js';
import DropdownParameterWidget from './DropdownParameterWidget.js';
import SuggestionLookupTextInputWidget from './SuggestionLookupTextInputWidget.js';
import { filterAndMap, classMask, importanceMask } from '@utils/util.js';
import { Template } from '@utils/models/TemplateModel.js';
import { isShellTemplate } from '@services/templateShell.js';
import { loadParamDataAndSuggestions } from '@services/templateParams.js';
import { loadRatings } from '@services/templateRatings.js';
import { addMissingParams } from '@services/autofill.js';
import { getWithRedirectTo } from '@services/templateRedirects.js';
import HorizontalLayoutWidget from './HorizontalLayoutWidget.js';
import globalConfig from '@constants/config.js';
import { canRateBanner, isClassParameter, usesShellClass, formatClassRating, displayClassRating } from '@services/shellPolicy.js';
import { serializeTemplate } from '@utils/serializeTemplate.js';
// <nowiki>

// Helpers
const isNameOrAliasOf = function ( paramName, canonicalLower, aliasMap ) {
	const n = String( paramName ).toLowerCase();
	if ( n === canonicalLower ) {
		return true;
	}
	const aliasCanon = aliasMap && ( aliasMap[ paramName ] || aliasMap[ n ] );
	return !!( aliasCanon && String( aliasCanon ).toLowerCase() === canonicalLower );
};

const selectInitialValue = function ( options, rawValue, maskFn ) {
	let out = rawValue;
	if ( out && Array.isArray( options ) && options.length ) {
		const exact = options.find( ( v ) => String( v ).toLowerCase() === String( out ).toLowerCase() );
		out = exact || ( maskFn ? maskFn( out ) : out );
	} else {
		out = maskFn ? maskFn( out ) : out;
	}
	return out;
};

function BannerWidget( template, config ) {
	// Configuration initialization
	config = config || {};
	// Call parent constructor
	BannerWidget.super.call( this, config );
	this.$overlay = config.$overlay;

	/* --- PREFS --- */
	this.preferences = config.preferences;

	/* --- PROPS --- */
	this.paramData = template.paramData;
	this.paramAliases = template.paramAliases || {};
	this.classParamName = template.classParamName || 'class';
	this.importanceParamName = template.importanceParamName || 'importance';
	this.parameterSuggestions = template.parameterSuggestions || [];
	this.name = template.name;
	this.wikitext = template.wikitext;
	this.pipeStyle = template.pipeStyle;
	this.equalsStyle = template.equalsStyle;
	this.endBracesStyle = template.endBracesStyle;
	this.mainText = template.getTitle().getMainText();
	this.redirectTargetMainText = template.redirectTarget && template.redirectTarget.getMainText();
	this.isShellTemplate = isShellTemplate( template );
	if ( this.isShellTemplate ) {
		this.classParamName = globalConfig.shell.classParamName || 'class';
	}
	this.changed = template.parameters.some( ( parameter ) => parameter.autofilled ); // initially false, unless some parameters were autofilled
	this.hasClassRatings = template.classes && template.classes.length;
	this.hasImportanceRatings = template.importances && template.importances.length;
	this.inactiveProject = template.inactiveProject;
	const originalClassParam = template.parameters.find( ( parameter ) => isClassParameter( this, parameter.name ) );
	const originalImportanceParam = template.parameters.find( ( parameter ) => isNameOrAliasOf( parameter.name, String( this.importanceParamName ).toLowerCase(), this.paramAliases ) );
	this.originalClassValue = originalClassParam && originalClassParam.value;
	this.originalImportanceValue = originalImportanceParam && originalImportanceParam.value;

	/* --- TITLE AND RATINGS --- */

	this.removeButton = new OO.ui.ButtonWidget( {
		icon: 'trash',
		label: i18n.t( 'button-remove-banner' ),
		title: i18n.t( 'button-remove-banner' ),
		flags: 'destructive'
	} );
	this.removeButton.$element.addClass( 'rater-bannerWidget-removeButton' );
	this.clearButton = new OO.ui.ButtonWidget( {
		icon: 'cancel',
		label: i18n.t( 'button-clear-parameters' ),
		title: i18n.t( 'button-clear-parameters' ),
		flags: 'destructive'
	} );
	this.clearButton.$element.addClass( 'rater-bannerWidget-clearButton' );

	this.titleButtonsGroup = new OO.ui.ButtonGroupWidget( {
		items: [ this.removeButton, this.clearButton ]
	} );
	this.titleButtonsGroup.$element.addClass( 'rater-bannerWidget-titleButtonsGroup' );

	this.mainLabelPopupButton = new OO.ui.PopupButtonWidget( {
		label: `{{${ template.getTitle().getMainText() }}}${ this.inactiveProject ? i18n.t( 'label-inactive-suffix' ) : '' }`,
		$overlay: this.$overlay,
		indicator: 'down',
		framed: false,
		popup: {
			$content: this.titleButtonsGroup.$element,
			width: Math.min( 360, window.innerWidth - 48 ),
			padded: false,
			align: 'force-right',
			anchor: false
		}
	} );
	this.mainLabelPopupButton.$element.addClass( 'rater-bannerWidget-mainLabelPopup' );

	// Rating dropdowns
	if ( this.isShellTemplate ) {
		this.classDropdown = new DropdownParameterWidget( {
			label: new OO.ui.HtmlSnippet( '<span class="rater-bannerWidget-labelMuted">' + i18n.t( 'label-class' ) + '</span>' ),
			menu: {
				items: [
					new OO.ui.MenuOptionWidget( {
						data: null,
						label: new OO.ui.HtmlSnippet( `<span class="rater-bannerWidget-labelMuted">(${ config.isArticle ? i18n.t( 'option-no-class' ) : i18n.t( 'option-auto-detect' ) })</span>` )
					} ),
					...Array.from( new Set( globalConfig.bannerDefaults.classes.map( formatClassRating ) ) ).map( ( classname ) => new OO.ui.MenuOptionWidget( {
						data: classname,
						label: displayClassRating( classname )
					} )
					)
				]
			},
			$overlay: this.$overlay
		} );
		this.classDropdown.getMenu().selectItemByData( formatClassRating( classMask( this.originalClassValue ) ) );
	} else if ( this.hasClassRatings ) {
		// selectInitialValue helper is defined above
		this.classDropdown = new DropdownParameterWidget( {
			label: new OO.ui.HtmlSnippet( '<span class="rater-bannerWidget-labelMuted">' + i18n.t( 'label-class' ) + '</span>' ),
			menu: {
				items: [
					new OO.ui.MenuOptionWidget( {
						data: null,
						label: new OO.ui.HtmlSnippet( `<span class="rater-bannerWidget-labelMuted">(${ config.isArticle ? i18n.t( usesShellClass() ? 'option-inherit-from-shell' : 'option-no-class' ) : i18n.t( 'option-auto-detect' ) })</span>` )
					} ),
					...Array.from( new Set( template.classes.map( formatClassRating ) ) ).map( ( classname ) => new OO.ui.MenuOptionWidget( {
						data: classname,
						label: displayClassRating( classname )
					} )
					)
				]
			},
			$overlay: this.$overlay
		} );
		const classParam = template.parameters.find( ( parameter ) => isNameOrAliasOf( parameter.name, String( template.classParamName || 'class' ).toLowerCase(), template.paramAliases ) );
		const preClass = formatClassRating( selectInitialValue( template.classes, classParam && classParam.value, classMask ) );
		if ( preClass && !template.classes.map( formatClassRating ).includes( preClass ) ) {
			this.classDropdown.getMenu().addItems( [ new OO.ui.MenuOptionWidget( { data: preClass, label: displayClassRating( preClass ) } ) ] );
		}
		this.classDropdown.getMenu().selectItemByData( preClass );
	}

	if ( this.hasImportanceRatings ) {
		this.importanceDropdown = new DropdownParameterWidget( {
			label: new OO.ui.HtmlSnippet( '<span class="rater-bannerWidget-labelMuted">' + i18n.t( 'label-importance' ) + '</span>' ),
			menu: {
				items: [
					new OO.ui.MenuOptionWidget( {
						data: null, label: new OO.ui.HtmlSnippet( `<span class="rater-bannerWidget-labelMuted">(${ config.isArticle ? i18n.t( 'option-no-importance' ) : i18n.t( 'option-auto-detect' ) })</span>` )
					} ),
					...template.importances.map( ( importance ) => new OO.ui.MenuOptionWidget( {
						data: importance,
						label: importance
					} )
					)
				]
			},
			$overlay: this.$overlay
		} );
		const importanceParam = template.parameters.find( ( parameter ) => isNameOrAliasOf( parameter.name, String( template.importanceParamName || 'importance' ).toLowerCase(), template.paramAliases ) );
		const preImp = selectInitialValue( template.importances, importanceParam && importanceParam.value, importanceMask );
		if ( preImp && !template.importances.includes( preImp ) ) {
			this.importanceDropdown.getMenu().addItems( [ new OO.ui.MenuOptionWidget( { data: preImp, label: preImp } ) ] );
		}
		this.importanceDropdown.getMenu().selectItemByData( preImp );
	}

	this.titleLayout = new OO.ui.HorizontalLayout( {
		items: [ this.mainLabelPopupButton ]
	} );
	if ( this.hasClassRatings || this.isShellTemplate ) {
		this.titleLayout.addItems( [ this.classDropdown ] );
		this.classDropdown.toggle( canRateBanner( this ) );
	}
	if ( this.hasImportanceRatings ) {
		this.titleLayout.addItems( [ this.importanceDropdown ] );
	}

	/* --- PARAMETERS LIST --- */

	const parameterWidgets = filterAndMap(
		template.parameters,
		( param ) => {
			if ( this.isShellTemplate ) {
				if ( String( param.name ) === '1' ) {
					this.shellParam1Value = param.value;
					return false;
				}
				return !isClassParameter( this, param.name );
			}
			const classCanon = String( template.classParamName || 'class' ).toLowerCase();
			const impCanon = String( template.importanceParamName || 'importance' ).toLowerCase();
			return !( ( this.hasClassRatings && isNameOrAliasOf( param.name, classCanon, template.paramAliases ) ) ||
				( this.hasImportanceRatings && isNameOrAliasOf( param.name, impCanon, template.paramAliases ) ) );
		},
		( param ) => new ParameterWidget( param, template.paramData[ param.name ], { $overlay: this.$overlay } )
	);

	this.parameterList = new ParameterListWidget( {
		items: parameterWidgets,
		preferences: this.preferences
	} );

	/* --- ADD PARAMETER SECTION --- */

	this.addParameterNameInput = new SuggestionLookupTextInputWidget( {
		suggestions: template.parameterSuggestions,
		placeholder: i18n.t( 'placeholder-parameter-name' ),
		validate: function ( val ) {
			const { validName, name, value } = this.getAddParametersInfo( val );
			return ( !name && !value ) ? true : validName;
		}.bind( this ),
		allowSuggestionsWhenEmpty: true,
		$overlay: this.$overlay
	} );
	this.addParameterNameInput.$element.addClass( 'rater-bannerWidget-addParameterName' );
	this.updateAddParameterNameSuggestions();
	this.addParameterValueInput = new SuggestionLookupTextInputWidget( {
		placeholder: i18n.t( 'placeholder-parameter-value' ),
		validate: function ( val ) {
			const { validValue, name, value } = this.getAddParametersInfo( null, val );
			return ( !name && !value ) ? true : validValue;
		}.bind( this ),
		allowSuggestionsWhenEmpty: true,
		$overlay: this.$overlay
	} );
	this.addParameterValueInput.$element.addClass( 'rater-bannerWidget-addParameterValue' );
	this.addParameterButton = new OO.ui.ButtonWidget( {
		label: i18n.t( 'button-add' ),
		icon: 'add',
		flags: 'progressive'
	} ).setDisabled( true );
	this.addParameterControls = new HorizontalLayoutWidget( {
		items: [
			this.addParameterNameInput,
			new OO.ui.LabelWidget( { label: '=' } ),
			this.addParameterValueInput,
			this.addParameterButton
		]
	} );

	this.addParameterLayout = new OO.ui.FieldLayout( this.addParameterControls, {
		label: i18n.t( 'label-add-parameter' ),
		align: 'top'
	} ).toggle( false );
	// A hack to make messages appear on their own line
	this.addParameterLayout.$element.find( '.oo-ui-fieldLayout-messages' ).css( {
		clear: 'both',
		'padding-top': 0
	} );

	/* --- OVERALL LAYOUT/DISPLAY --- */

	// Display the layout elements, and a rule
	this.$element.addClass( 'rater-bannerWidget' ).append(
		this.titleLayout.$element,
		this.parameterList.$element,
		this.addParameterLayout.$element
	);
	if ( !this.isShellTemplate ) {
		this.$element.append( $( '<hr>' ) );
	}

	if ( this.isShellTemplate ) {
		this.$element.addClass( 'rater-bannerWidget-shellTemplate' );
	}

	/* --- EVENT HANDLING --- */

	if ( this.hasClassRatings || this.isShellTemplate ) {
		this.classDropdown.connect( this, { change: 'onClassChange' } );
	}
	if ( this.hasImportanceRatings ) {
		this.importanceDropdown.connect( this, { change: 'onImportanceChange' } );
	}
	this.parameterList.connect( this, {
		change: 'onParameterChange',
		addParametersButtonClick: 'showAddParameterInputs',
		updatedSize: 'onUpdatedSize'
	} );
	this.addParameterButton.connect( this, { click: 'onParameterAdd' } );
	this.addParameterNameInput.connect( this, {
		change: 'onAddParameterNameChange',
		enter: 'onAddParameterNameEnter',
		choose: 'onAddParameterNameEnter'
	} );
	this.addParameterValueInput.connect( this, {
		change: 'onAddParameterValueChange',
		enter: 'onAddParameterValueEnter',
		choose: 'onAddParameterValueEnter'
	} );
	this.removeButton.connect( this, { click: 'onRemoveButtonClick' } );
	this.clearButton.connect( this, { click: 'onClearButtonClick' } );

	/* --- APPLY PREF -- */
	if ( this.preferences.bypassRedirects ) {
		this.bypassRedirect();
	}

}
OO.inheritClass( BannerWidget, OO.ui.Widget );

/**
 * @param {String} templateName
 * @param {Object} [data]
 * @param {Boolean} data.withoutRatings
 * @param {Boolean} data.isWrapper
 * @param {Object} config
 * @returns {Promise<BannerWidget>}
 */
BannerWidget.newFromTemplateName = function ( templateName, data, config ) {
	const template = new Template();
	template.name = templateName;
	if ( data && data.withoutRatings ) {
		template.withoutRatings = true;
	}
	return getWithRedirectTo( template )
		.then( ( resolvedTemplate ) => loadParamDataAndSuggestions( resolvedTemplate )
			.then( () => loadRatings( resolvedTemplate ) )
			.then( () => addMissingParams( resolvedTemplate ) ) )
		.then( ( finalTemplate ) => new BannerWidget( finalTemplate, config ) );
};

BannerWidget.prototype.onUpdatedSize = function () {
	// Emit an "updatedSize" event so the parent window can update size, if needed
	this.emit( 'updatedSize' );
};

BannerWidget.prototype.setChanged = function () {
	this.changed = true;
	this.emit( 'changed' );
	if ( ( globalConfig.shell.biographyBannerNames || [] ).includes( this.mainText ) ||
		( globalConfig.shell.biographyBannerNames || [] ).includes( this.redirectTargetMainText ) ) {
		// Emit event so BannerListWidget can update the banner shell template (if present)
		this.emit( 'biographyBannerChange' );
	}
};

BannerWidget.prototype.onParameterChange = function () {
	this.setChanged();
	this.updateAddParameterNameSuggestions();
};

BannerWidget.prototype.onClassChange = function () {
	this.setChanged();
	this.classChanged = true;
	const classItem = this.classDropdown.getMenu().findSelectedItem();
	if ( classItem && classItem.getData() === null ) {
		// clear selection
		this.classDropdown.getMenu().selectItem();
	}
};

BannerWidget.prototype.onImportanceChange = function () {
	this.setChanged();
	this.importanceChanged = true;
	const importanceItem = this.importanceDropdown.getMenu().findSelectedItem();
	if ( importanceItem && importanceItem.getData() === null ) {
		// clear selection
		this.importanceDropdown.getMenu().selectItem();
	}
};

BannerWidget.prototype.showAddParameterInputs = function () {
	this.addParameterLayout.toggle( true );
	this.addParameterNameInput.focus();
	this.onUpdatedSize();
};

BannerWidget.prototype.getAddParametersInfo = function ( nameInputVal, valueInputVal ) {
	const rawName = nameInputVal && nameInputVal.trim() || this.addParameterNameInput.getValue().trim();
	const name = this.paramAliases[ rawName ] || rawName;
	const paramAlreadyIncluded = isClassParameter( this, name ) ||
		isNameOrAliasOf( name, String( this.importanceParamName ).toLowerCase(), this.paramAliases ) ||
		( name === '1' && this.isShellTemplate ) ||
		this.parameterList.getParameterItems().some( ( paramWidget ) => paramWidget.name === name || this.paramAliases[ paramWidget.name ] === name );
	const value = valueInputVal && valueInputVal.trim() || this.addParameterValueInput.getValue().trim();
	const autovalue = name && this.paramData[ name ] && this.paramData[ name ].autovalue || null;
	return {
		validName: !!( name && !paramAlreadyIncluded && ( !this.isShellTemplate || this.paramData[ name ] ) ),
		validValue: !!( value || autovalue ),
		isAutovalue: !!( !value && autovalue ),
		isAlreadyIncluded: !!( name && paramAlreadyIncluded ),
		name,
		value,
		autovalue
	};
};

BannerWidget.prototype.onAddParameterNameChange = function () {
	const { validName, validValue, isAutovalue, isAlreadyIncluded, name, autovalue } = this.getAddParametersInfo();
	// Set value input placeholder as the autovalue
	this.addParameterValueInput.$input.attr( 'placeholder', autovalue || '' );
	// Set suggestions, if the parameter has a list of allowed values
	const suggestedValues = this.paramData[ name ] && ( this.paramData[ name ].allowedValues || this.paramData[ name ].suggestedvalues );
	const allowedValues = suggestedValues && suggestedValues.map( ( val ) => ( { data: val, label: val } ) );
	this.addParameterValueInput.setSuggestions( allowedValues || [] );
	// Set button disabled state based on validity
	this.addParameterButton.setDisabled( !validName || !validValue );
	// Show notice if autovalue will be used
	this.addParameterLayout.setNotices( validName && isAutovalue ? [ i18n.t( 'notice-parameter-autofilled' ) ] : [] );
	// Show error is the banner already has the parameter set
	this.addParameterLayout.setErrors( isAlreadyIncluded ? [ i18n.t( 'error-parameter-present' ) ] : [] );
};

BannerWidget.prototype.onAddParameterNameEnter = function () {
	this.addParameterValueInput.focus();
};

BannerWidget.prototype.onAddParameterValueChange = function () {
	const { validName, validValue, isAutovalue } = this.getAddParametersInfo();
	this.addParameterButton.setDisabled( !validName || !validValue );
	this.addParameterLayout.setNotices( validName && isAutovalue ? [ 'Parameter value will be autofilled' ] : [] );
};

BannerWidget.prototype.onAddParameterValueEnter = function () {
	// Make sure button state has been updated
	this.onAddParameterValueChange();
	// Do nothing if button is disabled (i.e. name and/or value are invalid)
	if ( this.addParameterButton.isDisabled() ) {
		return;
	}
	// Add parameter
	this.onParameterAdd();
};

BannerWidget.prototype.onParameterAdd = function () {
	const { validName, validValue, name, value, autovalue } = this.getAddParametersInfo();
	if ( !validName || !validValue ) {
		// Error should already be shown via onAddParameter...Change methods
		return;
	}
	const newParameter = new ParameterWidget(
		{
			name: name,
			value: value || autovalue
		},
		this.paramData[ name ],
		{ $overlay: this.$overlay }
	);
	this.parameterList.addItems( [ newParameter ] );
	this.addParameterNameInput.setValue( '' );
	this.addParameterValueInput.setValue( '' );
	this.addParameterNameInput.$input.focus();
};

BannerWidget.prototype.updateAddParameterNameSuggestions = function () {
	const paramsInUse = {};
	this.parameterList.getParameterItems().forEach(
		( paramWidget ) => {
			paramsInUse[ paramWidget.name ] = true;
			if ( this.paramAliases[ paramWidget.name ] ) {
				paramsInUse[ this.paramAliases[ paramWidget.name ] ] = true;
			}
		}
	);
	const suggestions = Array.isArray( this.parameterSuggestions ) ? this.parameterSuggestions : [];
	this.addParameterNameInput.setSuggestions(
		suggestions.filter( ( suggestion ) => !paramsInUse[ suggestion.data ] )
	);
};

BannerWidget.prototype.onRemoveButtonClick = function () {
	this.emit( 'remove' );
};

BannerWidget.prototype.onClearButtonClick = function () {
	this.parameterList.clearItems(
		this.parameterList.getParameterItems()
	);
	if ( this.hasClassRatings || this.isShellTemplate ) {
		this.classDropdown.getMenu().selectItem();
		this.classChanged = true;
	}
	if ( this.hasImportanceRatings ) {
		this.importanceDropdown.getMenu().selectItem();
		this.importanceChanged = true;
	}
	this.setChanged();
};

BannerWidget.prototype.bypassRedirect = function () {
	if ( !this.redirectTargetMainText ) {
		return;
	}
	// Store the bypassed name
	this.bypassedName = this.name;
	// Update title label
	this.mainLabelPopupButton.setLabel( `{{${ this.redirectTargetMainText }}}${ this.inactiveProject ? ' (inactive)' : '' }` );
	// Update properties
	this.name = this.redirectTargetMainText;
	this.mainText = this.redirectTargetMainText;
	this.redirectTargetMainText = null;
	this.setChanged();
};

BannerWidget.prototype.makeWikitext = function ( options ) {
	options = options || {};
	// For non-shell banners, if nothing changed and original wikitext is available, reuse it.
	// Shells always use current state and the inner content supplied by the list.
	const includeClass = typeof options.includeClass === 'boolean' ? options.includeClass : canRateBanner( this );
	if ( includeClass && !this.isShellTemplate && !this.changed && this.wikitext && formatClassRating( this.originalClassValue ) === this.originalClassValue ) {
		return this.wikitext;
	}
	const classItem = ( this.hasClassRatings || this.isShellTemplate ) && this.classDropdown.getMenu().findSelectedItem();
	const classVal = formatClassRating( Object.prototype.hasOwnProperty.call( options, 'classValue' ) ? options.classValue : classItem && classItem.getData() );
	const importanceItem = this.hasImportanceRatings && this.importanceDropdown.getMenu().findSelectedItem();
	const importanceVal = !this.importanceChanged && this.originalImportanceValue ? this.originalImportanceValue : importanceItem && importanceItem.getData();

	const parameters = [];
	if ( includeClass && ( this.hasClassRatings || this.isShellTemplate ) && classVal ) {
		parameters.push( { name: this.classParamName || 'class', value: classVal } );
	}
	if ( this.hasImportanceRatings && importanceVal !== null ) {
		parameters.push( { name: this.importanceParamName || 'importance', value: importanceVal } );
	}
	this.parameterList.getParameterItems().forEach( ( parameter ) => {
		if ( isClassParameter( this, parameter.name ) && ( !includeClass || this.hasClassRatings || this.isShellTemplate ) ) {
			return;
		}
		parameters.push( { name: parameter.name, value: parameter.value, isInvalid: parameter.isInvalid } );
	} );
	if ( this.isShellTemplate && Object.prototype.hasOwnProperty.call( options, 'innerContent' ) ) {
		parameters.push( { name: '1', value: options.innerContent } );
	}
	return serializeTemplate( {
		name: this.name,
		parameters,
		pipeStyle: this.pipeStyle,
		equalsStyle: this.equalsStyle,
		endBracesStyle: this.endBracesStyle,
		isShellTemplate: this.isShellTemplate
	} );
};

BannerWidget.prototype.setPreferences = function ( prefs ) {
	this.preferences = prefs;
	if ( this.preferences.bypassRedirects ) {
		this.bypassRedirect();
	}
	this.parameterList.setPreferences( prefs );
};

export default BannerWidget;
// </nowiki>
