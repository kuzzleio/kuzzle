const { makeExecutableSchema } = require('graphql-tools');
const { graphql } = require('graphql');
const fs = require('fs');
const path = require('path');
const Resolvers = require('./resolvers');
const generateLoaders = require('./loaders')
/**
 * @class KuzzleGraphQL
 * @property endpoint
 * @param {Kuzzle} kuzzle
 */
class KuzzleGraphQL {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;

    const resolvers = new Resolvers(kuzzle).dump;
    const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');

    this.graphQLSchema = makeExecutableSchema({
      typeDefs,
      resolvers,
      resolverValidationOptions: {
        requireResolversForArgs: true,
        requireResolversForNonScalar: true,
      },
    });
  }

  endpoint(request, cb) {
    this.kuzzle.funnel.throttle((r) => {
      const body = r.input.body || {};
      const query = body.query || {};
      const vars = body.variables || {};
      const context = {
        loaders: generateLoaders(this.kuzzle)
      }
      graphql(this.graphQLSchema, query, null, context, vars).then(graphqlResult => {
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

module.exports = KuzzleGraphQL;
