import { makeErrorMsg } from '@services/api.js';
import i18n from '@services/i18n.js';
import { ensureCodex, mountCodexApp } from '@services/codex.js';
import logger from '@services/logger.js';
// <nowiki>

// Codex-based LoadDialog replacement

export const openLoadDialogCodex = function ( options ) {
	const log = logger.get( 'load' );
	options = options || {};
	const tasks = [
		i18n.t( 'loading-prefs' ),
		i18n.t( 'loading-banners' ),
		i18n.t( 'loading-talk' ),
		i18n.t( 'loading-parse' ),
		i18n.t( 'loading-params' ),
		i18n.t( 'loading-subject' ),
		i18n.t( 'loading-ores' )
	];
	const oresVisible = !!options.ores;
	return ensureCodex().then( () => mountCodexApp( {
		data() {
			return {
				open: true,
				title: String( i18n.t( 'loading-title' ) ),
				defaultAction: { label: i18n.t( 'button-close' ) },
				loadingLabel: i18n.t( 'loading-title' ),
				initLabel: i18n.t( 'loading-init' ),
				doneLabel: i18n.t( 'loading-done' ),
				failedLabel: i18n.t( 'loading-failed' ),
				// Indeterminate progress: Codex ProgressBar
				tasks: tasks.map( ( label, index ) => ( { label, done: false, error: null, hidden: index === 6 && !oresVisible } ) ),
				canClose: false
			};
		},
		computed: {
			displayedTasks() {
				return this.tasks.filter( ( t ) => !t.hidden );
			}
		},
		template: `
<cdx-dialog v-model:open="open" :use-close-button="false" :title="title" :default-action="defaultAction" @default="onClose">
	<div>
		<div style="margin-bottom:8px"><cdx-progress-bar :inline="true" :aria-label="loadingLabel" /></div>
		<p class="rater-loadDialog-initLabel"><strong>{{ initLabel }}</strong></p>
		<p v-for="t in displayedTasks" :key="t.label" class="rater-loadDialog-taskLabel">{{ t.label }}<span v-if="t.done"> {{ doneLabel }}</span><span v-else-if="t.error"> {{ failedLabel }} {{ t.error }}</span></p>
	</div>
</cdx-dialog>
		`,
		methods: {
			// No determinate increments needed for indeterminate ProgressBar
			markDone( index ) {
				const t = this.tasks[ index ];
				if ( t ) {
					t.done = true;
				}
			},
			markError( index, code, info ) {
				const t = this.tasks[ index ];
				if ( t ) {
					t.error = makeErrorMsg( code, info );
				}
				this.canClose = true;
			},
			onClose() {
				try {
					const active = document.activeElement;
					if ( active && typeof active.blur === 'function' ) {
						active.blur();
					}
				} catch ( _ ) {}
				this.open = false;
			},
			allVisibleDone() {
				return this.tasks.filter( ( t ) => !t.hidden ).every( ( t ) => t.done || t.error );
			}
		},
		mounted() {
			// Wire external promises to update UI (only visible tasks with actual promises)
			// Step 0 ("loading-prefs") now receives a promise from setup when available
			// If a promise is missing or falsy, mark it done to avoid blocking
			const hasPrefsPromise = Array.isArray( options.promises ) && options.promises.length > 0 && !!options.promises[ 0 ];
			if ( !hasPrefsPromise ) {
				this.markDone( 0 );
			}
			const raw = Array.isArray( options.promises ) ? options.promises.slice() : [];
			// Promises order from setup: [prefs, banners, talk, parse, params, subject, ores]
			// Map to task indices [0, 1, 2, 3, 4, 5, 6]
			const indexMap = [ 0, 1, 2, 3, 4, 5, 6 ];
			const pairs = raw.map( ( p, i ) => ( { index: indexMap[ i ], p } ) )
				.filter( ( x ) => Number.isInteger( x.index ) )
				.filter( ( x ) => x.index !== 6 || !this.tasks[ 6 ].hidden )
				.map( ( x ) => ( { index: x.index, p: x.p || Promise.reject( new Error( 'missing-promise' ) ) } ) );
			log.debug( 'pairs', pairs.map( ( x ) => ( { index: x.index, hasP: !!x.p } ) ) );
			pairs.forEach( ( x ) => {
				Promise.resolve( x.p ).then( () => {
					this.markDone( x.index );
					log.debug( 'DONE', x.index, this.tasks[ x.index ] && this.tasks[ x.index ].label );
					if ( this.allVisibleDone() ) {
						log.debug( 'allVisibleDone -> close' );
						this.onClose();
					}
				}, ( err ) => {
					const code = err && ( err.code || err );
					this.markError( x.index, code, err );
					log.debug( 'FAIL', x.index, this.tasks[ x.index ] && this.tasks[ x.index ].label, err );
					if ( this.allVisibleDone() ) {
						log.debug( 'allVisibleDone -> close' );
						this.onClose();
					}
				} );
			} );
		}
	} ) );
};

export default { openLoadDialogCodex };

// </nowiki>
