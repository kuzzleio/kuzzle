'use strict';

const should = require('should');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('Backend', () => {
  let application;
  let Backend;

  beforeEach(() => {
    mockrequire('../../../lib/kuzzle', KuzzleMock);

    ({ Backend } = mockrequire.reRequire('../../../lib/core/backend/backend'));

    application = new Backend('black-mesa');
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('ControllerManager#register', () => {
    const getDefinition = () => ({
      actions: {
        sayHello: {
          handler: async request => `Hello, ${request.input.args.name}`,
          http: [{
            verb: 'post',
            path: '/greeting/hello/:name',
            openapi: {
              parameters: [{
                in: 'path',
                name: 'name',
                schema: {
                  type: 'string'
                },
                required: true,
              }],
              responses: {
                200: {
                  description: 'Custom greeting',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'string',
                      }
                    }
                  }
                }
              }
            }
          }],
        },
        sayBye: {
          handler: async request => `Bye ${request.input.args.name}!`,
        }
      }
    });
    let definition;

    beforeEach(() => {
      definition = getDefinition();
    });

    it('should registers a new controller definition', () => {
      application.controller.register('greeting', definition);

      should(application._controllers.greeting).not.be.undefined();
      should(application._controllers.greeting.actions.sayHello)
        .be.eql(definition.actions.sayHello);
    });

    it('should rejects if the name is already taken', () => {
      application.controller.register('greeting', definition);

      should(() => {
        application.controller.register('greeting', definition);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });
  });

  describe('ControllerManager#use', () => {
    class GreetingController {
      constructor () {
        this.definition = {
          actions: {
            sayHello: {
              handler: this.sayHello
            },
          }
        };
      }

      async sayHello () {}
    }

    let controller;

    beforeEach(() => {
      controller = new GreetingController();
    });

    it('should uses a new controller instance', () => {
      application.controller.use(controller);

      should(application._controllers.greeting).not.be.undefined();
      should(application._controllers.greeting.actions.sayHello.handler.name)
        .be.eql('bound sayHello');
    });

    it('should uses the name property for controller name', () => {
      controller.name = 'bonjour';
      application.controller.use(controller);

      should(application._controllers.bonjour).not.be.undefined();
    });

    it('should rejects if the controller instance is invalid', () => {
      controller.definition.actions.sayHello.handler = {};

      should(() => {
        application.controller.use(controller);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });

    it('should rejects if the name is already taken', () => {
      application.controller.use(controller);
      const controller2 = new GreetingController();

      should(() => {
        application.controller.use(controller2);
      }).throwError({ id: 'plugin.assert.invalid_controller_definition' });
    });
  });
});
