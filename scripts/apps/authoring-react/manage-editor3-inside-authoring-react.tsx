/* eslint-disable react/no-multi-comp */
import * as React from 'react';
import {registerInternalExtension} from 'core/helpers/register-internal-extension';
import {
    IExtensionActivationResult,
    IEditorComponentProps,
    ICustomFieldType,
    IConfigComponentProps,
    RICH_FORMATTING_OPTION,
    IArticle,
    IArticleAction,
} from 'superdesk-api';
import {gettext, gettextPlural} from 'core/utils';
import {convertToRaw, ContentState} from 'draft-js';
import createEditorStore, {
    IEditorStore,
    initializeSpellchecker,
    getInitialSpellcheckerData,
    prepareEditor3StateForExport,
    getAnnotationsForField,
} from 'core/editor3/store';
import ng from 'core/services/ng';
import {Provider} from 'react-redux';
import {Store} from 'redux';
import {Editor3} from 'core/editor3/components';
import {noop} from 'lodash';
import {EDITOR3_RICH_FORMATTING_OPTIONS} from 'apps/workspace/content/components/get-content-profiles-form-config';
import {MultiSelect} from 'core/ui/components/MultiSelect';
import {
    setExternalOptions,
    EditorLimit,
    setHighlightCriteria,
    findPrev,
    findNext,
    replace,
    replaceAll,
    setSpellcheckerStatus,
} from 'core/editor3/actions';
import {Checkbox} from 'superdesk-ui-framework/react';
import {ReactContextForEditor3} from 'core/editor3/directive';
import {
    DEFAULT_UI_FOR_EDITOR_LIMIT,
    CharacterLimitUiBehavior,
    CharacterCountConfigModal,
} from 'apps/authoring/authoring/components/CharacterCountConfigButton';
import {CharacterCount2} from 'apps/authoring/authoring/components/CharacterCount';
import {showModal} from 'core/services/modalService';
import {countWords} from 'core/count-words';
import {getReadingTimeText} from 'apps/authoring/authoring/directives/ReadingTime';
import {CONTENT_FIELDS_DEFAULTS} from 'apps/authoring/authoring/helpers';
import {editor3StateToHtml} from 'core/editor3/html/to-html/editor3StateToHtml';
import {addEditorEventListener, dispatchEditorEvent} from './authoring-react-editor-events';
import {getAutocompleteSuggestions} from 'core/helpers/editor';
import {appConfig} from 'appConfig';
import {runTansa} from './editor3-tansa-integration';

interface IEditor3Config {
    editorFormat?: Array<RICH_FORMATTING_OPTION>;
    minLength?: number;
    maxLength?: number;
    singleLine?: boolean; // also limits to plain text
    cleanPastedHtml?: boolean;
}

export interface IEditor3Value {
    store: Store<IEditorStore>;
    contentState: ContentState;
}

interface IUserPreferences {
    characterLimitMode?: CharacterLimitUiBehavior;
}

type IProps = IEditorComponentProps<IEditor3Value, IEditor3Config, IUserPreferences>;

interface IState {
    /**
     * Wait until redux store is fully initialized before rendering the editor.
     * Initial spellchecking is done on `componentDidMount` and wouldn't work otherwise.
     */
    ready: boolean;

    autocompleteSuggestions: Array<string>;

    spellcheckerEnabled: boolean;
}

class Editor3Component extends React.PureComponent<IProps, IState> {
    private eventListenersToRemoveBeforeUnmounting: Array<() => void>;

    constructor(props: IProps) {
        super(props);

        this.state = {
            ready: false,
            autocompleteSuggestions: [],
            spellcheckerEnabled: false,
        };

        this.eventListenersToRemoveBeforeUnmounting = [];

        this.getCharacterLimitPreference = this.getCharacterLimitPreference.bind(this);
        this.syncPropsWithReduxStore = this.syncPropsWithReduxStore.bind(this);
        this.initializeEditor = this.initializeEditor.bind(this);
    }

    getCharacterLimitPreference(): EditorLimit | null {
        if (typeof this.props.config.maxLength !== 'number') {
            return null;
        }

        return {
            ui: this.props.userPreferences.characterLimitMode ?? DEFAULT_UI_FOR_EDITOR_LIMIT,
            chars: this.props.config.maxLength,
        };
    }

    syncPropsWithReduxStore() {
        const store = this.props.value.store;
        const spellcheck = this.state.spellcheckerEnabled ? ng.get('spellcheck') : null;

        store.dispatch(setExternalOptions({
            editorFormat: this.props.config.editorFormat ?? [],
            singleLine: this.props.config.singleLine ?? false,
            readOnly: this.props.readOnly ?? false,
            spellchecking: getInitialSpellcheckerData(spellcheck, this.props.language),
            limitConfig: this.getCharacterLimitPreference(),
            item: {
                language: this.props.language, // required for annotations to work
            },
        }));
    }

