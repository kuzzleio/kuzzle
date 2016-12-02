var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Action = require('../../../lib/api/cli/action'),
  /** @type CliActions|RewiredModule */
  Cli = rewire('../../../lib/api/cli/index');

describe('Tests: api/cli/index.js', () => {
  var
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('should build proper properties', () => {
      var cli = new Cli(kuzzle);
      should(cli.actions).be.Object();
      should(cli.actions.adminExists).be.instanceOf(Action);
      should(cli.actions.clearCache).be.instanceOf(Action);
      should(cli.actions.cleanDb).be.instanceOf(Action);
      should(cli.actions.createFirstAdmin).be.instanceOf(Action);
      should(cli.actions.data).be.instanceOf(Action);
      should(cli.actions.dump).be.instanceOf(Action);
      should(cli.actions.manaPlugins).be.instanceOf(Action);
      should(cli.actions.manaPlugins.timeout).be.eql(1000);
      should(cli.actions.manaPlugins.timeOutCB).be.a.Function();
      should(cli.do).be.a.Function();
    });
  });

  describe('#managePlugins timeoutCB', () => {
    it('should set a custom timeoutCB for the managePlugins action', () => {
      var action = {
        foo: 'bar',
        timeout: 1000,
        initTimeout: sinon.spy()
      };

      Cli.__with__({
        console: {
          error: sinon.spy()
        },
        process: {
          exit: sinon.spy(),
          stdout: {
            write: sinon.spy()
          }
        }
      })(() => {
        var
          timeoutCB,
          cli = new Cli(kuzzle);

        timeoutCB = cli.actions.manaPlugins.timeOutCB;
        should(timeoutCB).be.an.instanceOf(Function);

        // first call - should init maxTimeout and spent
        timeoutCB.call(action);

        should(action.timeout).be.exactly(1000);
        should(action.maxTimeout).be.exactly(5 * 60 * 1000);
        should(action.spent).be.exactly(action.timeout * 2);
        should(Cli.__get__('process.stdout.write'))
          .be.calledOnce()
          .be.calledWith('.');
        should(Cli.__get__('console.error'))
          .have.callCount(0);

        // second call after max timeout is reached
        action.spent = (5 * 60 * 1000);
        timeoutCB.call(action);

        should(action.spent).be.exactly(5 * 60 * 1000 + action.timeout);
        // no additional call on process.stdout.write
        should(Cli.__get__('process.stdout.write'))
          .be.calledOnce()
          .be.calledWith('.');
        should(Cli.__get__('console.error'))
          .be.calledOnce()
          .be.calledWith('ERROR: No response from Kuzzle within ̀300s. Exiting');
        should(Cli.__get__('process.exit'))
          .be.calledOnce()
          .be.calledWith(1);

      });
    });
  });

  describe('#do', () => {
    var
      cli,
      reset;

    beforeEach(() => {
      var requireStub = sinon.stub();
      requireStub.withArgs('../../config').returns(kuzzle.config);
      requireStub.returns();

      reset = Cli.__set__({
        console: {
          log: sinon.spy(),
          error: sinon.spy()
        },
        require: requireStub,
        process: {
          exit: sinon.spy(),
          kill: sinon.spy()
        },
        InternalBroker: sinon.stub().returns({
          init: sinon.stub().returns(Promise.resolve()),
          listen: sinon.spy(),
          broadcast: sinon.spy(),
          send: sinon.spy()
        })
      });
      cli = new Cli(kuzzle);
    });

    afterEach(() => {
      reset();
    });

    it('should send the action to the internalBroker', () => {
      var
        data = {foo: 'bar', requestId: 'test'},
        context = {
          kuzzle: kuzzle,
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

      return cli.do.call(context, 'test', {})
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

    it('should output the error to the console if any', () => {
      var
        error = new Error('test'),
        context = {
          actions: {
            action: {
              onListenCB: sinon.spy()
            }
          }
        };

      kuzzle.internalEngine.init.returns(Promise.reject(error));

      return cli.do.call(context, 'action', 'data', {debug: true})
        .catch(err => {
          should(err).be.exactly(error);
          should(Cli.__get__('console.error'))
            .be.calledOnce()
            .be.calledWith(error.stack);
        });
    });
  });

});
