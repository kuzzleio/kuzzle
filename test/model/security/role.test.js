'use strict';

const should = require('should');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const Role = require('../../../lib/model/security/role').default;
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
        }, context);

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      should(role.isActionAllowed(req)).be.true();
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

  describe('#checkRestrictions', () => {
    it('should properly handle restrictions', () => {
      const
        role = new Role(),
        req = new Request({
          controller: 'controller',
          action: 'action'
        }, context),

        restrictions = new Map(Object.entries(
          {
            index1: [],
            index2: ['collection1'],
            index3: ['collection1', 'collection2'],
          }
        ));

      role.controllers = {
        controller: {
          actions: {
            action: true
          }
        }
      };

      should(role.checkRestrictions(req, restrictions)).be.true();

      should(role.checkRestrictions('index', undefined, restrictions)).be.false();

      should(role.checkRestrictions('index1', undefined, restrictions)).be.true();

      should(role.checkRestrictions('index2', undefined, restrictions)).be.true();

      should(role.checkRestrictions('index2', 'collection', restrictions)).be.false();

      should(role.checkRestrictions('index2', 'collection1', restrictions)).be.true();

      should(role.checkRestrictions('index2', 'collection2', restrictions)).be.false();

      should(role.checkRestrictions('index3', 'collection2', restrictions)).be.true();
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
