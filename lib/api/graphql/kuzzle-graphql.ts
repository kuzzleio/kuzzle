import handlebars from 'handlebars';
import { defaults, Dictionary, forIn, get, mapValues, pickBy, transform } from 'lodash';

import { generateLoader } from './loader';
import { SchemaConfig, TypeConfig, TypePropertyConfig } from './schema';
import { schemaTemplate, typeTemplate } from './templates';

const defaultPropertyConfig = {
  nullable: true,
  nullableElements: true,
  plural: false
};

// TODO These might be already defined in the graphql-js package
const GQL_STRING = 'String';
const GQL_INT = 'Int';

export class KuzzleGraphql {
  constructor(configuration) {
    this._config = configuration;
  }

  private _config: SchemaConfig

  // TODO complete this with all types
  private _esToGql = {
    integer: GQL_INT,
    keyword: GQL_STRING,
    text: GQL_STRING
    // Question: What about Date type resolver?
  }

  get config() {
    return this._config;
  }

  public generateSchemaFromTypes(types) {
    const schemaHandlebars = handlebars.compile(schemaTemplate);
    const schema = {
      queries: [],
      types: []
    };

    forIn(types, (type: string, typeName: string) => {
      schema.types.push(
        type
      );
      schema.queries.push(
        `${this.generateQueryGet(typeName)}(id: ID!): ${typeName}`
      );
      // schema.queries.push(
      //   `${this.generateQueryMget(typeName)}([id: ID!]!): [${typeName}]`
      // );
    });

    return schemaHandlebars(schema);
  }

  public generateSchema(mappings): string {
    const schemaHandlebars = handlebars.compile(schemaTemplate);

    const schema = {
      queries: [],
      types: []
    };

    Object.keys(mappings).forEach((indexName: string) => {
      const collections = mappings[indexName];
      Object.keys(collections).forEach((collectionName: string) => {
        if (!get(this._config, `${indexName}.${collectionName}`)) {
          // Ignore this collection since it is not mentioned
          // in the configuration.
          return;
        }
        const typeConf: TypeConfig = this._config[indexName][collectionName];

        schema.types.push(
          this.generateType(indexName, collectionName, collections[collectionName])
        );
        schema.queries.push(
          `${this.generateQueryGet(typeConf.typeName)}(id: ID!): ${typeConf.typeName}`
        );
        // schema.queries.push(
        //   `${this.generateQueryMget(typeConf.typeName)}([id: ID!]!): [${typeConf.typeName}]`
        // );
        // schema.queries.push(
        //   `${this.generateQuerySearch(typeConf.typeName)}(filters: Object!): [${typeConf.typeName}]`
        // )
      });
    });

    return schemaHandlebars(schema);
  }

  public generateType(indexName: string, collectionName: string, mapping): string {
    const typeHandlebars = handlebars.compile(typeTemplate);

    if (!get(this._config, `${indexName}.${collectionName}`)) {
      throw new Error(`No config found for collection ${collectionName}`);
    }

    if (!mapping.properties) {
      throw new Error(`Malformed mapping for collection ${collectionName} (no properties)`);
    }

    const config: TypeConfig = this._config[indexName][collectionName];
    if (!config.properties) {
      config.properties = {};
    }

    const gqlType: TypeConfig = {
      properties: {},
      typeName: config.typeName
    };

    gqlType.properties = mapValues(mapping.properties, (value, key) => {
      const property = defaults(config.properties[key], defaultPropertyConfig);

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

  public generateResolverMap(types) {
    const result = {
      Query: {}
    }

    forIn(types, (type: TypeConfig) => {
      result.Query[this.generateQueryGet(type.typeName)]
        = (parent, { id }, { loaders }) => loaders[type.typeName].load(id);

      // result.Query[this.generateQueryMget(type.typeName)]
      //   = (parent, { ids }, { loaders }) => loaders[type.typeName].loadMany(ids);

      // foreign keys
      const foreignKeyProperties: Dictionary<TypePropertyConfig>
        = pickBy(type.properties, (value: TypePropertyConfig) => value.isForeingKey === true);

      forIn(foreignKeyProperties, (config: TypePropertyConfig, propertyName: string) => {
        if (!result[type.typeName]) {
          result[type.typeName] = {};
        }
        if (type.properties[propertyName].plural === true) {
          result[type.typeName][propertyName]
            = (parent, values, { loaders }) => loaders[config.type].loadMany(parent[propertyName]);
        } else {
          result[type.typeName][propertyName]
            = (parent, id, { loaders }) => loaders[config.type].load(id);
        }
      });
    });

    return result;
  }

  public generateLoaderCreator(kuzzle) {
    return () => transform(this._config, (result, types: Dictionary<TypeConfig>, indexName) => {
      forIn(types, (type: TypeConfig, collectionName: string) => {
        result[type.typeName] =
          generateLoader(kuzzle, indexName, collectionName, type.typeName);
      });
    }, {});
  }

  private generateQueryGet(typeName: string) {
    return `get${typeName}`;
  }

  private generateQueryMget(typeName: string) {
    return `mGet${typeName}`;
  }

  private generateQuerySearch(typeName: string) {
    return `search${typeName}`;
  }
}