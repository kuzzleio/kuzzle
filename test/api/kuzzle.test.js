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
        workerCalled = false,
        hasFiredCleanDbDone = false;

      process.env.LIKE_A_VIRGIN = 1;
      kuzzle.isServer = true;
      kuzzle.services.list = {
        writeEngine: {}
      };

      kuzzle.pluginsManager = {
        trigger: function(event, data) {
          if (event === 'cleanDb:done') {
            hasFiredCleanDbDone = true;
            should(data).be.exactly('Reset done: Kuzzle is now like a virgin, touched for the very first time !');
          }
        }
      };

      kuzzle.workerListener = {
        add: function (requestObject) {
          should(requestObject.controller).be.eql('admin');
          should(requestObject.action).be.eql('deleteIndexes');
          workerCalled = true;
          return q();
        }
      };

      kuzzle.cleanDb()
        .then(() => {
          should(workerCalled).be.true();
          should(hasFiredCleanDbDone).be.true();
          done();
        })
        .catch(error => done(error));
    });

    it('should log an error if elasticsearch fail when cleaning database', function (done) {
      var
        workerCalled = false,
        hasFiredCleanDbError = false;

      process.env.LIKE_A_VIRGIN = 1;

      kuzzle.workerListener = {
        add: function (requestObject) {
          should(requestObject.controller).be.eql('admin');
          should(requestObject.action).be.eql('deleteIndexes');
          workerCalled = true;
          return q.reject('error');
        }
      };

      kuzzle.pluginsManager = {
        trigger: function(event, data) {
          if (event === 'cleanDb:error') {
            should(data).be.exactly('error');
            hasFiredCleanDbError = true;
          }
        }
      };

      kuzzle.cleanDb()
        .then(() => {
          should(workerCalled).be.true();
          should(hasFiredCleanDbError).be.true();
          done();
        })
        .catch(() => {
          done('Should have resolved the promise instead of rejecting it');
        });
    });

    it('should not clean database when environment variable LIKE_A_VIRGIN is not set to 1', function (done) {
      var
        workerCalled = false;

      process.env.LIKE_A_VIRGIN = undefined;
      kuzzle.isServer = true;

      kuzzle.workerListener = {
        add: function () {
          workerCalled = true;
          return q();
        }
      };

      kuzzle.cleanDb()
        .then(() => {
          should(workerCalled).be.false();
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#prepareDb', () => {
    var
      filesRead,
      indexCreated,
      mappingsImported,
      fixturesImported;

    before(function () {
      prepareDb = rewire('../../lib/api/prepareDb');

      prepareDb.__set__('readFile', function (filename) { filesRead.push(filename); return q(); });
      prepareDb.__set__('createIndexes', function () { indexCreated = true; return q(); });
      prepareDb.__set__('importMapping', function () { mappingsImported = true; return q(); });
      prepareDb.__set__('importFixtures', function () { fixturesImported = true; return q(); });

      kuzzle = new Kuzzle();

      kuzzle.pluginsManager = {
        trigger: function () {}
      };

      kuzzle.services = {
        list: {
          readEngine: {
            listIndexes: function () {
              return q({
                data: {
                  body: {
                    indexes: ['foo', 'bar']
                  }
                }
              });
            }
          }
        }
      };
    });

    beforeEach(function () {
      filesRead = [];
      indexCreated = false;
      mappingsImported = false;
      fixturesImported = false;
    });

    it('should execute the right call chain', function (done) {
      kuzzle.isServer = true;

      prepareDb.call(kuzzle)
        .then(() => {
          should(filesRead).match(['mappings', 'fixtures']);
          should(indexCreated).be.true();
          should(mappingsImported).be.true();
          should(fixturesImported).be.true();
          done();
        })
        .catch(err => done(err));
    });

    it('should do nothing if not in a kuzzle server instance', function (done) {
      kuzzle.isServer = false;

      prepareDb.call(kuzzle)
        .then(() => {
          should(filesRead).match([]);
          should(indexCreated).be.false();
          should(mappingsImported).be.false();
          should(fixturesImported).be.false();
          done();
        })
        .catch(err => done(err));
    });
  });

  describe('#readFile', function () {
    var
      context,
      readFile,
      fileContent = '';

    before(function () {
      prepareDb = rewire('../../lib/api/prepareDb');
      prepareDb.__set__('fs', {
        readFileSync: function () { return fileContent; }
      });

      readFile = prepareDb.__get__('readFile');
    });

    beforeEach(function () {
      context = {
        pluginsManager: {
          trigger: function () {}
        },
        data: {}
      };
    });

    it('should do nothing if the corresponding env variable is not set', function (done) {
      this.timeout(50);
      context.data = { foo: 'bar' };

      readFile.call(context, 'foo')
        .then(data => {
          should(data).be.undefined();
          should(context.data).be.eql({foo: {}});
          done();
        })
        .catch(err => done(err));
    });

    it('should return the parsed content of the file', function (done) {
      this.timeout(50);
      fileContent = '{"foo": "bar"}';

      readFile.call(context, 'fixtures')
        .then(data => {
          should(data).be.undefined();
          should(context.data).be.an.Object().and.be.eql({fixtures: JSON.parse(fileContent)});
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if the file content is not a valid JSON object', function () {
      fileContent = 'not a valid JSON content';

      return should(readFile.call(context, 'fixtures')).be.rejectedWith(InternalError);
    });
  });

  describe('#createIndexes', function () {
    var
      context,
      createIndexes,
      workerCalled,
      indexCreated,
      workerPromise;

    before(function () {
      prepareDb = rewire('../../lib/api/prepareDb');
      createIndexes = prepareDb.__get__('createIndexes');
    });

    beforeEach(function () {
      workerCalled = false;
      workerPromise = q();
      indexCreated = [];

      context = {
        pluginsManager: {
          trigger: function () {}
        },
        workerListener: {
          add: function (rq) {
            should(rq.controller).be.eql('admin');
            should(rq.action).be.eql('createIndex');
            should(rq.index).not.be.undefined();
            workerCalled = true;
            indexCreated.push(rq.index);
            return workerPromise;
          }
        },
        actualIndexes: [],
        data: {
          fixtures: {},
          mappings: {}
        }
      };
    });

    it('should do nothing if there is no data mapping and no data fixtures', function (done) {
      this.timeout(50);

      createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.false();
          done();
        })
        .catch(err => done(err));
    });

    it('should call workers correctly to create data mappings indexes', function (done) {
      this.timeout(50);
      context.data.mappings = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexCreated.length).be.eql(Object.keys(context.data.mappings).length);
          should(indexCreated.sort()).match(Object.keys(context.data.mappings).sort());
          done();
        })
        .catch(err => done(err));
    });

    it('should call workers correctly to create data fixtures indexes', function (done) {
      this.timeout(50);
      context.data.fixtures = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexCreated.length).be.eql(Object.keys(context.data.fixtures).length);
          should(indexCreated.sort()).match(Object.keys(context.data.fixtures).sort());
          done();
        })
        .catch(err => done(err));
    });

    it('should not try to create index that already exists', function (done) {
      this.timeout(50);
      context.data.mappings = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      context.actualIndexes = ['foo', 'bar'];

      createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexCreated.length).be.eql(1);
          should(indexCreated).match(['qux']);
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if an index creation fails', function () {
      workerPromise = q.reject(new Error('failed'));
      context.data.mappings = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      return should(createIndexes.call(context)).be.rejectedWith(InternalError);
    });
  });

  describe('#importMapping', function () {
    var
      context,
      stubIndex = 'index',
      stubCollection = 'collection',
      importMapping,
      workerCalled,
      mappingCreated,
      workerPromise;

    before(function () {
      prepareDb = rewire('../../lib/api/prepareDb');
      importMapping = prepareDb.__get__('importMapping');
    });

    beforeEach(function () {
      workerCalled = false;
      workerPromise = q();
      mappingCreated = null;

      context = {
        pluginsManager: {
          trigger: function () {}
        },
        workerListener: {
          add: function (rq) {
            should(rq.controller).be.eql('admin');
            should(rq.action).be.eql('putMapping');
            should(rq.index).be.eql(stubIndex);
            should(rq.collection).be.eql(stubCollection);
            should(rq.data.body).be.an.Object();
            workerCalled = true;
            mappingCreated = rq.data.body;
            return workerPromise;
          }
        },
        data: {
          mappings: {
            index: {
              collection: {
                properties: {
                  foo: { type: 'string'}
                }
              }
            }
          }
        }
      };
    });

    it('should do nothing if there is no mapping to import', function (done) {
      this.timeout(50);
      context.data.mappings = {};

      importMapping.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.false();
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if the mapping file is not properly formatted', function () {
      context.data.mappings.index.collection = { foo: 'bar' };
      return should(importMapping.call(context)).be.rejectedWith(InternalError);
    });

    it('should call the write worker with the right arguments to import mappings', function (done) {
      this.timeout(50);

      importMapping.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(mappingCreated).be.eql(context.data.mappings.index.collection);
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if the mapping creation fails', function () {
      workerPromise = q.reject(new ResponseObject({}, new Error('rejected')));
      return should(importMapping.call(context)).be.rejectedWith(InternalError);
    });
  });

  describe('#importFixtures', function () {
    var
      context,
      stubIndex = 'index',
      stubCollection = 'collection',
      importFixtures,
      workerCalled,
      fixturesImported,
      workerPromise;

    before(function () {
      prepareDb = rewire('../../lib/api/prepareDb');
      importFixtures = prepareDb.__get__('importFixtures');
    });

    beforeEach(function () {
      workerCalled = false;
      workerPromise = q();
      fixturesImported = null;

      context = {
        pluginsManager: {
          trigger: function () {}
        },
        workerListener: {
          add: function (rq) {
            should(rq.controller).be.eql('bulk');
            should(rq.action).be.eql('import');
            should(rq.index).be.eql(stubIndex);
            should(rq.collection).be.eql(stubCollection);
            should(rq.data.body).be.an.Object();
            workerCalled = true;
            fixturesImported = rq.data.body;
            return workerPromise;
          }
        },
        data: {
          fixtures: {
            index: {
              collection: {
                foo: {bar: 'qux'}
              }
            }
          }
        }
      };
    });

    it('should do nothing if there is no fixtures to import', function (done) {
      this.timeout(50);
      context.data.fixtures = {};
      importFixtures.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.false();
          done();
        })
        .catch(err => done(err));
    });

    it('should call the write worker with the right request object', function (done) {
      this.timeout(50);

      importFixtures.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(fixturesImported).be.eql(context.data.fixtures.index.collection);
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if a fixture import fails', function () {
      workerPromise = q.reject(new ResponseObject({}, new Error('rejected')));
      return should(importFixtures.call(context)).be.rejectedWith(InternalError);
    });

    it('should filter errors when they are about documents that already exist', function () {
      workerPromise = q.reject(new ResponseObject({}, new PartialError('rejected', [{status: 409}])));
      return should(importFixtures.call(context)).be.fulfilled();
    });
  });
});
