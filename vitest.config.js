import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
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
