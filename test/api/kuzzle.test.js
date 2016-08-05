var
  should = require('should'),
  Kuzzle = require('../../lib/api/kuzzle');

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

});
