'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

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
        ok: sinon.stub().returns(Promise.resolve()),
        fail: sinon.stub()
      }
    };
  });

  it('should reject the promise if no controller is specified', done => {
    const request = new Request({action: 'create'});

    funnel.processRequest(request)
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should reject the promise if no action is specified', done => {
    const request = new Request({controller: 'document'});

    funnel.processRequest(request)
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should reject the promise if the controller doesn\'t exist', done => {
    const request = new Request({controller: 'foobar', action: 'create'});

    funnel.processRequest(request)
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should reject the promise if the action doesn\'t exist', done => {
    const request = new Request({controller: 'foo', action: 'bar'});

    funnel.processRequest(request)
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should resolve the promise if everything is ok', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'ok',
    });

    return should(funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:beforeOk');
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:afterOk');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.true();
        should(kuzzle.statistics.failedRequest.called).be.false();
      })).be.fulfilled();
  });

  it('should reject the promise if a controller action fails', done => {
    const request = new Request({
      controller: 'fakeController',
      action: 'fail',
    });

    funnel.controllers.fakeController.fail.returns(Promise.reject(new Error('rejected')));

    funnel.processRequest(request)
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(Error);
        should(e.message).be.eql('rejected');
        should(funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:beforeFail');
        should(kuzzle.pluginsManager.trigger).not.be.calledWith('fakeController:afterFail');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.true();
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.false();
        should(kuzzle.statistics.failedRequest.called).be.true();
        done();
      });
  });

  it('should not trigger an event if the request has already triggered it', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'ok',
    });

    request.triggers('fakeController:beforeOk');

    return should(funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.pluginsManager.trigger).not.be.calledWith('fakeController:beforeOk');
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:afterOk');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.true();
        should(kuzzle.statistics.failedRequest.called).be.false();
      })).be.fulfilled();
  });
});
