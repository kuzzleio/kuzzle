var
  rc = require('rc'),
  q = require('q'),
  rewire = require('rewire'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  PartialError = require.main.require('lib/api/core/errors/partialError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
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

<<<<<<< HEAD
    beforeEach(function () {
      workerCalled = false;
      workerPromise = q();
      indexCreated = [];
      indexAdded = false;

      context = {
        kuzzle: {
          pluginsManager: {
            trigger: function () {
            }
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
          indexCache: {
            indexes: {},
            add: () => indexAdded = true
          }
        },
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
          should(indexAdded).be.false();
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
          should(indexAdded).be.true();
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
          should(indexAdded).be.true();
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

      context.kuzzle.indexCache.indexes = { foo: ['foo'], bar: ['bar']};

      createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexAdded).be.true();
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
        kuzzle: {
          pluginsManager: {
            trigger: function () {
            }
          },
          workerListener: {
            add: function (rq) {
              should(rq.controller).be.eql('admin');
              should(rq.action).be.eql('updateMapping');
              should(rq.index).be.eql(stubIndex);
              should(rq.collection).be.eql(stubCollection);
              should(rq.data.body).be.an.Object();
              workerCalled = true;
              mappingCreated = rq.data.body;
              return workerPromise;
            }
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
      this.timeout(500);
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
      this.timeout(500);

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
      this.timeout(500);
      workerPromise = q.reject(new Error('rejected'));
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
        kuzzle: {
          pluginsManager: {
            trigger: function () {
            }
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
      workerPromise = q.reject(new Error('rejected'));
      return should(importFixtures.call(context)).be.rejectedWith(InternalError);
    });

    it('should filter errors when they are about documents that already exist', function () {
      workerPromise = q.reject(new PartialError('rejected', [{status: 409}]));
      return should(importFixtures.call(context)).be.fulfilled();
    });
  });

  describe('#createInternalStructure', function () {
    var
      context,
      workerCalled,
      indexAdded,
      requests,
      createInternalStructure,
=======
    it('should exit the process with status 1 if the remote action does not exists', (done) => {
      exitStatus = 0;
      kuzzle.remoteActions.do('foo', {}, {});
      should(exitStatus).be.eql(1);
      done();
    });

    it('should exit the process with status 1 if no PID is given and PID is mandatory', (done) => {
>>>>>>> origin/develop
      params = rc('kuzzle');
      params._ = [];
      exitStatus = 0;

      kuzzle.remoteActions.do('enableServices', params, {});
      should(exitStatus).be.eql(1);
      done();
    });

    it('should exit the process with status 1 if the given PID does not exists', (done) => {
      params = rc('kuzzle');
      params._ = ['likeAvirgin', 'foo'];
      exitStatus = 0;

      kuzzle.remoteActions.do('enableServices', params, {});
      should(exitStatus).be.eql(1);
      done();
    });
  });
});
