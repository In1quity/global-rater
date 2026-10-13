import config from './vitest.config.js';
import { configDefaults } from 'vitest/config';

export default {
	...config,
	test: {
		...config.test,
		setupFiles: ['./test/regression/setup.js'],
		exclude: configDefaults.exclude,
		include: ['test/regression/**/*.test.js', 'test/window-manager-styles.test.js'],
		testTimeout: 5000
	}
};
