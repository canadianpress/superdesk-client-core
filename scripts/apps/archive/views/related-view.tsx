import React from 'react';
import {IArticle, IRestApiResponse} from 'superdesk-api';
import {ItemsListLimited} from 'core/itemList/items-list-limited';
import {openArticle} from 'core/get-superdesk-api-implementation';
import ng from 'core/services/ng';

interface IProps {
    relatedItems: IRestApiResponse<IArticle>;
    showPreview?: boolean;
}

export class RelatedView extends React.PureComponent<IProps> {
    render() {
        const ids = this.props.relatedItems._items.map(({_id}) => _id);

        return (
            <div data-test-id="related-items-view">
                <ItemsListLimited
                    ids={ids}
                    onItemClick={(item) => {
                        if (this.props.showPreview) ng.get('$rootScope').$broadcast('broadcast:preview', {item});
                        else openArticle(item._id, 'edit');
                    }}
                />
            </div>
        );
    }
}
