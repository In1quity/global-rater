import { normaliseYesNo, filterAndMap } from '@utils/util.js';
import HorizontalLayoutWidget from './HorizontalLayoutWidget.js';
import i18n from '@services/i18n.js';
// <nowiki>

function ParameterWidget( parameter, paramData, config ) {
	// Configuration initialization
	config = config || {};
	// Call parent constructor
	ParameterWidget.super.call( this, config );
	this.$overlay = config.$overlay;

	this.name = parameter.name;
	this.value = parameter.value;
	this.autofilled = parameter.autofilled;
	this.isInvalid = ( parameter.value === null || typeof parameter.value === 'undefined' );
	this.paramData = paramData || {};
	this.allowedValues = ( this.paramData.allowedValues || [] ).slice();
	this.isRequired = this.paramData.required;
	this.isSuggested = this.paramData.suggested;

	// Make a checkbox if only 1 or 2 allowed values
	switch ( this.allowedValues.length ) {
		case 1:
			this.allowedValues[ 1 ] = null;
		/* fall-through */
		case 2:
			const isFirstAllowedVal = (
				this.allowedValues.indexOf( parameter.value ) === 0 ||
				this.allowedValues.map( normaliseYesNo ).indexOf( normaliseYesNo( parameter.value ) ) === 0
			);
			const isSecondAllowedVal = (
				this.allowedValues.indexOf( parameter.value || null ) === 1 ||
				this.allowedValues.map( normaliseYesNo ).indexOf( parameter.value ? normaliseYesNo( parameter.value ) : null ) === 1
			);
			const isIndeterminate = !isFirstAllowedVal && !isSecondAllowedVal;
			this.checkbox = new OO.ui.CheckboxInputWidget( {
				selected: isIndeterminate ? undefined : isFirstAllowedVal,
				indeterminate: isIndeterminate ? true : undefined
			} );
			this.checkbox.$element.addClass( 'rater-parameterWidget-checkbox' );
			break;
		default:
			// No checkbox
	}

	/* --- EDIT PARAMETER LAYOUT --- */

	this.input = new OO.ui.ComboBoxInputWidget( {
		value: this.value,
		// label: parameter.name + " =",
		// labelPosition: "before",
		options: filterAndMap(
			this.allowedValues,
			( val ) => val !== null,
			( val ) => ( { data: val, label: val } )
		),
		$overlay: this.$overlay
	} );
	this.input.$element.addClass( 'rater-parameterWidget-input' );

	this.confirmButton = new OO.ui.ButtonWidget( {
		icon: 'check',
		label: i18n.t( 'button-done' ),
		framed: false,
		flags: 'progressive'
	} );
	this.confirmButton.$element.addClass( 'rater-parameterWidget-confirmButton' );

	this.cancelButton = new OO.ui.ButtonWidget( {
		icon: 'undo',
		label: i18n.t( 'action-cancel' ),
		framed: false
	} );

	this.deleteButton = new OO.ui.ButtonWidget( {
		icon: this.isRequired ? 'restore' : 'trash',
		label: i18n.t( this.isRequired ? 'parameter-required' : 'button-delete' ),
		framed: false,
		flags: 'destructive',
		disabled: this.isRequired
	} );

	this.editButtonControls = new OO.ui.ButtonGroupWidget( {
		items: [
			this.confirmButton,
			this.cancelButton,
			this.deleteButton
		]
	} );
	this.editButtonControls.$element.addClass( 'rater-parameterWidget-editButtonGroup' );

	this.editLayoutControls = new HorizontalLayoutWidget( {
		items: [
			this.input,
			this.editButtonControls
		]
		// $element: $("<div style='width: 48%;margin:0;'>")
	} );

	this.editLayout = new OO.ui.FieldLayout( this.editLayoutControls, {
		label: this.name + ' =',
		align: 'top',
		help: i18n.metadataText( this.paramData, 'description' ) || false,
		helpInline: true
	} ).toggle();
	this.editLayout.$element.find( 'label.oo-ui-inline-help' ).addClass( 'rater-parameterWidget-editLayoutHelp' );

	/* --- READ (COLLAPSED) DISPLAY OF PARAMETER --- */

	this.invalidIcon = new OO.ui.IconWidget( {
		icon: 'block',
		title: i18n.t( 'parameter-invalid' ),
		flags: 'destructive'
	} ).toggle( this.isInvalid );
	this.invalidIcon.$element.addClass( 'rater-parameterWidget-invalidIcon' );
	this.fullLabel = new OO.ui.LabelWidget( {
		label: this.name +
			( this.value ?
				' = ' + this.value :
				' '
			)
	} );
	this.fullLabel.$element.addClass( 'rater-parameterWidget-fullLabel' );
	this.autofilledIcon = new OO.ui.IconWidget( {
		icon: 'robot',
		title: i18n.t( 'parameter-autofilled' ),
		flags: 'progressive'
	} ).toggle( this.autofilled );
	this.autofilledIcon.$element.addClass( 'rater-parameterWidget-autofilledIcon' );
	this.editButton = new OO.ui.ButtonWidget( {
		icon: 'edit',
		framed: false
	} );
	this.editButton.$element.addClass( 'rater-parameterWidget-editButton' );

	this.readLayout = new OO.ui.HorizontalLayout( {
		items: [
			this.invalidIcon,
			this.fullLabel,
			this.autofilledIcon,
			this.editButton
		]
	} );
	this.readLayout.$element.addClass( 'rater-parameterWidget-readLayout' );
	if ( this.checkbox ) {
		this.readLayout.addItems( [ this.checkbox ], 2 );
	}

	/* --- CONTAINER FOR BOTH LAYOUTS --- */
	this.$element = $( '<div>' ).addClass( 'rater-parameterWidget' );
	if ( this.autofilled ) {
		this.$element.addClass( 'rater-parameterWidget-autofilled' );
	} else if ( this.isInvalid ) {
		this.$element.addClass( 'rater-parameterWidget-invalid' );
	} else {
		this.$element.addClass( 'rater-parameterWidget-normal' );
	}
	this.$element.append( this.readLayout.$element, this.editLayout.$element );

	this.editButton.connect( this, { click: 'onEditClick' } );
	this.confirmButton.connect( this, { click: 'onConfirmClick' } );
	this.cancelButton.connect( this, { click: 'onCancelClick' } );
	this.deleteButton.connect( this, { click: 'onDeleteClick' } );
	if ( this.checkbox ) {
		this.checkbox.connect( this, { change: 'onCheckboxChange' } );
	}
}
OO.inheritClass( ParameterWidget, OO.ui.Widget );

