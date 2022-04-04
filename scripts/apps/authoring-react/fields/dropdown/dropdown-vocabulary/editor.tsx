import * as React from 'react';
import {IEditorComponentContainerProps, IVocabulary, IVocabularyItem} from 'superdesk-api';
import {IDropdownConfigVocabulary, IDropdownValue} from '..';
import {EditorUsingManualSourceOrVocabulary} from '../editor-using-manual-source-or-vocabulary';

interface IProps {
    container: React.ComponentType<IEditorComponentContainerProps>;
    config: IDropdownConfigVocabulary;
    value: IDropdownValue;
    language: string;
    getVocabularyItems(vocabulary: IVocabulary['_id']): Array<IVocabularyItem>;
    onChange(value: IDropdownValue): void;
}

export class EditorVocabulary extends React.PureComponent<IProps> {
    render() {
        return (
            <EditorUsingManualSourceOrVocabulary {...this.props} />
        );
    }
}
