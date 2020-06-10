'use strict';

const should = require('should');
const _ = require('lodash');

class FunctionalTestPlugin {
  constructor () {
    this.controllers = {};
    this.routes = [];
    this.pipes = {};

    // context.constructor.ESClient related declarations =======================

    this.controllers.constructors = { ESClient: 'testConstructorsESClient' };

    this.routes.push({
      action: 'ESClient',
      controller: 'constructors',
      url: '/constructors/esclient/:index',
      verb: 'post',
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
      testReturn: 'pipesTestReturn',
    };

    this.routes.push({
      action: 'manage',
      controller: 'pipes',
      url: '/pipes/:event/:state',
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
    this.hooks = {}
    this.hooks['core:kuzzleStart'] = async () => {
      console.log('Subscribe!')
      this.roomId = await this.sdk.realtime.subscribe('index', 'collection', {}, async notif => {
        console.log(notif);
      },
      {
        cluster: false
      })
    }
  }

  async init (config, context) {
    this.config = config;
    this.context = context;
    this.sdk = context.accessors.sdk;
    this.roomId = await this.sdk.realtime.subscribe('index', 'collection', {}, async notif => {
      console.log('HELLO BABE');
      console.log(notif);
    },
    {
      cluster: false
    })

    this.controllers.test = {
      test: async () => {
        this.roomId2 = await this.sdk.realtime.subscribe('index', 'collection2', {}, async notif => {
          console.log('SUBSCRIPTION 2');
        },
        {
          cluster: true
        })
      },
      test2: async () => {
        await this.sdk.realtime.unsubscribe(this.roomId)
      }
    }
    this.routes.push({
      action: 'test',
      controller: 'test',
      url: '/test',
      verb: 'post',
    })
    this.routes.push({
      action: 'test2',
      controller: 'test',
      url: '/test2',
      verb: 'post',
    })
  }

  // context.constructor.ESClient related methods ============================

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
