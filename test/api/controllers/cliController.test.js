const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  CliController = rewire('../../../lib/api/controllers/cliController');

describe('lib/api/controllers/cliController', () => {
  let
    kuzzle,
    cli,
    reset,
    adminExistsStub,
    createFirstAdminStub,
    cleanDbStub,
    clearCacheStub,
    dumpStub,
    dataStub;

  beforeEach(() => {
    const requireMock = sinon.stub();

    adminExistsStub = sinon.stub();
    createFirstAdminStub = sinon.stub();
    cleanDbStub = sinon.stub();
    clearCacheStub = sinon.stub();
    dataStub = sinon.stub();
    dumpStub = sinon.stub();

    requireMock.withArgs('./cli/adminExists').returns(() => adminExistsStub);
    requireMock.withArgs('./cli/createFirstAdmin').returns(() => createFirstAdminStub);
    requireMock.withArgs('./cli/cleanDb').returns(() => cleanDbStub);
    requireMock.withArgs('./cli/clearCache').returns(() => clearCacheStub);
    requireMock.withArgs('./cli/data').returns(() => dataStub);
    requireMock.withArgs('./cli/dump').returns(() => dumpStub);

    kuzzle = new KuzzleMock();

    reset = CliController.__set__({
      require: requireMock
    });
    cli = new CliController(kuzzle);
  });

  afterEach(() => {
    reset();
  });

  describe('#init', () => {
    it('should set the actions and register itself to Kuzzle broker', () => {
      cli.onListenCB = {bind: sinon.stub().returns('foobar')};
      cli.init();

      should(cli.actions.adminExists).be.exactly(adminExistsStub);
      should(cli.actions.createFirstAdmin).be.exactly(createFirstAdminStub);
      should(cli.actions.cleanDb).be.exactly(cleanDbStub);
      should(cli.actions.clearCache).be.exactly(clearCacheStub);
      should(cli.actions.data).be.exactly(dataStub);
      should(cli.actions.dump).be.exactly(dumpStub);

      should(kuzzle.services.list.broker.listen)
        .be.calledOnce()
        .be.calledWith(kuzzle.config.queues.cliQueue, 'foobar');
      should(cli.onListenCB.bind).calledWith(cli);

      should(kuzzle.pluginsManager.trigger)
        .be.calledOnce()
        .be.calledWith('log:info', 'CLI controller initialized');
    });
  });

  describe('#onListenCB', () => {
    it('should send an error if no action is provided', () => {
      const rawRequest = {data: {requestId: 'test'}, options: {}};

      cli.init();

      return cli.onListenCB(rawRequest)
        .then(() => {
          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.eql('test');
          should(kuzzle.services.list.broker.send.firstCall.args[1].options.error).be.instanceOf(NotFoundError);
        });
    });

    it('should send an error if the provided action does not exist', () => {
      const rawRequest = {data: {requestId: 'test', action: 'invalid'}, options: {}};

      cli.init();

      return cli.onListenCB(rawRequest)
        .then(() => {
          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.eql('test');
          should(kuzzle.services.list.broker.send.firstCall.args[1].options.error).be.instanceOf(NotFoundError);
        });
    });

    it('should send the response to the broker', () => {
      const rawRequest = {data: {requestId: 'test', action: 'data'}, options: {}};

      cli.init();
      cli.actions.data.returns(Promise.resolve('ok'));

      return cli.onListenCB(rawRequest)
        .then(() => {
          rawRequest.options.result = 'ok';
          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.eql('test');
          should(kuzzle.services.list.broker.send.firstCall.args[1]).be.match(rawRequest);
        });
    });

    it('should send the error gotten from the controller back to the broker', () => {
      const
        rawRequest = {data: {requestId: 'test', action: 'data'}, options: {}},
        error = new BadRequestError('test');

      cli.init();
      cli.actions.data.returns(Promise.reject(error));

      return cli.onListenCB(rawRequest)
        .then(() => {
          rawRequest.options.error = error;

          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.eql('test');
          should(kuzzle.services.list.broker.send.firstCall.args[1]).be.match(rawRequest);
        });
    });
  });

});
