var
  rc = require('rc'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  should = require('should');

describe('Test kuzzle server constructor', () => {
  var kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  it('should construct a kuzzle object', () => {
    should(kuzzle).be.an.Object();

    should(kuzzle.hooks).be.an.Object();
    should(kuzzle.workers).be.an.Object();
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
    should(kuzzle.workerListener).be.an.Object();

    should(kuzzle.clusterManager).be.an.Object();
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

  describe('#remoteActions', () => {
    var
      processExit,
      params,
      exitStatus = 0;

    before(() => {

      processExit = process.exit;
      process.exit = (status) => {
        exitStatus = status;
      };

      kuzzle = new Kuzzle();
    });

    after(() => {
      process.exit = processExit;
    });

    it('should exit the process with status 1 if the remote action does not exists', (done) => {
      exitStatus = 0;
      kuzzle.remoteActions.do('foo', {}, {});
      should(exitStatus).be.eql(1);
      done();
    });

    it('should exit the process with status 1 if no PID is given and PID is mandatory', (done) => {
      params = rc('kuzzle');
      params.pid = undefined;
      exitStatus = 0;

      kuzzle.remoteActions.do('enableServices', params, {});
      should(exitStatus).be.eql(1);
      done();
    });

    it('should exit the process with status 1 if the given PID does not exists', (done) => {
      params = rc('kuzzle');
      params.pid = 'foo';
      exitStatus = 0;

      kuzzle.remoteActions.do('enableServices', params, {});
      should(exitStatus).be.eql(1);
      done();
    });
  });
});
