var
  rc = require('rc'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

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

  describe('#cleanDb', () => {
    it('should clean database when environment variable LIKE_A_VIRGIN is set to 1', function (done) {

      var
        hasDeletedIndexes = false,
        hasCreatedIndex = false;

      process.env.LIKE_A_VIRGIN = 1;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        writeEngine: {}
      };

      kuzzle.pluginsManager = {
        trigger: function(event, data) {
          should(event).be.exactly('cleanDb:done');
          should(data).be.exactly('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
        }
      };

      kuzzle.services.list.writeEngine.deleteIndexes = function() {
        hasDeletedIndexes = true;
        return Promise.resolve();
      };

      kuzzle.services.list.writeEngine.createIndex = function() {
        hasCreatedIndex = true;
        return Promise.resolve();
      };

      kuzzle.cleanDb()
        .then(() => {
          should(hasDeletedIndexes).be.exactly(true);
          should(hasCreatedIndex).be.exactly(true);
          done();
        })
        .catch(error => done(error));
    });

    it('should log an error if elasticsearch fail when cleaning database', function () {

      process.env.LIKE_A_VIRGIN = 1;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        writeEngine: {}
      };

      kuzzle.pluginsManager = {
        trigger: function(event, data) {
          should(event).be.exactly('cleanDb:error');
          should(data).be.exactly('Oops... something really bad happened during reset...');
        }
      };

      kuzzle.services.list.writeEngine.deleteIndexes = function() {
        return Promise.reject();
      };


      kuzzle.services.list.writeEngine.createIndex = function() {
        return Promise.reject();
      };

      should(kuzzle.cleanDb()).be.fulfilled();
    });

    it('should not clean database when environment variable LIKE_A_VIRGIN is not set to 1', function (done) {
      var
        hasDeletedIndexes = false,
        hasCreatedIndex = false;


      process.env.LIKE_A_VIRGIN = undefined;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        writeEngine: {}
      };

      kuzzle.services.list.writeEngine.deleteIndexes = function() {
        hasDeletedIndexes = true;
        return Promise.reject();
      };

      kuzzle.services.list.writeEngine.createIndex = function() {
        hasCreatedIndex = true;
        return Promise.reject();
      };


      kuzzle.cleanDb()
        .then(() => {
          should(hasDeletedIndexes).be.exactly(false);
          should(hasCreatedIndex).be.exactly(false);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#prepareDb', () => {

  });
});