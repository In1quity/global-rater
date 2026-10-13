// MediaWiki edits cannot preserve literal C0 characters emitted by minification.
// Hex escapes retain the same JavaScript string and regexp values when pasted.
const escapeWikiControlCharacters = ( source ) => source.replace(
	/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,
	( character ) => '\\x' + character.charCodeAt( 0 ).toString( 16 ).padStart( 2, '0' )
);

export { escapeWikiControlCharacters };
