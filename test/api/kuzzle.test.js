var
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  Kuzzle = rewire('../../lib/api/kuzzle');

describe('Test kuzzle server constructor', () => {
  var kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  it('should construct a kuzzle object', () => {
    should(kuzzle).be.an.Object();

    should(kuzzle.hooks).be.an.Object();
    should(kuzzle.services).be.an.Object();
    should(kuzzle.remoteActions).be.an.Object();

    should(kuzzle.internalEngine).be.an.Object();
    should(kuzzle.pluginsManager).be.an.Object();
    should(kuzzle.tokenManager).be.an.Object();
    should(kuzzle.indexCache).be.an.Object();

    should(kuzzle.passport).be.an.Object();
    should(kuzzle.funnel).be.an.Object();
    should(kuzzle.router).be.an.Object();

    should(kuzzle.hotelClerk).be.an.Object();
    should(kuzzle.dsl).be.an.Object();
    should(kuzzle.notifier).be.an.Object();
    should(kuzzle.statistics).be.an.Object();

    should(kuzzle.entryPoints).be.an.Object();

    should(kuzzle.remoteActionsController).be.an.Object();

    should(kuzzle.start).be.a.Function();
  });

  it('should construct a kuzzle server object with emit and listen event', (done) => {
    kuzzle.on('event', () => {
      done();
    });

    kuzzle.emit('event', {});
  });

  it('should start all services and register errors handlers on kuzzle.start', () => {
    var
      kuzzleMock,
      remoteActionDumpSpy = sinon.stub().returns(Promise.resolve()),
      processExitSpy = sinon.spy(),
      processOnSpy = sinon.spy(),
      processRemoveAllListenersSpy = sinon.spy();

    Kuzzle.__set__("process", {
      exit: processExitSpy,
      on: processOnSpy,
      emit: sinon.stub(process, 'emit'),
      removeAllListeners: processRemoveAllListenersSpy
    });

    Kuzzle.__set__("console", {
      error: sinon.spy()
    });

    kuzzleMock = {
      internalEngine: {
        init: sinon.stub().returns(Promise.resolve())
      },
      pluginsManager: {
        init: sinon.stub().returns(Promise.resolve()),
        run: sinon.stub().returns(Promise.resolve()),
        trigger: sinon.spy()
      },
      services: {
        init: sinon.stub().returns(Promise.resolve())
      },
      indexCache: {
        init: sinon.stub().returns(Promise.resolve())
      },
      funnel: {
        init: sinon.spy()
      },
      notifier: {
        init: sinon.spy()
      },
      statistics: {
        init: sinon.spy()
      },
      hooks: {
        init: sinon.spy()
      },
      entryPoints: {
        init: sinon.spy()
      },
      repositories: {
        init: sinon.stub().returns(Promise.resolve())
      },
      remoteActionsController: {
        init: sinon.stub().returns(Promise.resolve()),
        actions: {
          dump: remoteActionDumpSpy
        }
      },
    }

    kuzzle = new Kuzzle();
    kuzzle.start.call(kuzzleMock);

    should(processRemoveAllListenersSpy.getCall(0).args[0]).be.exactly('unhandledRejection');
    should(processOnSpy.getCall(0).args[0]).be.exactly('unhandledRejection');

    should(processRemoveAllListenersSpy.getCall(1).args[0]).be.exactly('uncaughtException');
    should(processOnSpy.getCall(1).args[0]).be.exactly('uncaughtException');

    should(processRemoveAllListenersSpy.getCall(2).args[0]).be.exactly('SIGHUP');
    should(processOnSpy.getCall(2).args[0]).be.exactly('SIGHUP');

    should(processRemoveAllListenersSpy.getCall(3).args[0]).be.exactly('SIGQUIT');
    should(processOnSpy.getCall(3).args[0]).be.exactly('SIGQUIT');

    should(processRemoveAllListenersSpy.getCall(4).args[0]).be.exactly('SIGABRT');
    should(processOnSpy.getCall(4).args[0]).be.exactly('SIGABRT');

    should(processRemoveAllListenersSpy.getCall(5).args[0]).be.exactly('SIGPIPE');
    should(processOnSpy.getCall(5).args[0]).be.exactly('SIGPIPE');

    should(processRemoveAllListenersSpy.getCall(6).args[0]).be.exactly('SIGTERM');
    should(processOnSpy.getCall(6).args[0]).be.exactly('SIGTERM');

    should(processRemoveAllListenersSpy.getCall(7).args[0]).be.exactly('SIGTRAP');
    should(processOnSpy.getCall(7).args[0]).be.exactly('SIGTRAP');
  })
});
