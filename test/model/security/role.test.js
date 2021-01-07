'use strict';

const should = require('should');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const Role = require('../../../lib/model/security/role');
const {
  Request,
  BadRequestError
} = require('../../../index');

describe('Test: model/security/role', () => {
  const context = {
    protocol: 'test',
    userId: '-1'
  };
  const request = new Request(
    {
      index: 'index',
      collection: 'collection',
      controller: 'controller',
      action: 'action'
    },
    context);

  before(() => {
    new KuzzleMock();
  });

  describe('#isActionAllowed', () => {
    it('should disallow any action when no matching entry can be found', () => {
      const
        role = new Role();

      role.controllers = {
        controller: {
          actions: {}
        }
      };

      should(role.isActionAllowed(request)).be.false();

      delete role.controllers.controller.actions;
      should(role.isActionAllowed(request)).be.false();

      delete role.controllers.controller;
      should(role.isActionAllowed(request)).be.false();

      delete role.controllers;
      should(role.isActionAllowed(request)).be.false();
    });

    it('should allow an action explicitely set to true', () => {
      const role = new Role();

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      should(role.isActionAllowed(request)).be.true();
    });

    // @deprecated
    it('should handle the memory storage controller aliases', () => {
      const
        role = new Role(),
        msRequest = new Request({
          controller: 'ms',
          action: 'time'
        }),
        memoryStorageRequest = new Request({
          controller: 'memoryStorage',
          action: 'time'
        }),
        forbiddenMsRequest = new Request({
          controller: 'ms',
          action: 'flushdb'
        });

      role.controllers = {
        ms: {
          actions: {
            time: true
          }
        }
      };

      should(role.isActionAllowed(msRequest)).be.true();
      should(role.isActionAllowed(memoryStorageRequest)).be.true();
      should(role.isActionAllowed(forbiddenMsRequest)).be.false();

      delete role.controllers.ms;
      role.controllers.memoryStorage = { actions: { time: true } };

      should(role.isActionAllowed(msRequest)).be.true();
      should(role.isActionAllowed(memoryStorageRequest)).be.true();
      should(role.isActionAllowed(forbiddenMsRequest)).be.false();
    });

    it('should allow a wildcard action', () => {
      const role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        }
      };

      should(role.isActionAllowed(request)).be.true();
    });

    it('should properly handle restrictions', () => {
      const
        role = new Role(),
        req = new Request({
          controller: 'controller',
          action: 'action'
        }, context),
        restrictions = [
          {index: 'index1'},
          {index: 'index2', collections: ['collection1']},
          {index: 'index3', collections: ['collection1', 'collection2']}
        ];

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      should(role.isActionAllowed(req)).be.true();
      should(role.isActionAllowed(req, restrictions)).be.true();

      req.input.resource.index = 'index';
      should(role.isActionAllowed(req, restrictions)).be.false();

      req.input.resource.index = 'index1';
      should(role.isActionAllowed(req, restrictions)).be.true();

      req.input.resource.index = 'index2';
      should(role.isActionAllowed(req, restrictions)).be.true();

      req.input.resource.collection = 'collection';
      should(role.isActionAllowed(req, restrictions)).be.false();

      req.input.resource.collection = 'collection1';
      should(role.isActionAllowed(req, restrictions)).be.true();

      req.input.resource.collection = 'collection2';
      should(role.isActionAllowed(req, restrictions)).be.false();

      req.input.resource.index = 'index3';
      should(role.isActionAllowed(req, restrictions)).be.true();
    });

    it('should properly handle overridden permissions', () => {
      const role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': true
          }
        },
        controller: {
          actions: {
            '*': false
          }
        }
      };

      should(role.isActionAllowed(request)).be.false();

      role.controllers.controller.actions.action = true;
      should(role.isActionAllowed(request)).be.true();

      role.controllers.controller.actions.action = false;
      should(role.isActionAllowed(request)).be.false();
    });

    it('should reject if the rights configuration is not a boolean', () => {
      const role = new Role();
      role.controllers = {
        '*': {
          actions: {
            '*': {an: 'object'}
          }
        }
      };

      should(role.isActionAllowed(request)).be.false();
    });

  });

  describe('#validateDefinition', () => {
    it('should reject the promise if the controllers definition is not an object', () => {
      const role = new Role();
      role.controllers = true;

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, {id: 'api.assert.invalid_type' });
    });

    it('should reject the promise if the controllers definition is empty', () => {
      const role = new Role();
      role.controllers = {};

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.empty_argument' });
    });

    it('should reject the promise if the controller element is not an object', () => {
      const role = new Role();
      role.controllers = {
        '*': true
      };

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should reject the promise if the controller element is empty', () => {
      const role = new Role();
      role.controllers = {
        '*': {}
      };

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.empty_argument' });
    });

    it('should reject the promise if the actions attribute is missing', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          a: true
        }
      };

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject the promise is the actions attribute is not an object', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          actions: true
        }
      };

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should reject the promise if the actions attribute is empty', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          actions: {}
        }
      };

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.empty_argument' });
    });

    it('should reject the promise if the action right is neither a boolean or an object', () => {
      const role = new Role();
      role.controllers = {
        controller: {
          actions: {
            action: null
          }
        }
      };

      return should(role.validateDefinition(context))
        .be.rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
    });

    it('should validate if only boolean rights are given', () => {
      const role = new Role();
      role.controllers = {
        controller1: {
          actions: {
            action1: false,
            action2: true
          }
        },
        controller2: {
          actions: {
            action3: true
          }
        }
      };

      return should(role.validateDefinition(context)).be.fulfilledWith();
    });
  });
});