    /**
     * Can be called multiple times.
     */
    initializeEditor() {
        if (this.state.ready === true) {
            this.setState({ready: false});
        }

        const store = this.props.value.store;

        const spellcheck = ng.get('spellcheck');

        spellcheck.getDictionary(this.props.language).then((dict) => {
            spellcheck.isActiveDictionary = !!dict.length;
            spellcheck.setLanguage(this.props.language);
            spellcheck.setSpellcheckerStatus(true);

            this.syncPropsWithReduxStore();

            Promise.all([
                getAutocompleteSuggestions(this.props.editorId, this.props.language),
                initializeSpellchecker(store, spellcheck),
            ]).then((res) => {
                const [autocompleteSuggestions] = res;

                this.setState({ready: true, autocompleteSuggestions});

                /**
                 * If `spellchecker__set_status` is dispatched on `componentDidMount` in AuthoringReact,
                 * the event is fired before this component mounts and starts listening to the event.
                 * Because of this, requesting status explicitly is needed.
                 */
                dispatchEditorEvent('spellchecker__request_status', null);

                /**
                 * Avoid triggering `onChange` when nothing has actually changed.
                 * Spellchecker modifies inline styles (instead of being implemented as a decorator)
                 * and thus makes it impossible to check in a performant manner whether there
                 * were any actual changes when comparing 2 content states.
                 */
                setTimeout(() => {
                    store.subscribe(() => {
                        const contentState = store.getState().editorState.getCurrentContent();

                        if (this.props.value.contentState !== contentState) {
                            this.props.onChange({store, contentState});
                        }
                    });
                }, 1000);
            });
        });
    }

    componentDidMount() {
        this.initializeEditor();

        /**
         *
         * FIND AND REPLACE
         *
         */

        this.eventListenersToRemoveBeforeUnmounting.push(
            addEditorEventListener('find_and_replace__find', (event) => {
                const {editorId, text, caseSensitive} = event.detail;

                if (editorId !== this.props.editorId) {
                    return;
                }

                this.props.value.store.dispatch(
                    setHighlightCriteria({diff: {[text]: null}, caseSensitive}),
                );
            }),
        );

        this.eventListenersToRemoveBeforeUnmounting.push(
            addEditorEventListener('find_and_replace__find_prev', (event) => {
                const {editorId} = event.detail;

                if (editorId !== this.props.editorId) {
                    return;
                }

                this.props.value.store.dispatch(findPrev());
            }),
        );

        this.eventListenersToRemoveBeforeUnmounting.push(
            addEditorEventListener('find_and_replace__find_next', (event) => {
                const {editorId} = event.detail;

                if (editorId !== this.props.editorId) {
                    return;
                }

                this.props.value.store.dispatch(findNext());
            }),
        );

        this.eventListenersToRemoveBeforeUnmounting.push(
            addEditorEventListener('find_and_replace__replace', (event) => {
                const {editorId, replaceWith, replaceAllMatches} = event.detail;

                if (editorId !== this.props.editorId) {
                    return;
                }

                if (replaceAllMatches) {
                    this.props.value.store.dispatch(replaceAll(replaceWith));
                } else {
                    this.props.value.store.dispatch(replace(replaceWith));
                }
            }),
        );

        this.eventListenersToRemoveBeforeUnmounting.push(
            addEditorEventListener('spellchecker__set_status', (event) => {
                this.props.value.store.dispatch(setSpellcheckerStatus(event.detail));
            }),
        );
    }

    componentWillUnmount() {
        for (const fn of this.eventListenersToRemoveBeforeUnmounting) {
            fn();
        }
    }

    componentDidUpdate(prevProps: IProps) {
        if (this.props.value.store !== prevProps.value.store) {
            this.initializeEditor();
        } else if (
            this.props.config !== prevProps.config
            || this.props.readOnly !== prevProps.readOnly
            || this.props.userPreferences !== prevProps.userPreferences
            || this.props.language !== prevProps.language
        ) {
            this.syncPropsWithReduxStore();
        }
    }

    render() {
        if (this.state.ready !== true) {
            return null;
        }

        const store = this.props.value.store;
        const {config} = this.props;
        const characterLimitConfig = this.getCharacterLimitPreference();
        const plainText = this.props.value.contentState.getPlainText();
        const wordCount = countWords(plainText);
        const readingTime: string = getReadingTimeText(plainText, this.props.language);

        return (
            <Provider store={store}>
                <ReactContextForEditor3.Provider value={store}>
                    <div style={{display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'end'}}>
                        {
                            typeof this.props.config.maxLength === 'number' && (
                                <div style={{display: 'flex', gap: '6px'}}>
                                    <span className="char-count-base">
                                        {gettextPlural(wordCount, 'one word', '{{x}} words', {x: wordCount})}
                                    </span>

                                    <CharacterCount2
                                        limit={this.props.config.maxLength}
                                        html={false}
                                        item={this.props.value.contentState.getPlainText()}
                                    />

                                    <span className="char-count-base">{readingTime}</span>
                                </div>
                            )
                        }

                        {
                            characterLimitConfig != null && (
                                <div>
                                    <button
                                        onClick={() => {
                                            showModal(({closeModal}) => (
                                                <CharacterCountConfigModal
                                                    closeModal={closeModal}
                                                    value={characterLimitConfig.ui}
                                                    onChange={(ui) => {
                                                        this.props.onUserPreferencesChange({
                                                            ...characterLimitConfig,
                                                            characterLimitMode: ui,
                                                        });
                                                    }}
                                                />
                                            ));
                                        }}
                                    >
                                        <i className="icon-settings" />
                                    </button>
                                </div>
                            )
                        }
                    </div>

                    <Editor3
                        scrollContainer=".sd-editor-content__main-container"
                        singleLine={config.singleLine ?? false}
                        cleanPastedHtml={config.cleanPastedHtml ?? false}
                        autocompleteSuggestions={this.state.autocompleteSuggestions}
                    />
                </ReactContextForEditor3.Provider>
            </Provider>
        );
    }
}

