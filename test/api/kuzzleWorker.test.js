var
  rc = require('rc'),
  KuzzleWorker = require.main.require('lib/api/kuzzleWorker'),
  should = require('should');

describe('Test kuzzle worker constructor', () => {
  var kuzzle;

  before(() => {
    kuzzle = new KuzzleWorker();
  });

  it('should construct a kuzzle worker object', () => {
    should(kuzzle).be.an.Object();

    should(kuzzle.hooks).be.an.Object();
    should(kuzzle.workers).be.an.Object();
    should(kuzzle.services).be.an.Object();

    should(kuzzle.internalEngine).be.an.Object();
    should(kuzzle.pluginsManager).be.an.Object();
    should(kuzzle.indexCache).be.an.Object();

    should(kuzzle.start).be.a.Function();
  });

  it('should construct a kuzzle object with emit and listen event', (done) => {
    kuzzle.on('event', () => {
      done();
    });

    kuzzle.emit('event', {});
  });
});
