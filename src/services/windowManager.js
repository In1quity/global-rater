import MainWindow from '../components/MainWindow.js';
// <nowiki>

const factory = new OO.Factory();

// Register window constructors with the factory.
factory.register( MainWindow );

const manager = new OO.ui.WindowManager( {
	factory: factory
} );
// Scope dialog overrides to Rater's windows, leaving other OOUI dialogs intact.
manager.$element.addClass( 'rater-windowManager' );
$( document.body ).append( manager.$element );

export default manager;
// </nowiki>
