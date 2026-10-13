import fs from 'node:fs';
import path from 'node:path';

export const readJsonDirectory = ( directory ) => Object.fromEntries(
	fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()
		.map((name) => [path.basename(name, '.json'), JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))])
);

export const prepareLoaderSource = ( source, dictionaries, fallbackLanguage ) => {
	const labels = Object.fromEntries(Object.entries(dictionaries).map(([language, dictionary]) => [language, {
		'app-portlet-text': dictionary['app-portlet-text'],
		'app-portlet-tooltip': dictionary['app-portlet-tooltip']
	}]));
	return source.replace('/* RATER_LOADER_I18N */ {}', JSON.stringify(labels))
		.replace("/* RATER_LOADER_FALLBACK_LANGUAGE */ ''", JSON.stringify(fallbackLanguage));
};
