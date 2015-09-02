var
  should = require('should'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Test kuzzle constructor', function () {

  var kuzzle;

  before(function () {
    kuzzle = new Kuzzle();
  });

  it('should construct a kuzzle object', function () {
    should(kuzzle).be.an.Object();

    should(kuzzle.hooks).be.an.Object();
    should(kuzzle.workers).be.an.Object();

    should(kuzzle.start).be.a.Function();
    should(kuzzle.enable).be.a.Function();
    should(kuzzle.cleanDb).be.a.Function();
    should(kuzzle.prepareDb).be.a.Function();
  });

  it('should construct a kuzzle object with emit and listen event', function (done) {
    kuzzle.on('event', function () {
      done();
    });

    kuzzle.emit('event', {});
  });
});