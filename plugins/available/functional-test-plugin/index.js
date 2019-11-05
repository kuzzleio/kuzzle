const should = require('should');

class FunctionalTestPlugin {
  constructor () {
    this.controllers = {
      constructors: {
        ESClient: 'testConstructorsESClient'
      }
    };

    this.routes = [
      { verb: 'post', url: '/constructors/esclient/:index', controller: 'constructors', action: 'ESClient' }
    ];

    this.controllers.secrets = {
      test: 'testSecrets'
    };

    this.routes.push({ verb: 'post', url: '/secrets', controller: 'secrets', action: 'test' })
  }

  init (config, context) {
    this.config = config;
    this.context = context;
  }

  async testConstructorsESClient (request) {
    const
      client = new this.context.constructors.ESClient(),
      esRequest = {
        id: request.input.resource._id,
        index: request.input.resource.index,
        body: request.input.body
      };

    const { body } = await client.index(esRequest);

    return body;
  }

  async testSecrets (request) {
    const expectedSecrets = request.input.body;

    should(this.context.secrets).match(expectedSecrets);

    return {
      result: true
    };
  }
}

module.exports = FunctionalTestPlugin;
