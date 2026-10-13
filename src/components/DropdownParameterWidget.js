// <nowiki>
import i18n from '@services/i18n.js';

function DropdownParameterWidget( config ) {
	// Configuration initialization
	config = Object.assign( {}, config || {} );

	// Call parent constructor
	DropdownParameterWidget.super.call( this, config );

	this.$overlay = config.$overlay;
	this.$element.addClass( 'rater-dropdownParameterWidget' );

	// Autofilled icon
	this.autofilled = !!config.autofilled;
	this.autofilledIcon = new OO.ui.IconWidget( {
		icon: 'robot',
		title: i18n.t( 'parameter-autofilled' ),
		flags: 'progressive'
	} ).toggle( this.autofilled );
	this.autofilledIcon.$element.addClass( 'rater-dropdownParameterWidget-autofilledIcon' );
	this.$element.find( '.oo-ui-indicatorElement-indicator' ).before(
		this.autofilledIcon.$element
	);

	// Events
	this.menu.connect( this, {
		choose: 'onDropdownMenuChoose',
		select: 'onDropdownMenuSelect'
	} );
}
OO.inheritClass( DropdownParameterWidget, OO.ui.DropdownWidget );

DropdownParameterWidget.prototype.setAutofilled = function ( setAutofill ) {
	this.autofilledIcon.toggle( !!setAutofill );
	if ( setAutofill ) {
		this.$element.addClass( 'rater-dropdownParameterWidget-autofilled' );
	} else {
		this.$element.removeClass( 'rater-dropdownParameterWidget-autofilled' );
	}
	this.autofilled = !!setAutofill;
};

DropdownParameterWidget.prototype.onDropdownMenuChoose = function () {
	this.setAutofilled( false );
	this.emit( 'change' );
};

DropdownParameterWidget.prototype.onDropdownMenuSelect = function () {
	this.emit( 'change' );
};

DropdownParameterWidget.prototype.getValue = function () {
	const selectedItem = this.menu.findSelectedItem();
	return selectedItem && selectedItem.getData();
};

export default DropdownParameterWidget;
// </nowiki>
