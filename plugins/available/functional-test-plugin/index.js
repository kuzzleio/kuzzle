const _ = require('lodash');

class FunctionalTestPlugin {
  constructor () {
    this.controllers = {
      constructors: {
        ESClient: 'testConstructorsESClient'
      },
      pipes: {
        manage: 'pipesManage',
        deactivateAll: 'pipesDeactivateAll'
      },

    };

    this.routes = [
      { verb: 'post', url: '/constructors/esclient', controller: 'constructors', action: 'ESClient' }
    ];

    this.pipes = {
      'generic:document:beforeWrite': (...args) => this.genericDocumentWrite('before', ...args),
      'generic:document:afterWrite': (...args) => this.genericDocumentWrite('after', ...args)
    };

    this.activatedPipes = {};
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

  // pipes managements =========================================================

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
