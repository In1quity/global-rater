$.when(
	mw.loader.using( [ 'mediawiki.util' ] ),
	$.ready
).then( () => {
	const conf = mw.config.get( [ 'wgNamespaceNumber', 'wgPageName' ] );
	// Do not operate on Special: pages, nor on non-existent pages or their talk pages
	if ( conf.wgNamespaceNumber < 0 || $( 'li.new[id|=ca-nstab]' ).length ) {
		return;
	}
	// Do not operate on top-level User and User_talk pages (only on subpages)
	if (
		conf.wgNamespaceNumber >= 2 &&
		conf.wgNamespaceNumber <= 3 &&
		!conf.wgPageName.includes( '/' )
	) {
		return;
	}
	// Add a portlet link that will load the main script and its dependencies on demand
	const linkId = 'ca-rater';
	if ( !document.getElementById( linkId ) ) {
		const portletLink = mw.util.addPortletLink( 'p-cactions', '#', 'Rater', linkId, 'Rate quality and importance', '5' ) ||
			mw.util.addPortletLink( 'p-tb', '#', 'Rater', linkId, 'Rate quality and importance', '5' );
		$( portletLink ).on( 'click', ( event ) => {
			event.preventDefault();
			// Load required modules first, then load the main script
			const reqModules = [
				'mediawiki.api', 'mediawiki.Title',
				'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows',
				'oojs-ui.styles.icons-content', 'oojs-ui.styles.icons-interactions',
				'oojs-ui.styles.icons-moderation', 'oojs-ui.styles.icons-editing-core',
				'mediawiki.widgets', 'mediawiki.widgets.NamespacesMultiselectWidget'
			];
			mw.loader.using( reqModules ).then( () => {
				// Get the title using template substitution (so the same source file be used on both main and sandbox scripts)
				const title = /* </nowiki> */ 'User:Iniquity/rater-core.js'; /* <nowiki> */
				mw.loader.load( 'https://www.mediawiki.org/w/index.php?title=' + title + '&action=raw&ctype=text/javascript' );
			} );
		} );
	}
} );
