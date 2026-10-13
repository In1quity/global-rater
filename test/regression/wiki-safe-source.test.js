import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { escapeWikiControlCharacters } from '../../scripts/wiki-safe-source.js';

it('keeps parser marker semantics after a wiki strips literal control characters', () => {
	const marker = String.fromCharCode(1);
	const source = '"first' + marker + 'second".replace(/\\x01/g, "|")';
	const sanitized = (text) => text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '\ufffd');
	expect(runInNewContext(sanitized(source))).not.toBe('first|second');
	expect(runInNewContext(sanitized(escapeWikiControlCharacters(source)))).toBe('first|second');
});

it('escapes control characters in strings and regexp literals without changing their values', () => {
	const marker = String.fromCharCode(1);
	const source = '/[' + marker + ']/.test("' + marker + '")';
	expect(runInNewContext(escapeWikiControlCharacters(source))).toBe(runInNewContext(source));
	expect(escapeWikiControlCharacters(source)).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
	expect(escapeWikiControlCharacters('\tline one\nline two\r\n')).toBe('\tline one\nline two\r\n');
});
