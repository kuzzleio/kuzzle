"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KuzzleGraphql = void 0;
const handlebars_1 = __importDefault(require("handlebars"));
const lodash_1 = require("lodash");
const loader_1 = require("./loader");
const templates_1 = require("./templates");
const defaultPropertyConfig = {
    nullable: true,
    plural: false,
    nullableElements: true
};
// TODO These might be already defined in the graphql-js package
const GQL_STRING = 'String';
const GQL_INT = 'Int';
class KuzzleGraphql {
    constructor(configuration) {
        // TODO complete this with all types
        this._esToGql = {
            keyword: GQL_STRING,
            text: GQL_STRING,
            integer: GQL_INT
            // Question: What about Date type resolver?
        };
        this._config = configuration;
    }
    get config() {
        return this._config;
    }
    generateSchemaFromTypes(types) {
        const schemaHandlebars = handlebars_1.default.compile(templates_1.schemaTemplate);
        const schema = {
            types: [],
            queries: []
        };
        lodash_1.forIn(types, (type, typeName) => {
            schema.types.push(type);
            schema.queries.push(`${this.generateQueryGet(typeName)}(id: ID!): ${typeName}`);
        });
        return schemaHandlebars(schema);
    }
    generateSchema(mappings) {
        const schemaHandlebars = handlebars_1.default.compile(templates_1.schemaTemplate);
        const schema = {
            types: [],
            queries: []
        };
        Object.keys(mappings).forEach((indexName) => {
            const collections = mappings[indexName];
            Object.keys(collections).forEach((collectionName) => {
                if (!lodash_1.get(this._config, `${indexName}.${collectionName}`)) {
                    // Ignore this collection since it is not mentioned
                    // in the configuration.
                    return;
                }
                const typeConf = this._config[indexName][collectionName];
                schema.types.push(this.generateType(indexName, collectionName, collections[collectionName]));
                schema.queries.push(`${this.generateQueryGet(typeConf.typeName)}(id: ID!): ${typeConf.typeName}`);
                // schema.queries.push(
                //   `${this.generateQueryMget(typeConf.typeName)}([id: ID!]!): [${typeConf.typeName}]`
                // )
                // schema.queries.push(
                //   `${this.generateQuerySearch(typeConf.typeName)}(filters: Object!): [${typeConf.typeName}]`
                // )
            });
        });
        return schemaHandlebars(schema);
    }
    generateType(indexName, collectionName, mapping) {
        const typeHandlebars = handlebars_1.default.compile(templates_1.typeTemplate);
        if (!lodash_1.get(this._config, `${indexName}.${collectionName}`)) {
            throw new Error(`No config found for collection ${collectionName}`);
        }
        if (!mapping.properties) {
            throw new Error(`Malformed mapping for collection ${collectionName} (no properties)`);
        }
        const config = this._config[indexName][collectionName];
        const gqlType = {
            typeName: config.typeName,
            properties: {}
        };
        gqlType.properties = lodash_1.mapValues(mapping.properties, (value, key) => {
            const property = lodash_1.defaults(config.properties[key], defaultPropertyConfig);
            if (!property.type) {
                if (!this._esToGql[value.type]) {
                    throw new Error(`Property ${collectionName}:${key} needs type but no type translation has been found for (${value.type})`);
                }
                property.type = this._esToGql[value.type];
            }
            return property;
        });
        return typeHandlebars(gqlType);
    }
    generateResolverMap() {
        return lodash_1.transform(this._config, (result, types, indexName) => {
            lodash_1.forIn(types, (type) => {
                result.Query[this.generateQueryGet(type.typeName)]
                    = (parent, { id }, { loaders }) => loaders[this.generateQueryGet(type.typeName)].load(id);
                // foreign keys
                const foreignKeyProperties = lodash_1.pickBy(type.properties, (value) => value.isForeingKey === true);
                lodash_1.forIn(foreignKeyProperties, (config, propertyName) => {
                    if (!result[type.typeName]) {
                        result[type.typeName] = {};
                    }
                    if (type.properties[propertyName].plural === true) {
                        result[type.typeName][propertyName]
                            = (parent, values, { loaders }) => Promise.all(parent[propertyName].map(id => loaders[this.generateQueryGet(config.type)].load(id)));
                    }
                    else {
                        result[type.typeName][propertyName]
                            = (parent, id, { loaders }) => loaders[this.generateQueryGet(config.type)].load(id);
                    }
                });
            });
        }, {
            Query: {}
        });
    }
    generateLoaderCreator(kuzzle) {
        return () => lodash_1.transform(this._config, (result, types, indexName) => {
            lodash_1.forIn(types, (type, collectionName) => {
                result[this.generateQueryGet(type.typeName)] =
                    loader_1.generateLoader(kuzzle, indexName, collectionName, type.typeName);
            });
        }, {});
    }
    generateQueryGet(typeName) {
        return `get${typeName}`;
    }
    generateQueryMget(typeName) {
        return `mGet${typeName}`;
    }
    generateQuerySearch(typeName) {
        return `search${typeName}`;
    }
}
exports.KuzzleGraphql = KuzzleGraphql;
//# sourceMappingURL=kuzzle-graphql.js.map