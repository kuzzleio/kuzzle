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
          cleanAndPrepare: action,
          cleanDb: action,
          clearCache: action,
          createFirstAdmin: action,
          enableServices: action,
          managePlugins: action,
          prepareDb: action,
          dump: action
        });
        should(spy).have.callCount(9);
      });
    });

  });

  describe('#do', () => {
    var
      consoleSpy,
      exitSpy,
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
      consoleSpy = RemoteActions.__get__('console').log;
      exitSpy = RemoteActions.__get__('process').exit;
      remoteActions = new RemoteActions(kuzzle);
    });

    afterEach(() => {
      reset();
    });

    it('should exit with a return code 1 if the action could not be found', () => {
      var error = new Error('test');

      RemoteActions.__with__({
        require: sinon.stub().throws(error)
      })(() => {
        remoteActions.do('fake', {});

        should(consoleSpy).be.calledOnce();
        should(consoleSpy).be.calledWith('Action fake does not exist');
        should(exitSpy).be.calledOnce();
        should(exitSpy).be.calledWithExactly(1);
      });
    });

    it('should send the action given', () => {
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

  });

});
