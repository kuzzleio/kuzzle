var
  rc = require('rc'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test kuzzle constructor', function () {

  var kuzzle;

  beforeEach(function () {
    kuzzle = new Kuzzle();

    kuzzle.pluginsManager = {
      trigger: function(event, data) {}
    };
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

    it('should log an error if elasticsearch fail when cleaning database', function (done) {
      var hasTriggedPluginManager = false;

      process.env.LIKE_A_VIRGIN = 1;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        writeEngine: {}
      };

      kuzzle.pluginsManager = {
        trigger: function(event, data) {
          console.log('??', event, data);
          should(event).be.exactly('cleanDb:error');
          should(data).be.exactly('Oops... something really bad happened during reset...');

          hasTriggedPluginManager = true;
        }
      };

      kuzzle.services.list.writeEngine.deleteIndexes = function() {
        return Promise.reject();
      };


      kuzzle.services.list.writeEngine.createIndex = function() {
        return Promise.reject();
      };

      should(kuzzle.cleanDb()).be.fulfilled();

      setTimeout(() => {
        should(hasTriggedPluginManager).be.exactly(true);
        done();
      }, 100);
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
    it('should create indexes when a valid mappings file is set', function (done) {

      var
        hasListedIndexes = false,
        hasCreatedIndex = false,
        hasPutMapping = false;

      process.env.LIKE_A_VIRGIN = 1;
      process.env.DEFAULT_MAPPING = '/var/app/features/fixtures/functionalTestsMappings.json';
      delete process.env.FIXTURES;
      kuzzle.isServer = true;
      kuzzle.pluginsManager = {
        trigger: function(event, data) {
          should(event).be.equalOneOf('preparedb:done', 'preparedb:start', 'preparedb:error', 'log:info', 'log:error');
        }
      };

      kuzzle.services.list = {
        readEngine: {},
        writeEngine: {}
      };

      kuzzle.services.list.readEngine.listIndexes = function() {
        hasListedIndexes = true;
        return Promise.resolve({data: {body: {indexes: [] } } });
      };

      kuzzle.services.list.writeEngine.createIndex = function() {
        hasCreatedIndex = true;
        return Promise.resolve();
      };

      kuzzle.services.list.writeEngine.putMapping = function() {
        hasPutMapping = true;
        return Promise.resolve();
      };

      kuzzle.prepareDb()
        .then(() => {
          should(hasListedIndexes).be.exactly(true);
          should(hasCreatedIndex).be.exactly(true);
          should(hasPutMapping).be.exactly(true);
          done();
        })
        .catch(error => done(error));
    });

    it('should create indexes when a valid fixtures file is set', function (done) {

      var
        hasListedIndexes = false,
        hasCreatedIndex = false,
        hasImportedFixtures = false;

      process.env.LIKE_A_VIRGIN = 1;
      process.env.FIXTURES = '/var/app/features/fixtures/functionalTestsFixtures.json';
      delete process.env.DEFAULT_MAPPING;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        readEngine: {},
        writeEngine: {}
      };

      kuzzle.services.list.readEngine.listIndexes = function() {
        hasListedIndexes = true;
        return Promise.resolve({data: {body: {indexes: [] } } });
      };

      kuzzle.services.list.writeEngine.createIndex = function() {
        hasCreatedIndex = true;
        return Promise.resolve();
      };

      kuzzle.services.list.writeEngine.import = function() {
        hasImportedFixtures = true;
        return Promise.resolve();
      };

      kuzzle.prepareDb()
        .then(() => {
          should(hasListedIndexes).be.exactly(true);
          should(hasCreatedIndex).be.exactly(true);
          should(hasImportedFixtures).be.exactly(true);
          done();
        })
        .catch(error => done(error));
    });

    it('should do nothing when no default mappings nor fixtures are set', function (done) {

      var
        hasListedIndexes = false;

      process.env.LIKE_A_VIRGIN = 1;
      delete process.env.FIXTURES;
      delete process.env.DEFAULT_MAPPING;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        readEngine: {},
        writeEngine: {}
      };

      kuzzle.services.list.readEngine.listIndexes = function() {
        hasListedIndexes = true;
        return Promise.resolve({data: {body: {indexes: [] } } });
      };

      kuzzle.prepareDb()
        .then(() => {
          should(hasListedIndexes).be.exactly(true);
          done();
        })
        .catch(error => done(error));
    });

    it('should do nothing when we are in a worker', function (done) {

      process.env.LIKE_A_VIRGIN = 1;
      process.env.FIXTURES = '/var/app/features/fixtures/functionalTestsFixtures.json';
      delete process.env.DEFAULT_MAPPING;
      kuzzle.isServer = false;

      kuzzle.prepareDb()
        .then(() => {
          done();
        })
        .catch(error => done(error));
    });
  });

});