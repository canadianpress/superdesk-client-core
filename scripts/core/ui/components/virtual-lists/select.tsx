import React from 'react';
import {SuperdeskReactComponent} from 'core/SuperdeskReactComponent';
import {showPopup} from '../popupNew';
import {IBaseRestApiResponse, IPropsSelectFromRemote, ISuperdeskQuery} from 'superdesk-api';
import {VirtualListFromQuery} from './virtual-list-from-query';
import {gettext} from 'core/utils';

interface IState<T> {
    selected: 'loading' | T | null;
    searchString: string;
}

export class SelectFromEndpoint<T extends IBaseRestApiResponse>
    extends SuperdeskReactComponent<IPropsSelectFromRemote<T>, IState<T>> {
    private valueEl: HTMLDivElement;
    private lastPopup: {close: () => void} | null;
    constructor(props: IPropsSelectFromRemote<T>) {
        super(props);

        this.state = {
            selected: null,
            searchString: '',
        };

        this.fetchEntity = this.fetchEntity.bind(this);
    }

    fetchEntity(id: string | null) {
        if (id != null) {
            this.asyncHelpers.httpRequestJsonLocal<T>({
                method: 'GET',
                path: `${this.props.endpoint}/${id}`,
            }).then((val) => {
                this.setState({selected: val});
            });
        } else {
            this.setState({selected: null});
        }
    }

    componentDidMount() {
        this.fetchEntity(this.props.value ?? null);
    }

    render() {
        if (this.state.selected === 'loading') {
            return null;
        }

        const Template = this.props.itemTemplate;

        return (
            <div
                ref={(el) => {
                    this.valueEl = el;
                }}
                onClick={() => {
                    if (this.lastPopup != null) {
                        this.lastPopup.close();
                        this.lastPopup = null;

                        return;
                    }

                    this.lastPopup = showPopup(
                        this.valueEl,
                        'bottom-end',
                        ({closePopup}) => (
                            <div className="p-dropdown-panel" style={{position: 'static'}}>

                                {/*

                                TODO: Implement filtering;
                                Find out how to add "regex-search on field" operator to `IComparisonOptions`

                                <div className="p-dropdown-item" style={{background: 'none'}}>
                                    <Input
                                        type="text"
                                        value={this.state.searchString}
                                        onChange={(val) => {
                                            this.setState({searchString: val.trim()});
                                        }}
                                        inlineLabel
                                        labelHidden
                                    />
                                </div>

                                */}

                                <VirtualListFromQuery
                                    width={this.valueEl.offsetWidth}
                                    height={200}
                                    query={{
                                        endpoint: this.props.endpoint,
                                        // filter: {$and: [{'field': {$eq: 'test'}}]}, // TODO: regex operator needed
                                        sort: this.props.sort.reduce<ISuperdeskQuery['sort']>(
                                            (acc, [fieldId, direction]) => acc.concat({[fieldId]: direction}), []),
                                    }}
                                    itemTemplate={({item}: {item: T}) => (
                                        <span
                                            onClick={() => {
                                                this.props.onChange(item._id);

                                                this.fetchEntity(item._id);
                                                closePopup();
                                            }}
                                            className="p-dropdown-item"
                                        >
                                            <Template item={item} />
                                        </span>
                                    )}
                                    noItemsTemplate={
                                        () => (
                                            <div>
                                                {gettext('No items yet')}
                                            </div>
                                        )
                                    }
                                />
                            </div>
                        ),
                        3000,
                        undefined,
                        () => {
                            this.lastPopup = null;
                        },
                    );
                }}
                className="p-dropdown"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: this.props.noGrow === true ? undefined : '100%',
                }}
            >
                <Template item={this.state.selected} />
                <span className="p-dropdown-trigger">
                    <span className="p-dropdown-trigger-icon pi pi-chevron-down p-clickable" />
                </span>
            </div>
        );
    }
}