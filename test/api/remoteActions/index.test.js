var
  rewire = require('rewire'),
  should = require('should'),
  params = require('rc')('kuzzle'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  RemoteActions = rewire('../../../lib/api/remoteActions/index');

describe('Tests: api/remoteActions/index.js', () => {
  var
    kuzzle;

  beforeEach(() => {
    kuzzle = {
      services: {},
      internalEngine: {
        init: sinon.stub().resolves(),
        search : () => Promise.resolve({hits: []})
      }
    };
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

        should(remoteActions.kuzzle).be.exactly(kuzzle);
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
          createFirstAdmin: action,
          enableServices: action,
          managePlugins: action,
          prepareDb: action
        });
        should(spy).have.callCount(7);
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
      reset = RemoteActions.__set__({
        config: sinon.stub().returns({
          queues: {
            remoteActionsQueue: 'queue'
          },
          pluginsManager: params.pluginsManager
        }),
        console: {
          log: sinon.spy(),
          error: sinon.spy()
        },
        require: sinon.stub().returns(),
        pluginsManager: sinon.stub().returns({
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

    it('should exit with a return code 1 if the pid is mandatory and not provided', () => {
      var
        context = {
          actions: {
            test: {isPidMandatory: true, onListenCB: () => {}}
          }
        };

      remoteActions.do.call(context, 'test', {});

      should(consoleSpy).be.calledOnce();
      should(consoleSpy).be.calledWith('The PID parameter is mandatory.');
      should(exitSpy).be.calledOnce();
      should(exitSpy).be.calledWithExactly(1);
    });

    it('should exit with error if the given pid does not exist', () => {
      var
        error = new Error('test');

      RemoteActions.__with__({
        'process.kill': sinon.stub().throws(error)
      })(() => {
        var
          context = {
            actions: {
              test: {
                isPidMandatory: true,
                onListenCB: () => {}
              }
            }
          };

        remoteActions.do.call(context, 'test', {pid: 42});

        should(consoleSpy).be.calledOnce();
        should(consoleSpy).be.calledWith('The process 42 does not exist');
        should(exitSpy).be.calledOnce();
        should(exitSpy).be.calledWithExactly(1);
      });
    });

    it('should broadcast the action if pid is set to all', () => {
      var
        data = {foo: 'bar'},
        context = {
          kuzzle: kuzzle,
          actions: {
            test: {
              isPidMandatory: false,
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

          should(kuzzle.internalEngine.init).be.calledOnce();

          should(kuzzle.services.list.broker.listen).be.calledOnce();
          should(kuzzle.services.list.broker.listen.firstCall.args[1]).be.a.Function();
          should(kuzzle.services.list.broker.broadcast).be.calledOnce();
          should(kuzzle.services.list.broker.broadcast.firstCall.args[0]).be.exactly('queue');
          should(kuzzle.services.list.broker.broadcast.firstCall.args[1]).match({
            controller: 'actions',
            action: 'test',
            data: {
              body: data
            }
          });
          should(context.actions.test.initTimeout).be.calledOnce();
        });
    });

    it('should send the action if a pid is given', () => {
      var
        data = {foo: 'bar'},
        context = {
          kuzzle: kuzzle,
          actions: {
            test: {
              isPidMandatory: true,
              onListenCB: sinon.spy(),
              initTimeout: sinon.spy(),
              prepareData: sinon.stub().returns(data),
              deferred: {
                promise: 'promise'
              }
            }
          }
        };

      return remoteActions.do.call(context, 'test', {pid: 42})
        .then(response => {
          should(response).be.exactly('promise');
          should(kuzzle.services.list.broker.listen).be.calledOnce();
          should(kuzzle.services.list.broker.listen.firstCall.args[1]).be.a.Function();
          should(kuzzle.services.list.broker.send).be.calledOnce();
          should(kuzzle.services.list.broker.send.firstCall.args[0]).be.exactly('queue-42');
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
