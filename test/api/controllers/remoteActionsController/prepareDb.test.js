var
  rc = require('rc'),
  params = rc('kuzzle'),
  q = require('q'),
  rewire = require('rewire'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  PartialError = require.main.require('lib/api/core/errors/partialError'),
  InternalError = require.main.require('lib/api/core/errors/internalError'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

describe('Test: Prepare database', function () {
  var 
    kuzzle,
    request,
    filesRead,
    indexCreated,
    internalIndexCreated,
    mappingsImported,
    fixturesImported;

  beforeEach(function (done) {
    prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');

    prepareDb.__set__('createInternalStructure', function () { internalIndexCreated = true; return q(); });
    prepareDb.__set__('readFile', (filename) => { filesRead.push(filename); return q(); });
    prepareDb.__set__('createIndexes', function () { indexCreated = true; return q(); });
    prepareDb.__set__('importMapping', function () { mappingsImported = true; return q(); });
    prepareDb.__set__('importFixtures', function () { fixturesImported = true; return q(); });

    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.config = {
          internalIndex: 'foobar'
        };

        kuzzle.services.list = {
          writeEngine: {},
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
        };

        filesRead = [];
        indexCreated = false;
        mappingsImported = false;
        fixturesImported = false;
        internalIndexCreated = false;

        done();
      });
  });

  it('should store fixtures and mappings filename if provided', function (done) {
    kuzzle.isServer = true;
    request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {fixtures: 'fixtures.json', mappings: 'mappings.json'}});

    prepareDb(kuzzle, request)
      .then(() => {
        var files = prepareDb.__get__('files');
        should(files.fixtures).be.eql('fixtures.json');
        should(files.mappings).be.eql('mappings.json');
        done();
      })
      .catch(err => done(err));
  });

  it('should execute the right call chain', function (done) {
    kuzzle.isServer = true;
    request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {}});

    prepareDb(kuzzle, request)
      .then(function () {
        should(filesRead).match(['mappings', 'fixtures']);
        should(indexCreated).be.true();
        should(mappingsImported).be.true();
        should(fixturesImported).be.true();
        should(internalIndexCreated).be.true();
        done();
      })
      .catch(err => done(err));
  });

  it('should do nothing if not in a kuzzle server instance', function (done) {
    kuzzle.isServer = false;
    kuzzle.isWorker = true;
    request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {}});

    prepareDb(kuzzle, request)
      .then(function () {
        should(filesRead).match([]);
        should(indexCreated).be.false();
        should(mappingsImported).be.false();
        should(fixturesImported).be.false();
        should(internalIndexCreated).be.false();
        done();
      })
      .catch(err => done(err));
  });

  describe('#readFile', function () {
    var
      context,
      readFile,
      fileContent = '';

    before(function () {
      prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');
      prepareDb.__set__('fs', {
        readFileSync: function () { return fileContent; }
      });

      readFile = prepareDb.__get__('readFile');
    });

    beforeEach(function () {
      context = {
        kuzzle: {
          pluginsManager: {
            trigger: function () {
            }
          }
        },
        files: {},
        data: {}
      };
    });

    it('should do nothing if the corresponding env variable is not set', function (done) {
      context.data = { foo: 'bar' };
      context.files.foo = null;

      readFile.call(context, 'foo')
        .then(data => {
          should(context.data.foo).be.eql({});
          done();
        })
        .catch(err => done(err));
    });

    it('should return the parsed content of the file', function (done) {
      fileContent = '{"foo": "bar"}';
      context.files.fixtures = 'fixtures';

      readFile.call(context, 'fixtures')
        .then(data => {
          should(context.data).be.an.Object().and.be.eql({fixtures: JSON.parse(fileContent)});
          done();
        })
        .catch(err => done(err));
    });

    it('should return a rejected promise if the file content is not a valid JSON object', function () {
      fileContent = 'not a valid JSON content';
      context.files.fixtures = 'fixtures';
      return should(readFile.call(context, 'fixtures')).be.rejected();
    });
  });

  describe('#createIndexes', function () {
    var
      context,
      createIndexes,
      workerCalled,
      indexCreated,
      indexAdded,
      workerPromise;

    before(function () {
      prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');
      createIndexes = prepareDb.__get__('createIndexes');
    });

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
            add: (rq) => {
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
      prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');
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
            add: (rq) => {
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
      prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');
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
            add: (rq) => {
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

  describe('#createInternalStructure', function () {
    var
      context,
      workerCalled,
      indexAdded,
      requests,
      createInternalStructure,
      params = rc('kuzzle');

    before(function () {
      prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');
      createInternalStructure = prepareDb.__get__('createInternalStructure');
    });

    beforeEach(function () {
      workerCalled = false;
      indexAdded = [];
      requests = [];

      context = {
        defaultRoleDefinition: params.roleWithoutAdmin,
        kuzzle: {
          indexCache: {
            indexes: {

            },
            add: (idx, collection) => {
              should(idx).be.eql(context.kuzzle.config.internalIndex);
              indexAdded.push({index: idx, collection});
            }
          },
          pluginsManager: {
            trigger: function () {
            }
          },
          workerListener: {
            add: (rq) => {
              requests.push(rq);
              workerCalled = true;
              return q();
            }
          },
          config: {
            internalIndex: 'foobar'
          },
          funnel: {
            controllers: {
              security: {
                createOrReplaceRole: (requestObject) => {
                  requests.push(requestObject);
                },
                createOrReplaceProfile: (requestObject) => {
                  requests.push(requestObject);
                }
              }
            }
          }
        }
      };
    });

    it('should create a proper internal structure', function (done) {
      createInternalStructure.call(context)
        .then(function () {
          should(workerCalled).be.true();

          /*
            We expect these 9 request objects, in this order:
              - internal index creation
              - profiles collection mapping
              - users collection mapping
              - users roles
              - users profiles
           */
          should(requests.length).be.eql(10);
          should(indexAdded.length).be.eql(5);

          should(requests[0].controller).be.eql('admin');
          should(requests[0].action).be.eql('createIndex');
          should(requests[0].index).be.eql(context.kuzzle.config.internalIndex);

          should(indexAdded[0].index).be.eql(context.kuzzle.config.internalIndex);
          should(indexAdded[0].collection).be.undefined();


          should(requests[1].controller).be.eql('admin');
          should(requests[1].action).be.eql('updateMapping');
          should(requests[1].index).be.eql(context.kuzzle.config.internalIndex);
          should(requests[1].collection).be.eql('roles');

          should(indexAdded[1].index).be.eql(context.kuzzle.config.internalIndex);
          should(indexAdded[1].collection).be.eql('roles');

          should(requests[2].controller).be.eql('admin');
          should(requests[2].action).be.eql('updateMapping');
          should(requests[2].index).be.eql(context.kuzzle.config.internalIndex);
          should(requests[2].collection).be.eql('profiles');

          should(indexAdded[2].index).be.eql(context.kuzzle.config.internalIndex);
          should(indexAdded[2].collection).be.eql('profiles');

          should(requests[3].controller).be.eql('admin');
          should(requests[3].action).be.eql('updateMapping');
          should(requests[3].index).be.eql(context.kuzzle.config.internalIndex);
          should(requests[3].collection).be.eql('users');

          should(indexAdded[3].index).be.eql(context.kuzzle.config.internalIndex);
          should(indexAdded[3].collection).be.eql('users');

          should(requests[4].controller).be.eql('security');
          should(requests[4].action).be.eql('createOrReplaceRole');

          should(requests[5].controller).be.eql('security');
          should(requests[5].action).be.eql('createOrReplaceRole');

          should(requests[6].controller).be.eql('security');
          should(requests[6].action).be.eql('createOrReplaceRole');

          should(requests[7].controller).be.eql('security');
          should(requests[7].action).be.eql('createOrReplaceProfile');

          should(requests[8].controller).be.eql('security');
          should(requests[8].action).be.eql('createOrReplaceProfile');

          should(requests[9].controller).be.eql('security');
          should(requests[9].action).be.eql('createOrReplaceProfile');

          done();
        })
        .catch(err => done(err));
    });

    it('should not do anything if the index already exists', function (done) {
      context.kuzzle.indexCache.indexes[context.kuzzle.config.internalIndex] = {};
      createInternalStructure.call(context)
        .then(function () {
          should(workerCalled).be.false();
          should(requests.length).be.eql(0);
          should(indexAdded.length).be.eql(0);
          done();
        })
        .catch(err => done(err));
    });
  });
});