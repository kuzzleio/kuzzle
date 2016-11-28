var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  CliController = rewire('../../../lib/api/controllers/cliController');

describe('lib/api/controllers/cliController', () => {
  var
    kuzzle,
    cli,
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

    requireMock.withArgs('./cli/cleanDb').returns(() => cleanDbStub);
    requireMock.withArgs('./cli/clearCache').returns(() => clearCacheStub);
    requireMock.withArgs('./cli/managePlugins').returns(() => managePluginsStub);
    requireMock.withArgs('./cli/data').returns(() => dataStub);
    requireMock.withArgs('./cli/dump').returns(() => dumpStub);

    kuzzle = new KuzzleMock();

    reset = CliController.__set__({
      require: requireMock,
      ResponseObject: sinon.spy()
    });
    cli = new CliController(kuzzle);
  });

  afterEach(() => {
    reset();
  });

  describe('#init', () => {
    it('should set the actions and register itself to Kuzzle broker', () => {
      cli.init();

      should(cli.actions.adminExists)
        .be.a.Function();
      should(cli.actions.createFirstAdmin)
        .be.a.Function();
      should(cli.actions.cleanDb)
        .be.exactly(cleanDbStub);
      should(cli.actions.clearCache)
        .be.exactly(clearCacheStub);
      should(cli.actions.managePlugins)
        .be.exactly(managePluginsStub);
      should(cli.actions.data)
        .be.exactly(dataStub);
      should(cli.actions.dump)
        .be.exactly(dumpStub);

      should(kuzzle.services.list.broker.listen)
        .be.calledOnce()
        .be.calledWith(kuzzle.config.queues.cliQueue, cli.onListenCB);

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:info', 'CLI controller initialized');
    });
  });

  describe('#onListenCB', () => {
    it('should send an error if no action is provided', () => {
      return cli.onListenCB({
        requestId: 'test'
      })
        .then(() => {
          should(CliController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, {
              message: 'No action given.'
            });

          should(CliController.__get__('ResponseObject').firstCall.args[1])
            .be.an.instanceOf(BadRequestError);

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', CliController.__get__('ResponseObject').returnValues[0]);
        });
    });

    it('should send an error if the provided action does not exist', () => {
      cli.init();

      return cli.onListenCB({
        requestId: 'test',
        action: 'invalid'
      })
        .then(() => {
          should(CliController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, {
              message: 'The action "invalid" does not exist.'
            });

          should(CliController.__get__('ResponseObject').firstCall.args[1])
            .be.an.instanceOf(NotFoundError);

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', CliController.__get__('ResponseObject').returnValues[0]);
        });
    });

    it('should send the response to the broker', () => {
      cli.init();
      cli.actions.data.returns(Promise.resolve('ok'));

      return cli.onListenCB({
        requestId: 'test',
        action: 'data'
      })
        .then(() => {
          should(CliController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, 'ok');

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', CliController.__get__('ResponseObject').returnValues[0]);
        });
    });

    it('should send the error gotten from the controller back to the broker', () => {
      var error = new Error('test');

      cli.init();
      cli.actions.data.returns(Promise.reject(error));

      return cli.onListenCB({
        requestId: 'test',
        action: 'data'
      })
        .then(() => {
          should(CliController.__get__('ResponseObject'))
            .be.calledOnce()
            .be.calledWithMatch({requestId: 'test'}, error);

          should(kuzzle.services.list.broker.send)
            .be.calledOnce()
            .be.calledWith('test', CliController.__get__('ResponseObject').returnValues[0]);
        });
    });
  });

});
