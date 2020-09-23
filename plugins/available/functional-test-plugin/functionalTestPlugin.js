'use strict';

const should = require('should');
const _ = require('lodash');
const { Request } = require('kuzzle-common-objects');

class FunctionalTestPlugin {
  constructor () {
    this.version = require('./package.json').version;

    this.controllers = {};
    this.routes = [];
    this.pipes = {};
    this.hooks = {};

    // context.constructor.ESClient related declarations =======================

    this.controllers.constructors = { ESClient: 'testConstructorsESClient' };

    this.routes.push({
      action: 'ESClient',
      controller: 'constructors',
      url: '/constructors/esclient/:index',
      verb: 'post',
    });

    // Custom Realtime subscription related declarations =======================

    this.controllers.accessors = {
      registerSubscription: 'registerSubscription',
    };
    
    this.routes.push({
      action: 'registerSubscription',
      controller: 'accessors',
      url: '/accessors/registerSubscription',
      verb: 'POST',
    });

    // context.secrets related declarations ====================================

    this.controllers.secrets = { test: 'testSecrets' };

    this.routes.push({
      action: 'test',
      controller: 'secrets',
      url: '/secrets',
      verb: 'post',
    });

    // pipes related declarations ==============================================

    this.activatedPipes = {};

    this.controllers.pipes = {
      deactivateAll: 'pipesDeactivateAll',
      manage: 'pipesManage',
      testReturn: 'pipesTestReturn'
    };

    this.routes.push({
      action: 'manage',
      controller: 'pipes',
      path: '/pipes/:event/:state', // should work with "path" or "url"
      verb: 'post',
    });
    this.routes.push({
      action: 'deactivateAll',
      controller: 'pipes',
      url: '/pipes',
      verb: 'delete',
    });
    this.routes.push({
      action: 'testReturn',
      controller: 'pipes',
      url: '/pipes/test-return/:name',
      verb: 'post',
    });

    this.pipes['generic:document:beforeWrite'] =
      (...args) => this.genericDocumentEvent('beforeWrite', ...args);
    this.pipes['generic:document:afterWrite'] =
      (...args) => this.genericDocumentEvent('afterWrite', ...args);
    this.pipes['generic:document:beforeUpdate'] =
      (...args) => this.genericDocumentEvent('beforeUpdate', ...args);
    this.pipes['generic:document:afterUpdate'] =
      (...args) => this.genericDocumentEvent('afterUpdate', ...args);
    this.pipes['generic:document:beforeGet'] =
      (...args) => this.genericDocumentEvent('beforeGet', ...args);
    this.pipes['generic:document:afterGet'] =
      (...args) => this.genericDocumentEvent('afterGet', ...args);
    this.pipes['generic:document:beforeDelete'] =
      (...args) => this.genericDocumentEvent('beforeDelete', ...args);
    this.pipes['generic:document:afterDelete'] =
      (...args) => this.genericDocumentEvent('afterDelete', ...args);

    this.pipes['plugin-functional-test-plugin:testPipesReturn'] =
      async name => `Hello, ${name}`;

    // Pipe declared with a function name
    this.pipes['server:afterNow'] = 'afterNowPipe';

    // Embedded SDK realtime
    this.hooks['kuzzle:state:live'] = async () => {
      const roomId = await this.sdk.realtime.subscribe(
        'test',
        'question',
        {},
        async () => {
          await this.sdk.realtime.publish('test', 'answer', {});
          await this.sdk.realtime.unsubscribe(roomId);
        });
    };

    // hooks related declarations ==============================================
    this.hooks['server:afterNow'] = async () => {
      await this.context.accessors.sdk.realtime.publish(
        'functional-test',
        'hooks',
        { event: 'server:afterNow' });
    };
  }

  async init (config, context) {
    this.config = config;
    this.context = context;
    this.sdk = context.accessors.sdk;

    // Plugins must be able to perform API requests during their init phase.
    // There is no test associated: this line by itself will make functional
    // tests throw before they can even start if this premise is violated.
    await this.sdk.server.info();
  }

  // accessors.registerSubscription related methods ============================

  async registerSubscription(request) {
    const customRequest = new Request(
      {
        action: request.input.action,
        body: {
          match: {
            name: 'Luca'
          }
        },
        collection: 'titi',
        controller: request.input.controller,
        index: 'toto',
      },
      {
        connectionId: request.context.connection.id,
      });
  
    const roomId = await this.context.accessors.realtime.registerSubscription(
      customRequest
    );
  
    return {
      acknowledged: 'OK',
      roomId,
    };
  }

  // context.constructor.ESClient related methods ==============================

  async testConstructorsESClient (request) {
    const
      client = new this.context.constructors.ESClient(),
      esRequest = {
        body: request.input.body,
        id: request.input.resource._id,
        index: request.input.resource.index,
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
    const payload = request.input.body;
    const state = request.input.args.state;
    const event = request.input.args.event;

    this.activatedPipes[event] = {
      payload,
      state,
    };

    return null;
  }

  async pipesDeactivateAll () {
    for (const pipe of Object.values(this.activatedPipes)) {
      pipe.state = 'off';
    }

    return null;
  }

  async genericDocumentEvent (event, documents) {
    const pipe = this.activatedPipes[`generic:document:${event}`];

    if (!pipe || pipe.state === 'off') {
      return documents;
    }

    for (const document of documents) {
      for (const [field, value] of Object.entries(pipe.payload)) {
        /* eslint-disable-next-line no-eval */
        _.set(document, field, eval(value));
      }
    }

    return documents;
  }

  async afterNowPipe (request) {
    const pipe = this.activatedPipes['server:afterNow'];

    if (pipe && pipe.state !== 'off') {
      const response = request.response.result;
      response.lyrics = 'The distant future, The year 2000. The humans are dead.';
    }

    return request;
  }

  /**
   * Tests that the context.accessors.trigger method returns the results of the
   * pipe chain
   */
  async pipesTestReturn (request) {
    const helloName = await this.context.accessors.trigger(
      'testPipesReturn',
      request.input.args.name);

    return { result: helloName };
  }
}

module.exports = FunctionalTestPlugin;
