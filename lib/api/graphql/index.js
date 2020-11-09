'use strict';

const { makeExecutableSchema } = require('graphql-tools');
const { KuzzleGraphql } = require('./kuzzle-graphql');
const { graphql } = require('graphql');
const { Request, ServiceUnavailableError } = require('kuzzle-common-objects');

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
    this.generateLoaders = null;
    this.kuzzleGql = new KuzzleGraphql(schemaConfig);

    // TODO sync schema on new collection created
    this.kuzzle.on('collection:afterCreate', payload => {
      this.kuzzle.log('[GraphQL] Just called collection:afterCreate')
    })
  }

  async init() {
    const types = {};
    for (const indexName of Object.keys(this.config)) {
      const collections = this.config[indexName];

      for (const collectionName of Object.keys(collections)) {
        const typeConf = collections[collectionName];
        types[typeConf.typeName] = this.generateTypeForCollection(indexName, collectionName)
      }
    }
    if (Object.keys(types).length === 0) {
      return
    }
    const typeDefs = this.kuzzleGql.generateSchemaFromTypes(types);
    const resolvers = this.kuzzleGql.generateResolverMap(types);
    this.generateLoaders = this.kuzzleGql.generateLoaderCreator(this.kuzzle);

    this.schema = makeExecutableSchema({
      resolverValidationOptions: {
        requireResolversForArgs: true,
        requireResolversForNonScalar: true,
      },
      resolvers,
      typeDefs
    });
  }

  async generateTypeForCollection(indexName, collectionName) {
    const request = new Request({
      action: 'getMapping',
      collection: collectionName,
      controller: 'collection',
      index: indexName,
    });

    try {
      const response = await this.kuzzle.funnel.processRequest(request);
      if (response.status === 404) {
        this.kuzzle.log.info(`Collection for Grapqhl type ${indexName}:${collectionName} not found`)
      }
      return this.kuzzleGql.generateType(indexName, collectionName, response.result);
    } catch (error) {
      this.kuzzle.log.warn(`Something went wrong while fetching mapping for Grapqhl type ${indexName}:${collectionName}`)
      this.kuzzle.log.warn(error)
    }
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
