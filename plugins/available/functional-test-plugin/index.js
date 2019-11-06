const _ = require('lodash');

class FunctionalTestPlugin {
  constructor () {
    this.controllers = {};
    this.routes = [];
    this.pipes = {};

    // plugin context related declarations =====================================

    this.controllers.constructors = {
      ESClient: 'testConstructorsESClient'
    };

    this.routes.push({ verb: 'post', url: '/constructors/esclient/:index', controller: 'constructors', action: 'ESClient' });

    // pipes related declarations ==============================================

    this.activatedPipes = {};

    this.controllers.pipes = {
      manage: 'pipesManage',
      deactivateAll: 'pipesDeactivateAll'
    };

    this.routes.push({ verb: 'post', url: '/pipes/:event/:state', controller: 'pipes', action: 'manage' });
    this.routes.push({ verb: 'delete', url: '/pipes', controller: 'pipes', action: 'deactivateAll' });

    this.pipes['generic:document:beforeWrite'] = (...args) => this.genericDocumentWrite('before', ...args);
    this.pipes['generic:document:afterWrite'] = (...args) => this.genericDocumentWrite('after', ...args);
  }

  init (config, context) {
    this.config = config;
    this.context = context;
  }

  // plugin context related methods ============================================

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

  async genericDocumentWrite (eventType, documents, request) {
    const pipe = this.activatedPipes[`generic:document:${eventType}Write`];

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
}

module.exports = FunctionalTestPlugin;
