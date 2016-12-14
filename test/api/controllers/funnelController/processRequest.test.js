'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Kuzzle = require('../../../../lib/api/kuzzle');

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
    sandbox = sinon.sandbox.create();

    // injects fake controllers for unit tests
    kuzzle.funnel.controllers = {
      'fakeController': {
        ok: sinon.stub().returns(Promise.resolve()),
        fail: sinon.stub()
      }
    }
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.statistics, 'startRequest');
    sandbox.stub(kuzzle.statistics, 'completedRequest');
    sandbox.stub(kuzzle.statistics, 'failedRequest');
    kuzzle.funnel.requestHistory.clear();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject the promise if no controller is specified', done => {
    var object = {
      action: 'create'
    };

    kuzzle.funnel.processRequest(new Request(object))
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(kuzzle.funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should reject the promise if no action is specified', done => {
    var object = {
      controller: 'write'
    };

    kuzzle.funnel.processRequest(new Request(object))
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(kuzzle.funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should reject the promise if the controller doesn\'t exist', done => {
    var object = {
      controller: 'toto',
      action: 'create'
    };

    kuzzle.funnel.processRequest(new Request(object))
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(kuzzle.funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should reject the promise if the action doesn\'t exist', done => {
    var object = {
      controller: 'foo',
      action: 'bar'
    };

    kuzzle.funnel.processRequest(new Request(object))
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(BadRequestError);
        should(kuzzle.funnel.requestHistory.isEmpty()).be.true();
        should(kuzzle.statistics.startRequest.called).be.false();
        done();
      });
  });

  it('should resolve the promise if everything is ok', done => {
    var request = new Request({
      controller: 'fakeController',
      action: 'ok',
    });

    kuzzle.funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(kuzzle.funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.true();
        should(kuzzle.statistics.failedRequest.called).be.false();
        done();
      })
      .catch(e => done(e));
  });

  it('should reject the promise if a controller action fails', done => {
    var request = new Request({
      controller: 'fakeController',
      action: 'fail',
    });

    kuzzle.funnel.controllers.fakeController.fail.returns(Promise.reject(new Error('rejected')));

    kuzzle.funnel.processRequest(request)
      .then(() => done('should have failed'))
      .catch(e => {
        should(e).be.instanceOf(Error);
        should(e.message).be.eql('rejected');
        should(kuzzle.funnel.requestHistory.toArray()).match([request]);
        should(kuzzle.statistics.startRequest.called).be.true();
        should(kuzzle.statistics.completedRequest.called).be.false();
        should(kuzzle.statistics.failedRequest.called).be.true();
        done();
      });
  });
});
