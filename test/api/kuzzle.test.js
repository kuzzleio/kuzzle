var
  rc = require('rc'),
  q = require('q'),
  rewire = require('rewire'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  PartialError = require.main.require('lib/api/core/errors/partialError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  prepareDb;

describe('Test kuzzle constructor', () => {
  var kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  it('should construct a kuzzle object', () => {
    should(kuzzle).be.an.Object();

    should(kuzzle.hooks).be.an.Object();
    should(kuzzle.workers).be.an.Object();
    should(kuzzle.remoteActions).be.an.Object();

    should(kuzzle.start).be.a.Function();
  });

  it('should construct a kuzzle object with emit and listen event', (done) => {
    kuzzle.on('event', () => {
      done();
    });

    kuzzle.emit('event', {});
  });

  describe('#remoteActions', () => {
    var 
      kuzzle,
      remoteActions,
      processExit,
      params,
      exitStatus = 0;

    before(() => {
      remoteActions = rewire('../../lib/api/remoteActions');

      processExit = process.exit;
      process.exit = (status) => {
        exitStatus = status;
      };

      kuzzle = new Kuzzle(false);
    });

    after(() => {
      process.exit = processExit;
    });

    it('should exit the process with status 1 if the remote action does not exists', (done) => {
      exitStatus = 0;
      remoteActions(kuzzle, 'foo', {}, {});
      should(exitStatus).be.eql(1);
      done();
    });

    it('should exit the process with status 1 if no PID is given and PID is mandatory', (done) => {
      params = rc('kuzzle');
      params._ = [];
      exitStatus = 0;

      remoteActions(kuzzle, 'enableServices', params, {});
      should(exitStatus).be.eql(1);
      done();
    });

    it('should exit the process with status 1 if the given PID does not exists', (done) => {
      params = rc('kuzzle');
      params._ = ['likeAvirgin', 'foo'];
      exitStatus = 0;

      remoteActions(kuzzle, 'enableServices', params, {});
      should(exitStatus).be.eql(1);
      done();
    });
  });
});