class Editor3ConfigComponent extends React.PureComponent<IConfigComponentProps<IEditor3Config>> {
    render() {
        return (
            <div>
                <div>{gettext('Formatting options')}</div>
                <MultiSelect
                    items={EDITOR3_RICH_FORMATTING_OPTIONS.map((label) => ({id: label, label}))}
                    values={this.props.config?.editorFormat ?? []}
                    onChange={(editorFormat: Array<RICH_FORMATTING_OPTION>) => {
                        this.props.onChange({...this.props.config, editorFormat});
                    }}
                />

                <br />

                <div>{gettext('Minimum length')}</div>

                <input
                    type="number"
                    value={this.props.config.minLength}
                    onChange={(event) => {
                        this.props.onChange({...this.props.config, minLength: parseInt(event.target.value, 10)});
                    }}
                />

                <br />

                <div>{gettext('Maximum length')}</div>

                <input
                    type="number"
                    value={this.props.config.maxLength}
                    onChange={(event) => {
                        this.props.onChange({...this.props.config, maxLength: parseInt(event.target.value, 10)});
                    }}
                />

                <br />
                <br />

                <Checkbox
                    label={{text: gettext('Single line')}}
                    checked={this.props.config?.singleLine ?? false}
                    onChange={(val) => {
                        this.props.onChange({...this.props.config, singleLine: val});
                    }}
                />

                <br />

                <Checkbox
                    label={{text: gettext('Clean pasted HTML')}}
                    checked={this.props.config?.cleanPastedHtml ?? false}
                    onChange={(val) => {
                        this.props.onChange({...this.props.config, cleanPastedHtml: val});
                    }}
                />
            </div>
        );
    }
}

const editor3AuthoringReact = 'editor3--authoring-react';

export function registerEditor3AsCustomField() {
    const customFields: Array<ICustomFieldType<IEditor3Value, IEditor3Config, IUserPreferences>> = [
        {
            id: 'editor3',
            label: gettext('Editor3 (authoring-react)'),
            editorComponent: Editor3Component,
            previewComponent: Editor3Component,
            configComponent: Editor3ConfigComponent,

            retrieveStoredValue: (fieldId, article) => {
                const rawContentState = article.fields_meta?.[fieldId]?.['draftjsState'][0];

                const store = createEditorStore(
                    {
                        editorState: rawContentState ?? convertToRaw(ContentState.createFromText('')),
                        onChange: noop,
                        language: article.language,
                    },
                    ng.get('spellcheck'),
                    true,
                );

                return {
                    store,
                    contentState: store.getState().editorState.getCurrentContent(),
                };
            },

            storeValue: (fieldId, article, value, config) => {
                const contentState = prepareEditor3StateForExport(
                    value.store.getState().editorState.getCurrentContent(),
                );
                const rawContentState = convertToRaw(contentState);

                const generatedValue = (() => {
                    if (config.singleLine) {
                        return contentState.getPlainText();
                    } else {
                        return editor3StateToHtml(contentState);
                    }
                })();

                const annotations = getAnnotationsForField(article, fieldId);

                const articleUpdated: IArticle = {
                    ...article,
                    fields_meta: {
                        ...(article.fields_meta ?? {}),
                        [fieldId]: {
                            draftjsState: [rawContentState],
                        },
                    },
                };

                if (annotations.length > 0) {
                    articleUpdated.fields_meta[fieldId].annotations = annotations;
                }

                /**
                 * Output generated value to hardcoded fields
                 */
                if (CONTENT_FIELDS_DEFAULTS[fieldId] != null) {
                    articleUpdated[fieldId] = generatedValue;
                }

                // keep compatibility with existing output format
                if (fieldId === 'body_html') {
                    articleUpdated.annotations = annotations;
                }

                return articleUpdated;
            },
        },
    ];

    const result: IExtensionActivationResult = {
        contributions: {
            getAuthoringActions: (article, contentProfile, fieldsData) => {
                if (appConfig.features.useTansaProofing === true) {
                    const checkSpellingAction: IArticleAction = {
                        label: gettext('Check spelling'),
                        onTrigger: () => {
                            runTansa(contentProfile, fieldsData);
                        },
                    };

                    return Promise.resolve([checkSpellingAction]);
                } else {
                    return Promise.resolve([]);
                }
            },
            customFieldTypes: customFields,
        },
    };

    registerInternalExtension(editor3AuthoringReact, result);
}
