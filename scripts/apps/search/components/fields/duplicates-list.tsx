import {RelatedView} from 'apps/archive/views/related-view';
import * as React from 'react';
import {IArticle, IRestApiResponse} from 'superdesk-api';

type Props = {
  apiItems: IRestApiResponse<IArticle>;
  label: string;
  close: () => void;
};

export const DuplicatesList = ({apiItems, label, close}: Props) => (
    <ul data-theme="dark-ui" className="highlights-list-menu">
        <li>
            <div className="dropdown__menu-label">{label}</div>
            <button
                className="dropdown__menu-close"
                onClick={() => {
                    close();
                }}
            >
                <i className="icon-close-small" />
            </button>
        </li>
        <RelatedView relatedItems={apiItems} showPreview />
    </ul>
);
