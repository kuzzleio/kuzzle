var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  RemoteActions = rewire('../../../lib/api/remoteActions/index');

describe('Tests: api/remoteActions/index.js', () => {
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
      RemoteActions.__with__({
        initActions: sinon.spy()
      })(() => {
        var
          stub = RemoteActions.__get__('initActions'),
          remoteActions = new RemoteActions(kuzzle);

        should(remoteActions.actions).eql({});
        should(remoteActions.do).be.a.Function();
        should(stub).be.calledOnce();
      });
    });

  });

  describe('#initActions', () => {
    var
      initActions = RemoteActions.__get__('initActions');

    it('should set the client actions', () => {
      var action = {foo: 'bar'};

      RemoteActions.__with__({
        Action: sinon.stub().returns(action)
      })(() => {
        var
          context = {actions: {}},
          spy = RemoteActions.__get__('Action');

        initActions.call(context);

        should(context.actions).match({
          adminExists: action,
          clearCache: action,
          cleanDb: action,
          createFirstAdmin: action,
          managePlugins: action,
          data: action,
          dump: action
        });
        should(spy).have.callCount(7);
      });
    });
  });

  describe('#initActions - managePlugins timeoutCB', () => {
    it('should set a custom timeoutCB for the managePlugins action', () => {
      var action = {
        foo: 'bar',
        timeout: 1000,
        initTimeout: sinon.spy()
      };

      RemoteActions.__with__({
        Action: sinon.stub().returns(action),
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
          context = {actions: {}},
          initActions = RemoteActions.__get__('initActions'),
          managePluginsArgs,
          timeoutCB;

        initActions.call(context);

        should(RemoteActions.__get__('Action'))
          .be.have.callCount(7);

        managePluginsArgs = RemoteActions.__get__('Action').getCall(6).args[0];
        should(managePluginsArgs).match({
          timeout: 1000
        });

        timeoutCB = managePluginsArgs.timeOutCB;
        should(timeoutCB)
          .be.an.instanceOf(Function);

        // first call - should init maxTimeout and spent
        timeoutCB.call(action);

        should(action.timeout).be.exactly(1000);
        should(action.maxTimeout).be.exactly(5 * 60 * 1000);
        should(action.spent).be.exactly(action.timeout * 2);
        should(RemoteActions.__get__('process.stdout.write'))
          .be.calledOnce()
          .be.calledWith('.');
        should(RemoteActions.__get__('console.error'))
          .have.callCount(0);

        // second call after max timeout is reached
        action.spent = (5 * 60 * 1000);
        timeoutCB.call(action);

        should(action.spent).be.exactly(5 * 60 * 1000 + action.timeout);
        // no additional call on process.stdout.write
        should(RemoteActions.__get__('process.stdout.write'))
          .be.calledOnce()
          .be.calledWith('.');
        should(RemoteActions.__get__('console.error'))
          .be.calledOnce()
          .be.calledWith('No response from Kuzzle within ̀300s. Exiting');
        should(RemoteActions.__get__('process.exit'))
          .be.calledOnce()
          .be.calledWith(1);

      });
    });
  });

  describe('#do', () => {
    var
      // consoleSpy,
      // exitSpy,
      remoteActions,
      reset;

    beforeEach(() => {
      var requireStub = sinon.stub();
      requireStub.withArgs('../../config').returns(kuzzle.config);
      requireStub.returns();

      reset = RemoteActions.__set__({
        console: {
          log: sinon.spy(),
          error: sinon.spy()
        },
        require: requireStub,
        PluginsManager: sinon.stub().returns({
          init: sinon.stub().resolves(),
          run: sinon.stub().resolves()
        }),
        process: {
          exit: sinon.spy(),
          kill: sinon.spy()
        },
        InternalBroker: sinon.stub().returns({
          init: sinon.stub().resolves(),
          listen: sinon.spy(),
          broadcast: sinon.spy(),
          send: sinon.spy()
        })
      });
      // consoleSpy = RemoteActions.__get__('console').log;
      // exitSpy = RemoteActions.__get__('process').exit;
      remoteActions = new RemoteActions(kuzzle);
    });

    afterEach(() => {
      reset();
    });

    it('should send the action to the internalBroker', () => {
      var
        data = {foo: 'bar'},
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

      return remoteActions.do.call(context, 'test', {})
        .then(response => {
          should(response).be.exactly('promise');
          should(kuzzle.services.list.broker.listen).be.calledOnce();
          should(kuzzle.services.list.broker.listen.firstCall.args[1]).be.a.Function();
          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.exactly('remote-actions-queue');
          should(kuzzle.services.list.broker.send.firstCall.args[1]).match({
            controller: 'actions',
            action: 'test',
            data: {
              body: data
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

      kuzzle.internalEngine.init.rejects(error);

      return remoteActions.do.call(context, 'action', 'data', {debug: true})
        .catch(err => {
          should(err).be.exactly(error);
          should(RemoteActions.__get__('console.error'))
            .be.calledOnce()
            .be.calledWith(error.stack);
        });
    });
  });

});
