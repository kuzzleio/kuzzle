const
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Action = require('../../../lib/api/cli/action');

describe('Tests: api/cli/index.js', () => {
  let
    kuzzle,
    Cli;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    Cli = require('../../../lib/api/cli/index');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    mockrequire.stopAll();
  });

  describe('#constructor', () => {
    it('should build proper properties', () => {
      const cli = new Cli(kuzzle);
      should(cli.actions).be.Object();
      should(cli.actions.adminExists).be.instanceOf(Action);
      should(cli.actions.clearCache).be.instanceOf(Action);
      should(cli.actions.cleanDb).be.instanceOf(Action);
      should(cli.actions.createFirstAdmin).be.instanceOf(Action);
      should(cli.actions.data).be.instanceOf(Action);
      should(cli.actions.dump).be.instanceOf(Action);
      should(cli.doAction).be.a.Function();
    });
  });

  describe('#do', () => {
    let cli;

    beforeEach(() => {
      mockrequire('../../../lib/services/internalBroker', function () {
        return {
          init: sinon.stub().returns(Bluebird.resolve()),
          listen: sinon.stub(),
          broadcast: sinon.stub(),
          send: sinon.stub()
        };
      });

      Cli = mockrequire.reRequire('../../../lib/api/cli/index');
      cli = new Cli(kuzzle);
    });

    it('should send the action to the internalBroker', () => {
      const
        data = {foo: 'bar', requestId: 'test'},
        context = {
          kuzzle,
          actions: {
            test: {
              onListenCB: sinon.spy(),
              initTimeout: sinon.spy(),
              prepareData: sinon.stub().returns(data),
              deferred: {
                promise: 'promise'
              }
            }
          }
        };

      return cli.doAction.call(context, 'test', {})
        .then(response => {
          should(response).be.exactly('promise');
          should(kuzzle.services.list.broker.listen).be.calledOnce();
          should(kuzzle.services.list.broker.listen.firstCall.args[1]).be.a.Function();
          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.exactly('cli-queue');
          should(kuzzle.services.list.broker.send.firstCall.args[1]).match({
            data: {
              requestId: 'test',
              controller: 'actions',
              action: 'test',
              foo: 'bar'
            },
            options: {
              status: 102
            }
          });
          should(context.actions.test.initTimeout).be.calledOnce();
        });

    });

    it('should reject the promise in case of error', () => {
      const
        error = new Error('test'),
        context = {
          kuzzle,
          actions: {
            action: {
              onListenCB: sinon.spy()
            }
          }
        };

      kuzzle.internalEngine.init.returns(Bluebird.reject(error));

      return should(cli.doAction.call(context, 'action', 'data', {debug: true})).be.rejectedWith(error);
    });
  });
});
