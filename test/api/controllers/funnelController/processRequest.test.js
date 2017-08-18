'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {BadRequestError, PluginImplementationError} = require('kuzzle-common-objects').errors;

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);

    // injects fake controllers for unit tests
    funnel.controllers = {
      'fakeController': {
        ok: sinon.stub().returns(Bluebird.resolve()),
        fail: sinon.stub()
      }
    };

    funnel.pluginsControllers = {
      'fakePlugin/controller': {
        ok: sinon.stub().returns(Bluebird.resolve()),
        fail: sinon.stub()
      }
    };
  });

  it('should throw if no controller is specified', () => {
    const request = new Request({action: 'create'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'Unknown controller null'});
    should(funnel.requestHistory.isEmpty()).be.true();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.statistics.startRequest.called).be.false();
  });

  it('should throw if no action is specified', () => {
    const request = new Request({controller: 'fakeController'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'No corresponding action null in controller fakeController'});
    should(funnel.requestHistory.isEmpty()).be.true();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.statistics.startRequest.called).be.false();
  });

  it('should throw if the action doesn\'t exist', () => {
    const request = new Request({controller: 'fakeController', action: 'create'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'No corresponding action create in controller fakeController'});
    should(funnel.requestHistory.isEmpty()).be.true();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('fakeController:errorCreate', request)).be.false();
    should(kuzzle.statistics.startRequest.called).be.false();
  });

  it('should throw if a plugin action does not exist', () => {
    const request = new Request({controller: 'fakePlugin/controller', action: 'create'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'No corresponding action create in controller fakePlugin/controller'});
    should(funnel.requestHistory.isEmpty()).be.true();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('fakePlugin/controller:errorCreate', request)).be.false();
    should(kuzzle.statistics.startRequest.called).be.false();
  });

  it('should resolve the promise if everything is ok', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'ok'
    });

    return should(funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:beforeOk');
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:afterOk');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('fakeController:errorOk', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.true();
        should(kuzzle.statistics.failedRequest.called).be.false();
      })).be.fulfilled();
  });

  it('should reject the promise if a controller action fails', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'fail',
    });

    funnel.controllers.fakeController.fail.returns(Bluebird.reject(new Error('rejected')));

    return funnel.processRequest(request)
      .then(() => {
        throw new Error('You shall not pass');
      })
      .catch(e => {
        should(e).be.instanceOf(Error);
        should(e.message).be.eql('rejected');
        should(funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:beforeFail');
        should(kuzzle.pluginsManager.trigger).not.be.calledWith('fakeController:afterFail');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('fakeController:errorFail', request)).be.true();
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.false();
        should(kuzzle.statistics.failedRequest.called).be.true();
      });
  });

  it('should wrap a Node error on a plugin action failure', () => {
    const request = new Request({
      controller: 'fakePlugin/controller',
      action: 'fail',
    });

    funnel.pluginsControllers['fakePlugin/controller'].fail.returns(Bluebird.reject(new Error('rejected')));

    return funnel.processRequest(request)
      .then(() => {
        throw new Error('You shall not pass');
      })
      .catch(e => {
        should(e).be.instanceOf(PluginImplementationError);
        should(e.message).startWith('rejected');
        should(funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.pluginsManager.trigger).calledWith('fakePlugin/controller:beforeFail');
        should(kuzzle.pluginsManager.trigger).not.be.calledWith('fakePlugin/controller:afterFail');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('fakePlugin/controller:errorFail', request)).be.true();
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.false();
        should(kuzzle.statistics.failedRequest.called).be.true();
      });
  });
});
