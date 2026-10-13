import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';
import { readJsonDirectory } from './scripts/localization-data.js';

export default defineConfig({
	define: {
		RATER_I18N_DICTIONARIES: JSON.stringify(readJsonDirectory(path.resolve('i18n'))),
		RATER_WIKI_CONFIGS: JSON.stringify(readJsonDirectory(path.resolve('rater/data')))
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./test/setup.js'],
		exclude: [...configDefaults.exclude, 'test/regression/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'test/',
				'dist/',
				'**/*.config.js',
				'**/*.test.js'
			]
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'@components': path.resolve(__dirname, 'src/components'),
			'@services': path.resolve(__dirname, 'src/services'),
			'@utils': path.resolve(__dirname, 'src/utils'),
			'@constants': path.resolve(__dirname, 'src/constants'),
			'@styles': path.resolve(__dirname, 'src/styles')
		}
	}
});
