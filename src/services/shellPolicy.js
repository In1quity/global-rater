import config from '@constants/config.js';
// <nowiki>

const usesShellClass = function () {
	return config.shell.classLocation === 'shell';
};

const canRateBanner = function ( banner, hasShell = banner.inShell ) {
	return banner.isShellTemplate ? usesShellClass() : !( usesShellClass() && hasShell );
};

const shouldCreateShell = function ( projectCount ) {
	const minimum = Number( config.shell.minProjects );
	return projectCount > 0 && ( config.shell.autoCreate || ( minimum > 0 && projectCount >= minimum ) );
};

const formatClassRating = function ( value ) {
	if ( !value ) {
		return value;
	}
	const numerals = [ 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X' ];
	const romanIndex = numerals.indexOf( String( value ).toUpperCase() );
	if ( config.classFormat === 'arabic' && romanIndex !== -1 ) {
		return String( romanIndex + 1 );
	}
	if ( config.classFormat === 'roman' && /^(?:[1-9]|10)$/.test( String( value ) ) ) {
		return numerals[ Number( value ) - 1 ];
	}
	return value;
};

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

export { usesShellClass, canRateBanner, isClassParameter, shouldCreateShell, formatClassRating, resolveShellClass };
// </nowiki>
