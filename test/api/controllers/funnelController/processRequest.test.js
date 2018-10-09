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
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if no action is specified', () => {
    const request = new Request({controller: 'fakeController'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'No corresponding action null in controller fakeController'});
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if the action doesn\'t exist', () => {
    const request = new Request({controller: 'fakeController', action: 'create'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'No corresponding action create in controller fakeController'});
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('fakeController:errorCreate', request)).be.false();
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if a plugin action does not exist', () => {
    const request = new Request({controller: 'fakePlugin/controller', action: 'create'});

    should(() => funnel.processRequest(request)).throw(BadRequestError, {message: 'No corresponding action create in controller fakePlugin/controller'});
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
    should(kuzzle.pluginsManager.trigger.calledWithMatch('fakePlugin/controller:errorCreate', request)).be.false();
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if a plugin action returns a non-thenable object', done => {
    const request = new Request({controller: 'fakePlugin/controller', action: 'ok'});

    funnel.pluginsControllers['fakePlugin/controller'].ok.returns('foobar');

    funnel.processRequest(request)
      .then(() => done('Expected test to fail'))
      .catch(e => {
        try {
          should(e).be.instanceOf(PluginImplementationError);
          should(e.message).startWith('Unexpected return value from action fakePlugin/controller/ok: expected a Promise');
          should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
          should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.true();
          should(kuzzle.pluginsManager.trigger.calledWithMatch('fakePlugin/controller:errorOk', request)).be.true();
          should(kuzzle.statistics.startRequest).be.called();
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });

  it('should resolve the promise if everything is ok', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'ok'
    });

    return should(funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:beforeOk');
        should(kuzzle.pluginsManager.trigger).calledWith('fakeController:afterOk');
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.true();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.false();
        should(kuzzle.pluginsManager.trigger.calledWithMatch('fakeController:errorOk', request)).be.false();
        should(kuzzle.statistics.startRequest).be.called();
        should(kuzzle.statistics.completedRequest).be.called();
        should(kuzzle.statistics.failedRequest).not.be.called();
      })).be.fulfilled();
  });

  it('should allow the controller\'s action result to be a Request object', () => {
    const request = new Request({
      requestId: 'i-am-the-request-id',
      controller: 'fakeController',
      action: 'returnRequest'
    });

    const responseRequest = new Request({
      requestId: 'i-am-the-request-id',
      controller: 'fakeController',
      action: 'returnRequest'
    }, { status: 200, result: 'Hey' });

    funnel.controllers.fakeController.returnRequest = sinon.stub().resolves(responseRequest);

    return funnel.processRequest(request)
      .then(response => {
        should(response.result).be.eql(responseRequest.result);
        should(response.status).be.eql(responseRequest.status);
      });
  });

  it('should return a PluginImplementationError if the Request object returned is not the same', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'returnRequest'
    });

    const responseRequest = new Request({
      controller: 'fakeController',
      action: 'returnRequest'
    }, { status: 200, result: 'Hey' });

    funnel.controllers.fakeController.returnRequest = sinon.stub().resolves(responseRequest);

    return funnel.processRequest(request)
      .then(response => {
        should(response.status).be.eql(500);
        should(response.error).be.instanceOf(PluginImplementationError);
      });
  });

  it('should reject the promise if a controller action fails', done => {
    const request = new Request({
      controller: 'fakeController',
      action: 'fail',
    });

    funnel.controllers.fakeController.fail.rejects(new Error('rejected'));

    funnel.processRequest(request)
      .then(() => done('Expected test to fail'))
      .catch(e => {
        try {
          should(e).be.instanceOf(Error);
          should(e.message).be.eql('rejected');
          should(kuzzle.pluginsManager.trigger).calledWith('fakeController:beforeFail');
          should(kuzzle.pluginsManager.trigger).not.be.calledWith('fakeController:afterFail');
          should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
          should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.true();
          should(kuzzle.pluginsManager.trigger.calledWithMatch('fakeController:errorFail', request)).be.true();
          should(kuzzle.statistics.startRequest).be.called();
          should(kuzzle.statistics.completedRequest).not.be.called();
          should(kuzzle.statistics.failedRequest).be.called();
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });

  it('should wrap a Node error on a plugin action failure', done => {
    const request = new Request({
      controller: 'fakePlugin/controller',
      action: 'fail',
    });

    funnel.pluginsControllers['fakePlugin/controller'].fail.rejects(new Error('rejected'));

    funnel.processRequest(request)
      .then(() => done('Expected test to fail'))
      .catch(e => {
        try {
          should(e).be.instanceOf(PluginImplementationError);
          should(e.message).startWith('rejected');
          should(kuzzle.pluginsManager.trigger).calledWith('fakePlugin/controller:beforeFail');
          should(kuzzle.pluginsManager.trigger).not.be.calledWith('fakePlugin/controller:afterFail');
          should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onSuccess', request)).be.false();
          should(kuzzle.pluginsManager.trigger.calledWithMatch('request:onError', request)).be.true();
          should(kuzzle.pluginsManager.trigger.calledWithMatch('fakePlugin/controller:errorFail', request)).be.true();
          should(kuzzle.statistics.startRequest).be.called();
          should(kuzzle.statistics.completedRequest).not.be.called();
          should(kuzzle.statistics.failedRequest).be.called();
          done();
        }
        catch(err) {
          done(err);
        }
      });
  });
});
