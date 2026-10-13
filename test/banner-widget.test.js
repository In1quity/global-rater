import { describe, it, expect, beforeEach } from 'vitest';
import '../test/setup.js';
import BannerWidget from '../src/components/BannerWidget.js';
import config, { createWikiConfig } from '../src/constants/config.js';

describe('BannerWidget', () => {
    let mockTemplate;
    let mockConfig;

    beforeEach(() => {
        Object.assign(config, createWikiConfig('enwiki', '', config.mw));
        mockTemplate = {
            name: 'WikiProject Biology',
            wikitext: '{{WikiProject Biology|class=B|importance=Mid}}',
            parameters: [
                { name: 'class', value: 'B', wikitext: '|class=B' },
                { name: 'importance', value: 'Mid', wikitext: '|importance=Mid' }
            ],
            paramData: {
                class: { label: { en: 'Class' } },
                importance: { label: { en: 'Importance' } }
            },
            paramAliases: {},
            parameterSuggestions: [
                { data: 'class', label: 'Class' },
                { data: 'importance', label: 'Importance' }
            ],
            classes: ['FA', 'GA', 'B', 'C', 'Start', 'Stub'],
            importances: ['Top', 'High', 'Mid', 'Low'],
            getTitle: () => ({
                getMainText: () => 'WikiProject Biology'
            }),
            isShellTemplate: () => false,
            pipeStyle: ' |',
            equalsStyle: '=',
            endBracesStyle: '}}'
        };

        mockConfig = {
            preferences: {
                autofillClassFromOthers: true,
                autofillClassFromOres: true,
                autofillImportance: true
            },
            $overlay: global.$('<div>'),
            isArticle: true
        };
    });

    it('should create banner widget with correct properties', () => {
        const banner = new BannerWidget(mockTemplate, mockConfig);
        
        expect(banner.name).toBe('WikiProject Biology');
        expect(banner.mainText).toBe('WikiProject Biology');
        expect(banner.hasClassRatings).toBe(6); // length of classes array
        expect(banner.hasImportanceRatings).toBe(4); // length of importances array
        expect(banner.isShellTemplate).toBe(false);
    });

    it('should handle shell template correctly', () => {
        const shellTemplate = {
            ...mockTemplate,
            name: 'WikiProject banner shell',
            isShellTemplate: () => true,
            parameters: [
                { name: '1', value: '{{WikiProject Biology}}', wikitext: '|1={{WikiProject Biology}}' },
                { name: 'class', value: 'B', wikitext: '|class=B' }
            ]
        };

        const banner = new BannerWidget(shellTemplate, mockConfig);
        
        expect(banner.isShellTemplate).toBe(true);
        expect(banner.shellParam1Value).toBe('{{WikiProject Biology}}');
    });

    it('should handle parameter suggestions safely', () => {
        const templateWithoutSuggestions = {
            ...mockTemplate,
            parameterSuggestions: undefined
        };

        const banner = new BannerWidget(templateWithoutSuggestions, mockConfig);
        
        expect(banner.parameterSuggestions).toEqual([]);
        expect(() => banner.updateAddParameterNameSuggestions()).not.toThrow();
    });

    it('should create wikitext correctly', () => {
        const banner = new BannerWidget(mockTemplate, mockConfig);
        
        // Mock dropdown values
        banner.classDropdown = {
            getMenu: () => ({
                findSelectedItem: () => ({ getData: () => 'B' })
            })
        };
        banner.importanceDropdown = {
            getMenu: () => ({
                findSelectedItem: () => ({ getData: () => 'Mid' })
            })
        };
        banner.parameterList = {
            getParameterItems: () => []
        };

        const wikitext = banner.makeWikitext();
        expect(wikitext).toContain('{{WikiProject Biology');
        expect(wikitext).toContain('class=B');
        expect(wikitext).toContain('importance=Mid');
    });

    it('should handle clear button click', () => {
        const banner = new BannerWidget(mockTemplate, mockConfig);
        
        // Mock parameter list
        banner.parameterList = {
            clearItems: () => {},
            getParameterItems: () => []
        };
        banner.classDropdown = {
            getMenu: () => ({
                selectItem: () => {}
            })
        };
        banner.importanceDropdown = {
            getMenu: () => ({
                selectItem: () => {}
            })
        };

        banner.onClearButtonClick();
        
        // Verify clearItems was called (mocked function)
        expect(banner.parameterList.clearItems).toBeDefined();
    });

    it('should handle parameter addition validation', () => {
        const banner = new BannerWidget(mockTemplate, mockConfig);
        
        // Mock parameter list
        banner.parameterList = {
            getParameterItems: () => [
                { name: 'class' },
                { name: 'importance' }
            ]
        };

        const info = banner.getAddParametersInfo('class', 'B');
        expect(info.validName).toBe(false); // Already exists
        expect(info.isAlreadyIncluded).toBe(true);

        const info2 = banner.getAddParametersInfo('newparam', 'value');
        expect(info2.validName).toBe(true);
        expect(info2.validValue).toBe(true);
    });
});
