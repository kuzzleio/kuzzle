'use strict';

const
  should = require('should'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  ControllerMock = require('../../../mocks/controller.mock'),
  {
    Request,
    errors: {
      BadRequestError,
      PluginImplementationError,
      InternalError: KuzzleInternalError
    }
  } = require('kuzzle-common-objects');

describe('funnelController.processRequest', () => {
  let
    kuzzle,
    funnel;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnel = new FunnelController(kuzzle);

    // inject fake controllers for unit tests
    funnel.controllers.fakeController = new ControllerMock(kuzzle);
    funnel.pluginsControllers['fakePlugin/controller'] =
      new ControllerMock(kuzzle);
  });

  it('should throw if no controller is specified', () => {
    const request = new Request({action: 'create'});

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {message: 'Unknown controller null'});
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onError', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if no action is specified', () => {
    const request = new Request({controller: 'fakeController'});

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {
        message: 'No corresponding action null in controller fakeController'
      });
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onError', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if the action does not exist', () => {
    const request = new Request({
      controller: 'fakeController',
      action: 'create'
    });

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {
        message: 'No corresponding action create in controller fakeController'
      });
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onError', request);
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('fakeController:errorCreate', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if a plugin action does not exist', () => {
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'create'});

    should(() => funnel.processRequest(request))
      .throw(BadRequestError, {
        message: `No corresponding action create in controller ${controller}`
      });
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onSuccess', request);
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('request:onError', request);
    should(kuzzle.pluginsManager.trigger)
      .not.calledWith('fakePlugin/controller:errorCreate', request);
    should(kuzzle.statistics.startRequest).not.be.called();
  });

  it('should throw if a plugin action returns a non-thenable object', done => {
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'succeed'});

    funnel.pluginsControllers[controller].succeed.returns('foobar');

    funnel.processRequest(request)
      .then(() => done(new Error('Expected test to fail')))
      .catch(e => {
        try {
          should(e).be.instanceOf(PluginImplementationError);
          should(e.message).startWith(
            `Unexpected return value from action ${controller}/succeed: expected a Promise`);
          should(kuzzle.pluginsManager.trigger)
            .not.calledWith('request:onSuccess', request);
          should(kuzzle.pluginsManager.trigger)
            .calledWith('request:onError', request);
          should(kuzzle.pluginsManager.trigger)
            .calledWith(`${controller}:errorSucceed`, request);
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
      action: 'succeed'
    });

    return funnel.processRequest(request)
      .then(response => {
        should(response).be.exactly(request);
        should(kuzzle.pluginsManager.trigger)
          .calledWith('fakeController:beforeSucceed');
        should(kuzzle.pluginsManager.trigger)
          .calledWith('fakeController:afterSucceed');
        should(kuzzle.pluginsManager.trigger)
          .calledWith('request:onSuccess', request);
        should(kuzzle.pluginsManager.trigger)
          .not.calledWith('request:onError', request);
        should(kuzzle.pluginsManager.trigger)
          .not.calledWith('fakeController:errorSucceed', request);
        should(kuzzle.statistics.startRequest).be.called();
        should(kuzzle.statistics.completedRequest).be.called();
        should(kuzzle.statistics.failedRequest).not.be.called();
      });
  });

  it('should reject the promise if a controller action fails', done => {
    const request = new Request({
      controller: 'fakeController',
      action: 'fail',
    });

    funnel.processRequest(request)
      .then(() => done(new Error('Expected test to fail')))
      .catch(e => {
        try {
          should(e).be.instanceOf(KuzzleInternalError);
          should(e.message).be.eql('rejected action');
          should(kuzzle.pluginsManager.trigger)
            .calledWith('fakeController:beforeFail');
          should(kuzzle.pluginsManager.trigger)
            .not.be.calledWith('fakeController:afterFail');
          should(kuzzle.pluginsManager.trigger)
            .not.calledWith('request:onSuccess', request);
          should(kuzzle.pluginsManager.trigger)
            .calledWith('request:onError', request);
          should(kuzzle.pluginsManager.trigger)
            .calledWith('fakeController:errorFail', request);
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
    const
      controller = 'fakePlugin/controller',
      request = new Request({controller, action: 'fail'});

    funnel.pluginsControllers[controller].fail.rejects(new Error('foobar'));

    funnel.processRequest(request)
      .then(() => done(new Error('Expected test to fail')))
      .catch(e => {
        try {
          should(e).be.instanceOf(PluginImplementationError);
          should(e.message).startWith('foobar');
          should(kuzzle.pluginsManager.trigger)
            .calledWith(`${controller}:beforeFail`);
          should(kuzzle.pluginsManager.trigger)
            .not.be.calledWith(`${controller}:afterFail`);
          should(kuzzle.pluginsManager.trigger)
            .not.calledWith('request:onSuccess', request);
          should(kuzzle.pluginsManager.trigger)
            .calledWith('request:onError', request);
          should(kuzzle.pluginsManager.trigger)
            .calledWith('fakePlugin/controller:errorFail', request);
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
