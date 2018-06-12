const
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../mocks/kuzzle.mock');

/*
 /!\ In these tests, the promise returned by shutdown
 do not mark the function as "finished".
 The promise is resolved before halting Kuzzle in case
 the shutdown is initiated using the CLI, to allow it
 to finish and exit while Kuzzle is shutting down.
 */

describe('CLI Action: shutdown', () => {
  let
    kuzzle,
    pm2Mock,
    processMock,
    shutdown;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.funnel.remainingRequests = 0;

    pm2Mock = {
      list: sinon.stub(),
      restart: sinon.stub(),
      delete: sinon.stub()
    };

    processMock = {
      exit: sinon.stub(),
      pid: process.pid
    };

    mockrequire('pm2', pm2Mock);
    mockrequire.reRequire('../../lib/util/shutdown');
    shutdown = rewire('../../lib/util/shutdown');

    shutdown.__set__({
      process: processMock,
      // prevent waiting seconds for unit tests
      setTimeout: sinon.spy(function (...args) { setImmediate(args[0]); })
    });
    //
    // shutdown = shutdownFactory(kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should exit immediately if unable to retrieve the PM2 process list', done => {
    pm2Mock.list.yields(new Error('foo'));

    shutdown(kuzzle, sinon.stub())
      .then(() => {
        setTimeout(() => {
          should(kuzzle.entryPoints.dispatch)
            .calledOnce()
            .calledWith('shutdown');

          should(processMock.exit).calledOnce().calledWith(0);
          should(pm2Mock.delete).not.be.called();
          should(pm2Mock.restart).not.be.called();
          done();
        }, 50);
      });
  });

  it('should exit immediately if kuzzle was not started with PM2', done => {
    pm2Mock.list.yields(null, []);

    shutdown(kuzzle, sinon.stub())
      .then(() => {
        setTimeout(() => {
          should(kuzzle.entryPoints.dispatch)
            .calledOnce()
            .calledWith('shutdown');

          should(processMock.exit).calledOnce().calledWith(0);
          should(pm2Mock.delete).not.be.called();
          should(pm2Mock.restart).not.be.called();
          done();
        }, 50);
      });
  });

  it('should restart Kuzzle instead of stopping it if the PM2 watcher is active', done => {
    pm2Mock.list.yields(null, [{
      pid: process.pid,
      pm_id: 'foobar',
      pm2_env: {
        watch: true
      }
    }]);

    shutdown(kuzzle, sinon.stub())
      .then(() => {
        setTimeout(() => {
          should(kuzzle.entryPoints.dispatch)
            .calledOnce()
            .calledWith('shutdown');

          should(processMock.exit).not.be.called();
          should(pm2Mock.delete).not.be.called();
          should(pm2Mock.restart).be.calledOnce().calledWith('foobar');
          done();
        }, 50);
      });
  });

  it('should delete entries from PM2 if PM2 watcher is inactive and halt Kuzzle', done => {
    pm2Mock.list.yields(null, [{
      pid: process.pid,
      pm_id: 'foobar',
      pm2_env: {}
    }]);

    shutdown(kuzzle, sinon.stub())
      .then(() => {
        // should wait until called a second time by PM2
        setTimeout(() => {
          should(kuzzle.entryPoints.dispatch)
            .calledOnce()
            .calledWith('shutdown');

          should(processMock.exit).not.be.called();
          should(pm2Mock.delete).be.calledOnce().calledWith('foobar');
          should(pm2Mock.restart).not.be.called();

          shutdown(kuzzle, sinon.stub());

          setTimeout(() => {
            should(kuzzle.entryPoints.dispatch)
              .calledOnce()
              .calledWith('shutdown');

            should(processMock.exit).be.calledOnce().calledWith(0);
            should(pm2Mock.delete).be.calledOnce().calledWith('foobar');
            should(pm2Mock.restart).not.be.called();
            done();
          }, 200);
        }, 50);
      });
  });

  it('should wait for the funnel to finish remaining requests before shutting down', done => {
    // security against a wrong "success" test
    let remainingChanged = false;

    kuzzle.funnel.remainingRequests = 123;

    pm2Mock.list.yields(new Error('foo'));

    shutdown(kuzzle, sinon.stub())
      .then(() => {
        setTimeout(() => {
          should(remainingChanged).be.true();
          should(kuzzle.entryPoints.dispatch)
            .calledOnce()
            .calledWith('shutdown');

          should(processMock.exit).calledOnce().calledWith(0);
          should(pm2Mock.delete).not.be.called();
          should(pm2Mock.restart).not.be.called();
          done();
        }, 50);
      });

    setTimeout(() => {
      should(kuzzle.entryPoints.dispatch)
        .calledOnce()
        .calledWith('shutdown');

      should(pm2Mock.delete).not.be.called();
      should(pm2Mock.restart).not.be.called();
      should(processMock.exit).not.be.called();

      kuzzle.funnel.remainingRequests = 0;
      remainingChanged = true;
    }, 100);
  });
});
