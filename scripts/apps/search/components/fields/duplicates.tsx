import ng from 'core/services/ng';
import {gettext} from 'core/utils';
import * as React from 'react';
import {IArticle, IRestApiResponse} from 'superdesk-api';
import {showPopup} from 'superdesk-ui-framework/react';
import {DuplicatesList} from './duplicates-list';

type Props = {
  item: IArticle;
};

type State = IRestApiResponse<IArticle>;

export class Duplicates extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {_items: [], _links: undefined, _meta: undefined};
        this.renderDuplicates = this.renderDuplicates.bind(this);
    }

    componentDidMount(): void {
        const familyService = ng.get('familyService');

        if (this.props.item.family_id)
            familyService
                .fetchItems(this.props.item.family_id, this.props.item)
                .then((res) => {
                    this.setState({
                        ...res,
                        _items: res._items.filter(
                            (item) => item._id !== this.props.item._id,
                        ),
                    });
                });
    }

    renderDuplicates(referenceElement: HTMLElement) {
        showPopup(referenceElement, 'bottom', ({closePopup}) => (
            <DuplicatesList
                apiItems={this.state}
                label={gettext('Duplicates')}
                close={closePopup}
            />
        ));
    }

    render() {
        if (this.state._items.length < 1) return null;
        return (
            <button
                className="text-link"
                onClick={(event) => {
                    this.renderDuplicates(event.target as HTMLElement);
                }}
            >
                {gettext('Duplicates')}
            </button>
        );
    }
}
