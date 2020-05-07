const
  should = require('should'),
   _ = require('lodash');

class FunctionalTestPlugin {
  constructor () {
    this.controllers = {};
    this.routes = [];
    this.pipes = {};

    // context.constructor.ESClient related declarations =======================

    this.controllers.constructors = { ESClient: 'testConstructorsESClient' };

    this.routes.push({ verb: 'post', url: '/constructors/esclient/:index', controller: 'constructors', action: 'ESClient' });

    // context.secrets related declarations ====================================

    this.controllers.secrets = { test: 'testSecrets' };

    this.routes.push({ verb: 'post', url: '/secrets', controller: 'secrets', action: 'test' })

    // pipes related declarations ==============================================

    this.activatedPipes = {};

    this.controllers.pipes = {
      manage: 'pipesManage',
      deactivateAll: 'pipesDeactivateAll',
      testReturn: 'pipesTestReturn'
    };

    this.routes.push({ verb: 'post', url: '/pipes/:event/:state', controller: 'pipes', action: 'manage' });
    this.routes.push({ verb: 'delete', url: '/pipes', controller: 'pipes', action: 'deactivateAll' });
    this.routes.push({ verb: 'post', url: '/pipes/test-return/:name', controller: 'pipes', action: 'testReturn' });

    this.pipes['generic:document:beforeWrite'] = (...args) => this.genericDocumentEvent('beforeWrite', ...args);
    this.pipes['generic:document:afterWrite'] = (...args) => this.genericDocumentEvent('afterWrite', ...args);
    this.pipes['generic:document:beforeUpdate'] = (...args) => this.genericDocumentEvent('beforeUpdate', ...args);
    this.pipes['generic:document:afterUpdate'] = (...args) => this.genericDocumentEvent('afterUpdate', ...args);
    this.pipes['generic:document:beforeGet'] = (...args) => this.genericDocumentEvent('beforeGet', ...args);
    this.pipes['generic:document:afterGet'] = (...args) => this.genericDocumentEvent('afterGet', ...args);
    this.pipes['generic:document:beforeDelete'] = (...args) => this.genericDocumentEvent('beforeDelete', ...args);
    this.pipes['generic:document:afterDelete'] = (...args) => this.genericDocumentEvent('afterDelete', ...args);

    this.pipes['plugin-functional-test-plugin:testPipesReturn'] = async name => `Hello, ${name}`;
  }

  init (config, context) {
    this.config = config;
    this.context = context;
  }

  // context.constructor.ESClient related methods ============================

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

  // context.secrets related methods ===========================================

  async testSecrets (request) {
    const expectedSecrets = request.input.body;

    should(this.context.secrets).match(expectedSecrets);

    return { result: true };
  }

  // pipes related methods =====================================================

  async pipesManage (request) {
    const
      payload = request.input.body,
      state = request.input.args.state,
      event = request.input.args.event;

    this.activatedPipes[event] = {
      state,
      payload
    };

    return null;
  }

  async pipesDeactivateAll () {
    for (const pipe of Object.values(this.activatedPipes)) {
      pipe.state = 'off';
    }

    return null;
  }

  async genericDocumentEvent (event, documents, request) {
    const pipe = this.activatedPipes[`generic:document:${event}`];

    if (!pipe || pipe.state === 'off') {
      return documents;
    }

    for (const document of documents) {
      for (const [field, value] of Object.entries(pipe.payload)) {
        _.set(document, field, eval(value));
      }
    }

    return documents;
  }

  /**
   * Tests that the context.accessors.trigger method returns the results of the pipe chain
   */
  async pipesTestReturn (request) {
    const helloName = await this.context.accessors.trigger(
      'testPipesReturn',
      request.input.args.name);

    return { result: helloName };
  }
}

module.exports = FunctionalTestPlugin;
