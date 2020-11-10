'use strict';

const { makeExecutableSchema } = require('graphql-tools');
const { graphql } = require('graphql');
const { Request, ServiceUnavailableError, NotFoundError } = require('kuzzle-common-objects');
const { get } = require('lodash'
)
const { KuzzleGraphql } = require('./kuzzle-graphql');
/**
 * @class KuzzleGraphQL
 * @property endpoint
 * @param {Kuzzle} kuzzle
 */
class GraphQLEndpoint {
  constructor(kuzzle, schemaConfig = {}) {
    this.kuzzle = kuzzle;
    this.config = schemaConfig;
    this.schema = null;
    this.types = {};
    this.resolverConfig = {}
    this.generateLoaders = null;
    this.kuzzleGql = new KuzzleGraphql(schemaConfig);
  }

  async init() {

    for (const indexName of Object.keys(this.config)) {
      const collections = this.config[indexName];

      for (const collectionName of Object.keys(collections)) {
        const request = new Request({
          action: 'getMapping',
          collection: collectionName,
          controller: 'collection',
          index: indexName,
        });
        const typeConf = collections[collectionName];

        try {
          const response = await this.kuzzle.funnel.processRequest(request);
          this.types[typeConf.typeName] = this.kuzzleGql.generateType(indexName, collectionName, response.result);
          this.resolverConfig[typeConf.typeName] = typeConf;
        } catch (error) {
          this.kuzzle.log.info(`[GraphQL] Type ${typeConf.typeName} not created. Unable to fetch mapping for ${indexName}:${collectionName}`)
        }
      }
    }
    this.kuzzle.on('collection:afterCreate', payload => {
      try {
        const collectionName = get(payload, 'input.resource.collection')
        const indexName = get(payload, 'input.resource.index')
        this.onNewCollectionCreated(
          indexName,
          collectionName,
          get(payload, 'input.body.mappings.properties')
        )
      } catch (error) {
        this.kuzzle.log.info(`Unable to update schema for collection ${indexName}:${collectionName}`)
      }
    })
    // this.kuzzle.on('collection:afterUpdate', payload => {
    //   this.onNewCollectionCreated(payload.input.resource.index, payload.input.resource.collection)
    // })

    if (Object.keys(this.types).length === 0) {
      return
    }

    this.updateSchema()
  }

  updateSchema() {
    const typeDefs = this.kuzzleGql.generateSchemaFromTypes(this.types);
    const resolvers = this.kuzzleGql.generateResolverMap(this.resolverConfig);
    this.generateLoaders = this.kuzzleGql.generateLoaderCreator(this.kuzzle);

    try {
      this.schema = makeExecutableSchema({
        resolverValidationOptions: {
          requireResolversForArgs: true,
          requireResolversForNonScalar: true,
        },
        resolvers,
        typeDefs
      });
    } catch (error) {
      this.kuzzle.log.info('[GraphQL] Something went wrong while generating the schema. The GraphQL endpoint will not be available.')
    }
  }

  async onNewCollectionCreated(indexName, collectionName, mapping) {
    const typeConf = get(this.config, `${indexName}.${collectionName}`)
    if (!typeConf) {
      return
    }

    this.kuzzle.log(`[GraphQL] Updating schema for collection ${indexName}:${collectionName}...`)
    this.types[typeConf.typeName] = this.kuzzleGql.generateType(indexName, collectionName, mapping);
    this.resolverConfig[typeConf.typeName] = typeConf;
    this.updateSchema()
  }

  endpoint(request, cb) {
    this.kuzzle.funnel.throttle((r) => {
      if (this.schema === null) {
        r.setError(new ServiceUnavailableError('The GraphQL endpoint is not available'))
        return cb(r);
      }

      const body = r.input.body || {};
      const query = body.query || {};
      const vars = body.variables || {};
      const context = {
        loaders: this.generateLoaders()
      };
      graphql(this.schema, query, null, context, vars).then(graphqlResult => {
        r.setResult(graphqlResult, {
          headers: { 'content-type': 'application/json' },
          raw: true,
          status: 200
        });
        cb(r);
      });
    }, this, request);
  }
}

module.exports = GraphQLEndpoint;
