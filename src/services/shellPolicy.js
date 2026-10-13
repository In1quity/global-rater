import config from '@constants/config.js';
// <nowiki>

const usesShellClass = function () {
	return config.shell.classLocation === 'shell';
};

const canRateBanner = function ( banner, hasShell = banner.inShell ) {
	return banner.isShellTemplate ? usesShellClass() : !( usesShellClass() && hasShell );
};

const shouldCreateShell = function ( projectCount, preferences = {} ) {
	const choice = String( preferences.shellCreation || 'wiki' );
	if ( choice === 'never' ) {
		return false;
	}
	if ( choice === 'always' ) {
		return projectCount > 0;
	}
	if ( choice === '2' || choice === '3' ) {
		return projectCount >= Number( choice );
	}
	const minimum = Number( config.shell.minProjects );
	return projectCount > 0 && ( config.shell.autoCreate || ( minimum > 0 && projectCount >= minimum ) );
};

const convertClassNotation = function ( value, format ) {
	if ( !value ) {
		return value;
	}
	const numerals = [ 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X' ];
	const romanIndex = numerals.indexOf( String( value ).toUpperCase() );
	if ( format === 'arabic' && romanIndex !== -1 ) {
		return String( romanIndex + 1 );
	}
	if ( format === 'roman' && /^(?:[1-9]|10)$/.test( String( value ) ) ) {
		return numerals[ Number( value ) - 1 ];
	}
	return value;
};

const formatClassRating = ( value ) => convertClassNotation( value, config.classFormat );
const displayClassRating = ( value ) => convertClassNotation( value, config.classDisplayFormat );

const isClassParameter = function ( banner, name ) {
	const canonical = String( banner.classParamName || 'class' ).toLowerCase();
	const lower = String( name ).toLowerCase();
	const alias = banner.paramAliases && ( banner.paramAliases[ name ] || banner.paramAliases[ lower ] );
	return lower === 'class' || lower === canonical || !!( alias && String( alias ).toLowerCase() === canonical );
};

// Resolve a shared assessment from plain values; validation must not change widgets.
const resolveShellClass = function ( options ) {
	const values = Array.from( new Set( options.projectClasses.concat( [ options.shellClass ] ).filter( Boolean ) ) );
	const value = options.hasExplicitClass ? options.shellClass : values[ 0 ];
	if ( !options.hasExplicitClass && values.length > 1 ) {
		return { error: 'error-conflicting-classes' };
	}
	if ( value && !options.allowedClasses.includes( value ) ) {
		return { error: 'error-unsupported-shell-class' };
	}
	return { value: value || null };
};

export { usesShellClass, canRateBanner, isClassParameter, shouldCreateShell, formatClassRating, displayClassRating, resolveShellClass };
// </nowiki>
