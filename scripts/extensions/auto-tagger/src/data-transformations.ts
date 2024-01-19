import {IArticle, ISuperdesk, ISubject} from 'superdesk-api';
import {OrderedMap} from 'immutable';
import {ITagUi} from './types';
import {getServerResponseKeys, toServerFormat, ITagBase, ISubjectTag, IServerResponse} from './adapter';

export function createTagsPatch(
    article: IArticle,
    tags: OrderedMap<string, ITagUi>,
    superdesk: ISuperdesk,
): Partial<IArticle> {
    const serverFormat = toServerFormat(tags, superdesk);
    const patch: Partial<IArticle> = {};
    console.log('serverFormat', serverFormat);
    console.log('tags', tags);
    console.log('patch', patch);
    getServerResponseKeys().forEach((key) => {
        let oldValues = OrderedMap<string, ISubject>((article[key] || []).filter(_item => typeof _item.qcode === 'string').map((_item) => [_item.qcode, _item]));
        const newValues = serverFormat[key];
        let newValuesMap = OrderedMap<string, ISubject>();
        console.log('oldValues', oldValues);
        console.log('newValues', newValues);
        // Preserve tags with specific schemes
        // Add existing values to the map, ensuring tag has a defined scheme
        oldValues?.forEach((tag, qcode) => {
            if (qcode && typeof qcode === 'string') {
                if (tag && ['subject_custom', 'destinations', 'distribution', 'subject'].includes(tag.scheme ?? '')) {
                    newValuesMap = newValuesMap.set(qcode, tag);
                    console.log('preserve', tag);
                }
            }
        });
        // const wasRemoved = (tag: ISubject) => {
        //     if(oldValues.has(tag.qcode) && !newValuesMap.has(tag.qcode)) {
        //         console.log('wasRemoved', tag);
        //         return true;
        //     }
        //     else {
        //         return false;
        //     }
        // }

        // Add new values to the map, ensuring tag is defined, has a qcode, and a valid scheme
        newValues?.forEach((tag) => {
            if (tag && tag.qcode) {
                newValuesMap = newValuesMap.set(tag.qcode, tag);
            }
        });

        // Determine removed tags
        const removedTags = oldValues.filter((_, qcode) => !newValuesMap.has(qcode)).keySeq().toSet();
        // Has to be executed even if newValuesMap is empty in order
        // for removed groups to be included in the patch.
        patch[key] = oldValues
            .merge(newValuesMap)
            .filter((_, qcode) => !removedTags.has(qcode))
            .toArray();

            console.log('removedTags', removedTags);
            console.log(`final patch for ${key}`, patch[key]);
        });
        console.log('final patch', patch)
    return patch;
}

export function getExistingTags(article: IArticle): IServerResponse {
    const result: IServerResponse = {};

    getServerResponseKeys().forEach((key) => {
        const values = article[key] ?? [];
        if (key === 'subject') {
            if (values.length > 0) {
                result[key] = values
                .filter(subjectItem => subjectItem.scheme != null) // Only include items with a scheme
                .map(subjectItem => {
                    const {
                        name,
                        description,
                        qcode,
                        source,
                        altids,
                        scheme,
                        aliases,
                        original_source,
                        parent,
                    } = subjectItem;

                    const subjectTag: ISubjectTag = {
                        name,
                        description,
                        qcode,
                        source,
                        altids: altids ?? {},
                        parent,
                        scheme,
                        aliases,
                        original_source,
                    };
                    return subjectTag;
                });
            }
        } else if (values.length > 0) {
            result[key] = values.map((entityItem) => {
                const {
                    name,
                    description,
                    qcode,
                    source,
                    altids,
                    scheme,
                    aliases,
                    original_source,
                    parent,
                } = entityItem;

                const entityTag: ITagBase = {
                    name,
                    description,
                    qcode,
                    source,
                    altids: altids ?? {},
                    parent,
                    scheme,
                    aliases,
                    original_source,
                };

                return entityTag;
            });
        }
    });

    return result;
}
