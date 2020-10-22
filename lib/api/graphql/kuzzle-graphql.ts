import handlebars from 'handlebars'
import { defaults, Dictionary, forIn, get, mapValues, pickBy, transform } from 'lodash'

import { generateLoader } from './loader'
import { SchemaConfig, TypeConfig, TypePropertyConfig } from './schema'
import { schemaTemplate, typeTemplate } from './templates';

const defaultPropertyConfig = {
  nullable: true,
  plural: false,
  nullableElements: true
}

// TODO These might be already defined in the graphql-js package
const GQL_STRING = 'String'
const GQL_INT = 'Int'

export class KuzzleGraphql {
  constructor(configuration) {
    this._config = configuration;
  }

  private _config: SchemaConfig

  // TODO complete this with all types
  private _esToGql: Object = {
    keyword: GQL_STRING,
    text: GQL_STRING,
    integer: GQL_INT
    // Question: What about Date type resolver?
  }

  get config() {
    return this._config
  }

  public generateSchemaFromTypes(types) {
    const schemaHandlebars = handlebars.compile(schemaTemplate)
    const schema = {
      types: [],
      queries: []
    }

    forIn(types, (type: string, typeName: string) => {
      schema.types.push(
        type
      )
      schema.queries.push(
        `${this.generateQueryGet(typeName)}(id: ID!): ${typeName}`
      )
    })

    return schemaHandlebars(schema)
  }

  public generateSchema(mappings): string {
    const schemaHandlebars = handlebars.compile(schemaTemplate)

    const schema = {
      types: [],
      queries: []
    }

    Object.keys(mappings).forEach((indexName: string) => {
      const collections = mappings[indexName]
      Object.keys(collections).forEach((collectionName: string) => {
        if (!get(this._config, `${indexName}.${collectionName}`)) {
          // Ignore this collection since it is not mentioned
          // in the configuration.
          return
        }
        const typeConf: TypeConfig = this._config[indexName][collectionName];

        schema.types.push(
          this.generateType(indexName, collectionName, collections[collectionName])
        )
        schema.queries.push(
          `${this.generateQueryGet(typeConf.typeName)}(id: ID!): ${typeConf.typeName}`
        )
        schema.queries.push(
          `${this.generateQueryMget(typeConf.typeName)}([id: ID!]!): [${typeConf.typeName}]`
        )
        // schema.queries.push(
        //   `${this.generateQuerySearch(typeConf.typeName)}(filters: Object!): [${typeConf.typeName}]`
        // )
      })
    })

    return schemaHandlebars(schema)
  }

  public generateType(indexName: string, collectionName: string, mapping): string {
    const typeHandlebars = handlebars.compile(typeTemplate)

    if (!get(this._config, `${indexName}.${collectionName}`)) {
      throw new Error(`No config found for collection ${collectionName}`)
    }

    if (!mapping.properties) {
      throw new Error(`Malformed mapping for collection ${collectionName} (no properties)`)
    }

    const config: TypeConfig = this._config[indexName][collectionName]
    if (!config.properties) {
      config.properties = {}
    }

    const gqlType: TypeConfig = {
      typeName: config.typeName,
      properties: {}
    }

    gqlType.properties = mapValues(mapping.properties, (value, key) => {
      const property = defaults(config.properties[key], defaultPropertyConfig)

      if (!property.type) {
        if (!this._esToGql[value.type]) {
          throw new Error(`Property ${collectionName}:${key} needs type but no type translation has been found for (${value.type})`)
        }
        property.type = this._esToGql[value.type]
      }

      return property
    })

    return typeHandlebars(gqlType)
  }

  public generateResolverMap(): Object {
    return transform(this._config, (result, types: Dictionary<TypeConfig>, indexName) => {

      forIn(types, (type: TypeConfig) => {
        result.Query[this.generateQueryGet(type.typeName)]
          = (parent, { id }, { loaders }) => loaders[type.typeName].load(id)

        result.Query[this.generateQueryMget(type.typeName)]
          = (parent, { ids }, { loaders }) => loaders[type.typeName].loadMany(ids)

        // foreign keys
        const foreignKeyProperties: Dictionary<TypePropertyConfig>
          = pickBy(type.properties, (value: TypePropertyConfig) => value.isForeingKey === true)

        forIn(foreignKeyProperties, (config: TypePropertyConfig, propertyName: string) => {
          if (!result[type.typeName]) {
            result[type.typeName] = {}
          }
          if (type.properties[propertyName].plural === true) {
            result[type.typeName][propertyName]
              = (parent, values, { loaders }) => loaders[config.type].loadMany(parent[propertyName])
          } else {
            result[type.typeName][propertyName]
              = (parent, id, { loaders }) => loaders[config.type].load(id)
          }
        })
      })
    }, {
      Query: {}
    })
  }

  public generateLoaderCreator(kuzzle): Function {
    return () => transform(this._config, (result, types: Dictionary<TypeConfig>, indexName) => {
      forIn(types, (type: TypeConfig, collectionName: string) => {
        result[type.typeName] =
          generateLoader(kuzzle, indexName, collectionName, type.typeName)
      })
    }, {})
  }

  private generateQueryGet(typeName: String) {
    return `get${typeName}`
  }

  private generateQueryMget(typeName: String) {
    return `mGet${typeName}`
  }

  private generateQuerySearch(typeName: String) {
    return `search${typeName}`
  }
}