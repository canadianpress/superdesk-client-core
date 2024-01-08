/* eslint-disable max-len */
/* tslint:disable:max-line-length */
import {CustomEditor3Entity} from 'core/editor3/constants';
import {onChange} from 'core/editor3/store/index';
import {convertFromRaw, RawDraftContentState} from 'draft-js';
import {AuthoringWorkspaceService} from './services/AuthoringWorkspaceService';

describe('authoring', () => {
    beforeEach(window.module('superdesk.apps.vocabularies'));
    beforeEach(window.module('superdesk.apps.archive'));
    beforeEach(window.module('superdesk.apps.authoring'));
    beforeEach(window.module('superdesk.apps.searchProviders'));
    beforeEach(window.module({
        TranslationService: {
            translationsEnabled: () => false,
        },
    }));

    it('set anpa category value for required subservice',
        inject(($q, $rootScope, $compile, vocabularies, archiveService, content, $templateCache) => {
            $templateCache.put(
                'scripts/apps/authoring/views/authoring-header.html',
                '<div>{{scope.item}}</div>',
            );

            var vocabulariesData = [
                {
                    _id: 'categories',
                    display_name: 'Categories',
                    type: 'manageable',
                    items: [{is_active: true, name: 'Motoring', qcode: 'paservice:motoring'}],
                },
                {
                    _id: 'subservice_motoring',
                    display_name: 'Motoring sub-service',
                    type: 'manageable',
                    service: {'paservice:motoring': 1},
                    priority: 2,
                    items: [{is_active: true, name: 'News', qcode: 'paservice:motoring:news'}],
                },
            ];
            var schema = {
                subject: {
                    mandatory_in_list: {
                        scheme: {
                            subservice_motoring: 'subservice_motoring',
                        },
                    },
                },
            };

            spyOn(archiveService, 'isLegal').and.returnValue(false);
            spyOn(content, 'getType').and.returnValue($q.resolve('motoring'));
            spyOn(content, 'editor').and.returnValue({});
            spyOn(content, 'schema').and.returnValue(schema);
            spyOn(vocabularies, 'getVocabularies').and.returnValue($q.when(vocabulariesData));

            var scope = $rootScope.$new();

            scope.item = {profile: 'motoring'};
            scope.schema = schema;

            $compile('<div sd-authoring-header></div>')(scope);
            scope.$digest();

            expect(scope.item.anpa_category.length).toBe(1);
            expect(scope.item.anpa_category[0].name).toBe('Motoring');
            expect(scope.item.anpa_category[0].qcode).toBe('paservice:motoring');
            expect(scope.item.anpa_category[0].scheme).toBeUndefined();
        }));

    it('generates annotations field from the editor state', inject((authoring) => {
        var contentStateRaw = {blocks: [{key: 'ak77o', text: 'test', type: 'unstyled', depth: 0, inlineStyleRanges: [{offset: 1, length: 2, style: 'ANNOTATION-1'}], entityRanges: [], data: {MULTIPLE_HIGHLIGHTS: {highlightsData: {'ANNOTATION-1': {data: {msg: '{"blocks":[{"key":"7f13c","text":"123","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}', email: 'a@a.com', annotationType: 'regular:001', authorId: '59c222237300870c9a7863b2', date: '2018-05-21T04:14:45.074Z', author: 'Andrew Powers', avatar: 'https://sd-master.test.superdesk.org/api/upload-raw/2018022710028/e5bc36e933881f6ad79962a085844b8616aecea0a87908db20033ac129d88cf2.jpg'}, type: 'ANNOTATION'}}, lastHighlightIds: {SPLIT_PARAGRAPH_SUGGESTION: 0, DELETE_SUGGESTION: 0, TOGGLE_BOLD_SUGGESTION: 0, MERGE_PARAGRAPHS_SUGGESTION: 0, ADD_SUGGESTION: 0, ADD_LINK_SUGGESTION: 0, ANNOTATION: 1, COMMENT: 0, BLOCK_STYLE_SUGGESTION: 0, TOGGLE_SUPERSCRIPT_SUGGESTION: 0, TOGGLE_SUBSCRIPT_SUGGESTION: 0, TOGGLE_UNDERLINE_SUGGESTION: 0, TOGGLE_STRIKETHROUGH_SUGGESTION: 0, CHANGE_LINK_SUGGESTION: 0, TOGGLE_ITALIC_SUGGESTION: 0, REMOVE_LINK_SUGGESTION: 0}, highlightsStyleMap: {'ANNOTATION-1': {borderBottom: '4px solid rgba(100, 205, 0, 0.6)'}}}, __PUBLIC_API__comments: []}}], entityMap: {}};
        var contentState = convertFromRaw(contentStateRaw as RawDraftContentState);

        var context: any = {
            pathToValue: 'body_html',
            item: {
                body_html: '<p>t<span annotation-id="1">es</span>t</p>',
                fields_meta: {
                    body_html: {
                        draftjsState: [contentStateRaw],
                    },
                },
            },
            $rootScope: {
                $applyAsync: () => {
                    expect(JSON.stringify(context.item.annotations))
                        .toEqual('[{"id":1,"type":"regular:001","body":"<p>123</p>"}]');
                },
            },
        };

        spyOn(context.$rootScope, '$applyAsync').and.callThrough();
        onChange.call(context, contentState);
        expect(context.$rootScope.$applyAsync).toHaveBeenCalled();
    }));

    it('synchronizes associations field from editor state', inject(() => {
        const entity1 = {guid: 'entity1', renditions: {original: {href: 'foo'}}};
        const entity2 = {guid: 'entity2', renditions: {original: {href: 'bar'}}};

        const contentStateRaw = {
            blocks: [
                {
                    key: 'aaaa1', text: 'test', type: 'unstyled', depth: 0, inlineStyleRanges: [], entityRanges: [],
                },
                {
                    key: 'aaaa2', text: ' ', type: 'atomic', depth: 0, inlineStyleRanges: [], entityRanges: [
                        {
                            offset: 0,
                            length: 1,
                            key: 0,
                        },
                    ],
                },
                {
                    key: 'aaaa3', text: ' ', type: 'atomic', depth: 0, inlineStyleRanges: [], entityRanges: [
                        {
                            offset: 0,
                            length: 1,
                            key: 1,
                        },
                    ],
                },
            ],
            entityMap: {
                0: {
                    data: {media: entity1},
                    type: CustomEditor3Entity.MEDIA,
                    mutability: 'MUTABLE',
                },
                1: {
                    data: {media: entity2},
                    type: CustomEditor3Entity.MEDIA,
                    mutability: 'MUTABLE',
                },
            },
        };
        const contentState = convertFromRaw(contentStateRaw as RawDraftContentState);

        const context = {
            pathToValue: 'body_html',
            item: {
                body_html: '<p>foo</p>',
                associations: {
                    foo: {foo: 1},
                    editor_1: {guid: 'existing assoc'},
                    editor_2: {guid: 'some old association'},
                },
                fields_meta: {
                    body_html: {
                        draftjsState: [contentStateRaw],
                    },
                },
            },
            $rootScope: {
                $applyAsync: () => null,
            },
        };

        onChange.call(context, contentState);
        expect(context.item.associations.foo).toEqual({foo: 1});
        expect(context.item.associations['editor_0']).toEqual(entity1);
        expect(context.item.associations.editor_1).toEqual(entity2);
        expect(context.item.associations.editor_2).toBe(null);
    }));

    describe('authoring workspace', () => {
        it('can open an item in new window', inject(($window, authoringWorkspace: AuthoringWorkspaceService) => {
            spyOn($window, 'open');
            authoringWorkspace.popup({_id: 'foo'}, 'edit');
            expect($window.open)
                .toHaveBeenCalledWith(
                    'http://server/#/workspace/monitoring?item=foo&action=edit&popup',
                    'foo',
                );
        }));
    });
});
