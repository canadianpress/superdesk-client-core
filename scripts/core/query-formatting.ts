import {IComparison, ILogicalOperator, ISuperdeskQuery} from 'superdesk-api';

function isLogicalOperator(x: ILogicalOperator | IComparison): x is ILogicalOperator {
    return x['$and'] != null || x['$or'] != null;
}

function toElasticFilter(q: ILogicalOperator | IComparison) {
    if (isLogicalOperator(q)) {
        const r = {};

        if (q['$and'] != null) {
            r['and'] = q['$and'].map((_q) => toElasticFilter(_q));
        }
        if (q['$or'] != null) {
            r['or'] = q['$or'].map((_q) => toElasticFilter(_q));
        }

        return r;
    } else {
        return Object.keys(q).reduce((acc, field) => {
            const comparisonOptions = q[field];

            const operator = Object.keys(comparisonOptions)[0];
            const value = comparisonOptions[operator];

            switch (operator) {
            case '$eq':
                return {term: {[field]: value}};
            case '$ne':
                return {not: {term: {[field]: value}}};
            case '$gt':
                return {range: {[field]: {'gt': value}}};
            case '$gte':
                return {range: {[field]: {'gte': value}}};
            case '$lt':
                return {range: {[field]: {'lt': value}}};
            case '$lte':
                return {range: {[field]: {'lte': value}}};
            case '$in':
                return {terms: {[field]: value}};
            }

            throw new Error(`Conversion for operator ${operator} is not defined.`);
        }, {});
    }
}

function toPyEveFilter(q: ILogicalOperator | IComparison) {
    if (isLogicalOperator(q)) {
        const r = {};

        if (q['$and'] != null) {
            r['$and'] = q['$and'].map((_q) => toPyEveFilter(_q));
        }
        if (q['$or'] != null) {
            r['$or'] = q['$or'].map((_q) => toPyEveFilter(_q));
        }

        return r;
    } else {
        return Object.keys(q).reduce((acc, field) => {
            const comparisonOptions = q[field];

            const operator = Object.keys(comparisonOptions)[0];
            const value = comparisonOptions[operator];

            switch (operator) {
            case '$eq':
                return {[field]: value};
            case '$ne':
                return {[field]: {$ne: value}};
            case '$gt':
                return {[field]: {$gt: value}};
            case '$gte':
                return {[field]: {$gte: value}};
            case '$lt':
                return {[field]: {$lt: value}};
            case '$lte':
                return {[field]: {$lte: value}};
            case '$in':
                return {[field]: {$in: value}};
            }

            throw new Error(`Conversion for operator ${operator} is not defined.`);
        }, {});
    }
}

export function getQueryFieldsRecursive(q: ILogicalOperator | IComparison): Set<string> {
    var fields = new Set<string>();

    if (isLogicalOperator(q)) {
        if (q['$and'] != null) {
            q['$and'].forEach((q1: ILogicalOperator | IComparison) => {
                getQueryFieldsRecursive(q1).forEach((field) => {
                    fields.add(field);
                });
            });
        }
        if (q['$or'] != null) {
            q['$or'].forEach((q1: ILogicalOperator | IComparison) => {
                getQueryFieldsRecursive(q1).forEach((field) => {
                    fields.add(field);
                });
            });
        }

        return fields;
    } else {
        return new Set<string>(Object.keys(q));
    }
}

// The result should be passed as "source" query parameter when sending over network
export function toElasticQuery(q: ISuperdeskQuery) {
    interface IQuery {
        query?: {
            filtered: {
                filter: {};
            };
        };
        sort: ISuperdeskQuery['sort'];
        size: number;
        from: number;
    }

    const query: IQuery = {
        sort: q.sort,
        size: q.max_results,
        from: (q.page - 1) * q.max_results,
    };

    if (q.filter != null) {
        const filtered = {filter: toElasticFilter(q.filter)};

        if (q.fullTextSearch != null) {
            filtered['query'] = {
                query_string: {
                    query: q.fullTextSearch,
                    lenient: true,
                    default_operator: 'AND',
                },
            };
        }

        query['query'] = {
            filtered: filtered,
        };
    }

    return query;
}

interface IPyEveQuery {
    where?: {};
    sort: string; // ?sort=[("lastname", -1)]
}

// Object must only have one key
function objectToTuple<T>(obj: {[key: string]: T}): [string, T] {
    const key = Object.keys(obj)[0];

    return [key, obj[key]];
}

export function toPyEveQuery(filter: ISuperdeskQuery['filter'], sort: ISuperdeskQuery['sort']): IPyEveQuery {
    const result: IPyEveQuery = {
        sort: `[${
            sort.map((sortOption) => {
                const [fieldId, sortDirection] = objectToTuple(sortOption);

                return `("${fieldId}", ${sortDirection === 'asc' ? '1' : '-1'})`;
            }).join(',')
        }]`,
    };

    if (filter != null) {
        result['where'] = toPyEveFilter(filter);
    }

    return result;
}
