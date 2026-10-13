import { spawnSync } from 'node:child_process';

// Each version runs in a separate process because OOUI attaches itself to global OO.
for (const ooui of ['oojs-ui-legacy', 'oojs-ui-stable', 'oojs-ui']) {
	console.log('\nTesting ' + ooui);
	const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.regression.config.js'], {
		env: { ...process.env, RATER_TEST_OOUI: ooui },
		stdio: 'inherit'
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status || 1);
}
