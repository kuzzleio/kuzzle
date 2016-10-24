var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  RemoteActionsController = rewire('../../../lib/api/controllers/remoteActionsController');

describe('lib/api/controllers/remoteActionsController', () => {
  var
    kuzzle,
    remoteActions,
    reset,
    cleanDbStub,
    clearCacheStub,
    managePluginsStub,
    dumpStub,
    dataStub;

  beforeEach(() => {
    var
      requireMock = sinon.stub();

    cleanDbStub = sinon.stub();
    clearCacheStub = sinon.stub();
    managePluginsStub = sinon.stub();
    dataStub = sinon.stub();
    dumpStub = sinon.stub();

    requireMock.withArgs('./remoteActions/cleanDb').returns(() => cleanDbStub);
    requireMock.withArgs('./remoteActions/clearCache').returns(() => clearCacheStub);
    requireMock.withArgs('./remoteActions/managePlugins').returns(() => managePluginsStub);
    requireMock.withArgs('./remoteActions/data').returns(() => dataStub);
    requireMock.withArgs('./remoteActions/dump').returns(() => dumpStub);

    kuzzle = new KuzzleMock();

    reset = RemoteActionsController.__set__({
      require: requireMock,
      ResponseObject: sinon.spy()
    });
    remoteActions = new RemoteActionsController(kuzzle);
  });

  afterEach(() => {
    reset();
  });

  describe('#init', () => {
    it('should set the actions and register itself to Kuzzle broker', () => {
      remoteActions.init();

      should(remoteActions.actions.adminExists)
        .be.exactly(kuzzle.funnel.controllers.admin.adminExists);
      should(remoteActions.actions.createFirstAdmin)
        .be.exactly(kuzzle.funnel.controllers.admin.createFirstAdmin);
      should(remoteActions.actions.cleanDb)
        .be.exactly(cleanDbStub);
      should(remoteActions.actions.clearCache)
        .be.exactly(clearCacheStub);
      should(remoteActions.actions.managePlugins)
        .be.exactly(managePluginsStub);
      should(remoteActions.actions.data)
        .be.exactly(dataStub);
      should(remoteActions.actions.dump)
        .be.exactly(dumpStub);

      should(kuzzle.services.list.broker.listen)
        .be.calledOnce()
        .be.calledWith(kuzzle.config.queues.remoteActionsQueue, remoteActions.onListenCB);

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:info', 'Remote actions controller initialized');
    });
  });

  describe('#onListenCB', () => {
    it('should send an error if no action is provided', () => {
      return remoteActions.onListenCB({
        requestId: 'test'
      })
        .then(() => {
          should(RemoteActionsController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, {
              message: 'No action given.'
            });

          should(RemoteActionsController.__get__('ResponseObject').firstCall.args[1])
            .be.an.instanceOf(BadRequestError);

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', RemoteActionsController.__get__('ResponseObject').returnValues[0]);
        });
    });

    it('should send an error if the provided action does not exist', () => {
      remoteActions.init();

      return remoteActions.onListenCB({
        requestId: 'test',
        action: 'invalid'
      })
        .then(() => {
          should(RemoteActionsController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, {
              message: 'The action "invalid" does not exist.'
            });

          should(RemoteActionsController.__get__('ResponseObject').firstCall.args[1])
            .be.an.instanceOf(NotFoundError);

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', RemoteActionsController.__get__('ResponseObject').returnValues[0]);
        });
    });

    it('should send the response to the broker', () => {
      remoteActions.init();
      remoteActions.actions.data.resolves('ok');

      return remoteActions.onListenCB({
        requestId: 'test',
        action: 'data'
      })
        .then(() => {
          should(RemoteActionsController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, 'ok');

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', RemoteActionsController.__get__('ResponseObject').returnValues[0]);
        });
    });

    it('should send the error gotten from the controller back to the broker', () => {
      var error = new Error('test');

      remoteActions.init();
      remoteActions.actions.data.rejects(error);

      return remoteActions.onListenCB({
        requestId: 'test',
        action: 'data'
      })
        .then(() => {
          should(RemoteActionsController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, error);

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', RemoteActionsController.__get__('ResponseObject').returnValues[0]);
        });
    });
  });

});
