'use strict';

const
  rewire = require('rewire'),
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  SecurityController = rewire('../../../../lib/api/controllers/securityController');

describe('Test: security controller - credentials', () => {
  let
    kuzzle,
    request,
    securityController;

  before(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);
  });

  beforeEach(() => {
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#createCredentials', () => {
    it('should call the plugin create method', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'createCredentials',
        strategy: 'someStrategy',
        body: {
          some: 'credentials'
        },
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.createCredentials(request)
        .then(result => {
          should(result).be.deepEqual({foo: 'bar'});
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledTwice();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('create');
          should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[1]).be.eql('validate');
          should(methodStub).be.calledTwice();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.deepEqual({some: 'credentials'});
          should(methodStub.firstCall.args[2]).be.eql('someUserId');
          should(methodStub.firstCall.args[3]).be.eql('someStrategy');
          should(methodStub.secondCall.args[0]).be.eql(request);
          should(methodStub.secondCall.args[1]).be.deepEqual({some: 'credentials'});
          should(methodStub.secondCall.args[2]).be.eql('someUserId');
          should(methodStub.secondCall.args[3]).be.eql('someStrategy');
        });
    });
  });

  describe('#updateCredentials', () => {
    it('should call the plugin update method', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'createCredentials',
        strategy: 'someStrategy',
        body: {
          some: 'credentials'
        },
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.updateCredentials(request)
        .then(result => {
          should(result).be.deepEqual({foo: 'bar'});
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledTwice();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('update');
          should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.secondCall.args[1]).be.eql('validate');
          should(methodStub).be.calledTwice();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.deepEqual({some: 'credentials'});
          should(methodStub.firstCall.args[2]).be.eql('someUserId');
          should(methodStub.firstCall.args[3]).be.eql('someStrategy');
          should(methodStub.secondCall.args[0]).be.eql(request);
          should(methodStub.secondCall.args[1]).be.deepEqual({some: 'credentials'});
          should(methodStub.secondCall.args[2]).be.eql('someUserId');
          should(methodStub.secondCall.args[3]).be.eql('someStrategy');
        });
    });
  });

  describe('#hasCredentials', () => {
    it('should call the plugin exists method', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'hasCredentials',
        strategy: 'someStrategy',
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.hasCredentials(request)
        .then(result => {
          should(result).be.deepEqual({foo: 'bar'});
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('exists');
          should(methodStub).be.calledOnce();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.eql('someUserId');
          should(methodStub.firstCall.args[2]).be.eql('someStrategy');
        });
    });
  });

  describe('#validateCredentials', () => {
    it('should call the plugin validate method', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'validateCredentials',
        strategy: 'someStrategy',
        body: {
          some: 'credentials'
        },
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.validateCredentials(request)
        .then(result => {
          should(result).be.deepEqual({foo: 'bar'});
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('validate');
          should(methodStub).be.calledOnce();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.deepEqual({some: 'credentials'});
          should(methodStub.firstCall.args[2]).be.eql('someUserId');
          should(methodStub.firstCall.args[3]).be.eql('someStrategy');
        });
    });
  });

  describe('#deleteCredentials', () => {
    it('should call the plugin delete method', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'deleteCredentials',
        strategy: 'someStrategy',
        _id: 'someUserId'
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.deleteCredentials(request)
        .then(result => {
          should(result).be.deepEqual({acknowledged: true});
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('delete');
          should(methodStub).be.calledOnce();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.eql('someUserId');
          should(methodStub.firstCall.args[2]).be.eql('someStrategy');
        });
    });
  });

  describe('#getCredentials', () => {
    it('should call the plugin getInfo method if it is provided', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'getCredentials',
        strategy: 'someStrategy',
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.hasStrategyMethod = sandbox.stub().returns(true);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.getCredentials(request)
        .then(result => {
          should(result).be.deepEqual({foo: 'bar'});
          should(kuzzle.pluginsManager.hasStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[1]).be.eql('getInfo');
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('getInfo');
          should(methodStub).be.calledOnce();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.eql('someUserId');
          should(methodStub.firstCall.args[2]).be.eql('someStrategy');
        });
    });

    it('should resolve to an empty object if getInfo method is not provided', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'getCredentials',
        strategy: 'someStrategy',
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.hasStrategyMethod = sandbox.stub().returns(false);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.getCredentials(request)
        .then(result => {
          should(result).be.deepEqual({});
          should(kuzzle.pluginsManager.hasStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[1]).be.eql('getInfo');
          should(kuzzle.pluginsManager.getStrategyMethod.callCount).be.eql(0);
        });
    });
  });

  describe('#getCredentialsById', () => {
    it('should call the plugin getById method if it is provided', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'getCredentials',
        strategy: 'someStrategy',
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.hasStrategyMethod = sandbox.stub().returns(true);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.getCredentialsById(request)
        .then(result => {
          should(result).be.deepEqual({foo: 'bar'});
          should(kuzzle.pluginsManager.hasStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[1]).be.eql('getById');
          should(kuzzle.pluginsManager.getStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyMethod.firstCall.args[1]).be.eql('getById');
          should(methodStub).be.calledOnce();
          should(methodStub.firstCall.args[0]).be.eql(request);
          should(methodStub.firstCall.args[1]).be.eql('someUserId');
          should(methodStub.firstCall.args[2]).be.eql('someStrategy');
        });
    });

    it('should resolve to an empty object if getById method is not provided', () => {
      const methodStub = sinon.stub().returns(Promise.resolve({foo: 'bar'}));
      request = new Request({
        controller: 'security',
        action: 'getCredentials',
        strategy: 'someStrategy',
        _id: 'someUserId',
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.hasStrategyMethod = sandbox.stub().returns(false);
      kuzzle.pluginsManager.getStrategyMethod = sandbox.stub().returns(methodStub);

      return securityController.getCredentialsById(request)
        .then(result => {
          should(result).be.deepEqual({});
          should(kuzzle.pluginsManager.hasStrategyMethod).be.calledOnce();
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.hasStrategyMethod.firstCall.args[1]).be.eql('getById');
          should(kuzzle.pluginsManager.getStrategyMethod.callCount).be.eql(0);
        });
    });
  });

  describe('#getCredentialFields', () => {
    it('should return the list of a strategy\'s fields', () => {
      request = new Request({
        controller: 'security',
        action: 'getCredentialFields',
        strategy: 'someStrategy'
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy']);
      kuzzle.pluginsManager.getStrategyFields = sandbox.stub().returns(['aField', 'anotherField']);

      return securityController.getCredentialFields(request)
        .then(result => {
          should(result).be.deepEqual(['aField', 'anotherField']);
          should(kuzzle.pluginsManager.getStrategyFields).be.calledOnce();
          should(kuzzle.pluginsManager.getStrategyFields.firstCall.args[0]).be.eql('someStrategy');
        });
    });
  });

  describe('#getAllCredentialFields', () => {
    it('should return the list of all strategies\' fields', () => {
      request = new Request({
        controller: 'security',
        action: 'getAllCredentialFields',
        strategy: 'someStrategy'
      });
      kuzzle.pluginsManager.listStrategies = sandbox.stub().returns(['someStrategy', 'someOtherStrategy']);
      kuzzle.pluginsManager.getStrategyFields = sandbox.stub().returns(['aField', 'anotherField']);

      return securityController.getAllCredentialFields(request)
        .then(result => {
          should(result).be.deepEqual({
            someStrategy: ['aField', 'anotherField'],
            someOtherStrategy: ['aField', 'anotherField']
          });
          should(kuzzle.pluginsManager.getStrategyFields).be.calledTwice();
          should(kuzzle.pluginsManager.getStrategyFields.firstCall.args[0]).be.eql('someStrategy');
          should(kuzzle.pluginsManager.getStrategyFields.secondCall.args[0]).be.eql('someOtherStrategy');
        });
    });
  });
});