ParameterWidget.prototype.onUpdatedSize = function () {
	// Emit an "updatedSize" event so the parent window can update size, if needed
	this.emit( 'updatedSize' );
};

ParameterWidget.prototype.onEditClick = function () {
	this.readLayout.toggle( false );
	this.editLayout.toggle( true );
	this.$element.removeClass( 'rater-parameterWidget-normal rater-parameterWidget-autofilled rater-parameterWidget-invalid' )
		.addClass( 'rater-parameterWidget-editing' );
	this.input.focus();
	this.onUpdatedSize();
};

ParameterWidget.prototype.onConfirmClick = function () {
	this.setValue(
		this.input.getValue()
	);
	this.readLayout.toggle( true );
	this.editLayout.toggle( false );
	this.onUpdatedSize();
};

ParameterWidget.prototype.onCancelClick = function () {
	this.input.setValue( this.value );
	this.readLayout.toggle( true );
	this.editLayout.toggle( false );
	this.onUpdatedSize();
};

ParameterWidget.prototype.onDeleteClick = function () {
	this.delete();
};

ParameterWidget.prototype.onCheckboxChange = function ( isSelected, isIndeterminate ) {
	if ( isIndeterminate ) {
		return;
	}
	if ( isSelected ) {
		this.setValue( this.allowedValues[ 0 ] );
	} else {
		this.setValue( this.allowedValues[ 1 ] );
	}
};

ParameterWidget.prototype.delete = function () {
	this.emit( 'delete' );
};

ParameterWidget.prototype.setValue = function ( val ) {
	// Turn off autofill stylings/icon
	this.autofilled = false;
	this.autofilledIcon.toggle( false );
	this.$element.removeClass( 'rater-parameterWidget-autofilled' );

	// Update the stored value
	this.value = val;

	// Update the input value for edit mode
	this.input.setValue( this.value );

	// Update validity
	this.isInvalid = ( this.value === null || typeof this.value === 'undefined' );
	this.invalidIcon.toggle( this.isInvalid );
	this.$element.removeClass( 'rater-parameterWidget-normal rater-parameterWidget-invalid' )
		.addClass( this.isInvalid ? 'rater-parameterWidget-invalid' : 'rater-parameterWidget-normal' );

	// Updated the label for read mode
	this.fullLabel.setLabel(
		this.name +
		( this.value ?
			' = ' + this.value :
			''
		)
	);

	// Update the checkbox (if there is one)
	if ( this.checkbox ) {
		const isFirstAllowedVal = (
			this.allowedValues.indexOf( val ) === 0 ||
			this.allowedValues.map( normaliseYesNo ).indexOf( normaliseYesNo( val ) ) === 0
		);
		const isSecondAllowedVal = (
			this.allowedValues.indexOf( val || null ) === 1 ||
			this.allowedValues.map( normaliseYesNo ).indexOf( val ? normaliseYesNo( val ) : null ) === 1
		);
		const isIndeterminate = !isFirstAllowedVal && !isSecondAllowedVal;
		this.checkbox.setIndeterminate( isIndeterminate, true );
		if ( !isIndeterminate ) {
			const isSelected = isFirstAllowedVal;
			this.checkbox.setSelected( isSelected, true );
		}
	}

	// Emit a change event
	this.emit( 'change' );
};

ParameterWidget.prototype.setAutofilled = function () {
	this.autofilled = true;
	this.autofilledIcon.toggle( true );
	this.$element.removeClass( 'rater-parameterWidget-normal' )
		.addClass( 'rater-parameterWidget-autofilled' );
};

ParameterWidget.prototype.makeWikitext = function ( pipeStyle, equalsStyle ) {
	if ( this.isInvalid ) {
		return '';
	}
	return pipeStyle + this.name + equalsStyle + ( this.value || '' );
};

ParameterWidget.prototype.focusInput = function () {
	return this.input.focus();
};

export default ParameterWidget;
// </nowiki>
