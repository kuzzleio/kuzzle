var
  rc = require('rc'),
  params = rc('kuzzle'),
  Promise = require('bluebird'),
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  KuzzleWorker = require.main.require('lib/api/kuzzleWorker'),
  PartialError = require.main.require('kuzzle-common-objects').Errors.partialError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  prepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');

describe('Test: Prepare database', () => {
  var
    kuzzle,
    request,
    filesRead,
    indexCreated,
    internalIndexCreated,
    mappingsImported,
    fixturesImported,
    backupFunctions;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    backupFunctions = {
      createInternalStructure: prepareDb.__get__('createInternalStructure'),
      readFile: prepareDb.__get__('readFile'),
      fs: prepareDb.__get__('fs'),
      createIndexes: prepareDb.__get__('createIndexes'),
      importMapping: prepareDb.__get__('importMapping'),
      importFixtures: prepareDb.__get__('importFixtures')
    };
    prepareDb.__set__('createInternalStructure', function () { internalIndexCreated = true; return Promise.resolve(); });
    prepareDb.__set__('readFile', (filename) => { filesRead.push(filename); return Promise.resolve(); });
    prepareDb.__set__('createIndexes', function () { indexCreated = true; return Promise.resolve(); });
    prepareDb.__set__('importMapping', function () { mappingsImported = true; return Promise.resolve(); });
    prepareDb.__set__('importFixtures', function () { fixturesImported = true; return Promise.resolve(); });

    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.config.internalIndex = 'foobar';

        sandbox.stub(kuzzle.services.list.readEngine, 'listIndexes').resolves({
          data: {
            body: {
              indexes: ['foo', 'bar']
            }
          }
        });

        filesRead = [];
        indexCreated = false;
        mappingsImported = false;
        fixturesImported = false;
        internalIndexCreated = false;
      });
  });

  afterEach(() => {
    sandbox.restore();
    Object.keys(backupFunctions).forEach(item => {
      prepareDb.__set__(item, backupFunctions[item]);
    });
  });

  it('should store fixtures and mappings filename if provided', () => {
    request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {fixtures: 'fixtures.json', mappings: 'mappings.json'}});

    return prepareDb(kuzzle, request)
      .then(() => {
        var files = prepareDb.__get__('files');
        should(files.fixtures).be.eql('fixtures.json');
        should(files.mappings).be.eql('mappings.json');
      });
  });

  it('should execute the right call chain', () => {
    request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {}});

    return prepareDb(kuzzle, request)
      .then(() => {
        should(filesRead).match(['mappings', 'fixtures']);
        should(indexCreated).be.true();
        should(mappingsImported).be.true();
        should(fixturesImported).be.true();
        should(internalIndexCreated).be.true();
      });
  });

  it('should do nothing if not in a kuzzle server instance', () => {
    var kuzzleWorker = new KuzzleWorker();
    request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {}});

    return prepareDb(kuzzleWorker, request)
      .then(() => {
        should(filesRead).match([]);
        should(indexCreated).be.false();
        should(mappingsImported).be.false();
        should(fixturesImported).be.false();
        should(internalIndexCreated).be.false();
      });
  });

  describe('#readFile', () => {
    var
      context,
      readFile,
      fileContent = '';

    beforeEach(() => {
      prepareDb.__set__('fs', {
        readFileSync: () => { return fileContent; }
      });

      prepareDb.__set__('readFile', backupFunctions.readFile);
      readFile = prepareDb.__get__('readFile');
      context = {
        kuzzle: {
          pluginsManager: {
            trigger: () => Promise.resolve({})
          }
        },
        files: {},
        data: {}
      };
    });

    it('should do nothing if the corresponding env variable is not set', () => {
      context.data = { foo: 'bar' };
      context.files.foo = null;

      return readFile.call(context, 'foo')
        .then(() => {
          should(context.data.foo).be.eql({});
        });
    });

    it('should return the parsed content of the file', () => {
      fileContent = '{"foo": "bar"}';
      context.files.fixtures = 'fixtures';

      return readFile.call(context, 'fixtures')
        .then(() => {
          should(context.data).be.an.Object().and.be.eql({fixtures: JSON.parse(fileContent)});
        });
    });

    it('should return a rejected promise if the file content is not a valid JSON object', () => {
      fileContent = 'not a valid JSON content';
      context.files.fixtures = 'fixtures';
      return should(readFile.call(context, 'fixtures')).be.rejected();
    });
  });

  describe('#createIndexes', () => {
    var
      context,
      createIndexes,
      workerCalled,
      indexAdded,
      workerPromise;

    before(() => {
      createIndexes = prepareDb.__get__('createIndexes');
    });

    beforeEach(() => {
      workerCalled = false;
      workerPromise = Promise.resolve();
      indexCreated = [];
      indexAdded = false;

      context = {
        kuzzle: {
          pluginsManager: {
            trigger: (event, data) => Promise.resolve(data)
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
            add: () => {indexAdded = true;}
          }
        },
        data: {
          fixtures: {},
          mappings: {}
        }
      };
    });

    it('should do nothing if there is no data mapping and no data fixtures', () => {
      return createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.false();
          should(indexAdded).be.false();
        });
    });

    it('should call workers correctly to create data mappings indexes', () => {
      context.data.mappings = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      return createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexAdded).be.true();
          should(indexCreated.length).be.eql(Object.keys(context.data.mappings).length);
          should(indexCreated.sort()).match(Object.keys(context.data.mappings).sort());
        });
    });

    it('should call workers correctly to create data fixtures indexes', () => {
      context.data.fixtures = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      return createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexAdded).be.true();
          should(indexCreated.length).be.eql(Object.keys(context.data.fixtures).length);
          should(indexCreated.sort()).match(Object.keys(context.data.fixtures).sort());
        });
    });

    it('should not try to create index that already exists', () => {
      context.data.mappings = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      context.kuzzle.indexCache.indexes = { foo: ['foo'], bar: ['bar']};

      return createIndexes.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(indexAdded).be.true();
          should(indexCreated.length).be.eql(1);
          should(indexCreated).match(['qux']);
        });
    });

    it('should return a rejected promise if an index creation fails', () => {
      workerPromise = Promise.reject(new Error('failed'));
      context.data.mappings = {
        'foo': 'foo',
        'bar': 'bar',
        'qux': 'qux'
      };

      return should(createIndexes.call(context)).be.rejectedWith(InternalError);
    });
  });

  describe('#importMapping', () => {
    var
      context,
      stubIndex = 'index',
      stubCollection = 'collection',
      importMapping,
      workerCalled,
      mappingCreated,
      workerPromise;

    before(() => {
      importMapping = prepareDb.__get__('importMapping');
    });

    beforeEach(() => {
      workerCalled = false;
      workerPromise = Promise.resolve();
      mappingCreated = null;

      context = {
        kuzzle: {
          pluginsManager: {
            trigger: (event, data) => Promise.resolve(data)
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

    it('should do nothing if there is no mapping to import', () => {
      context.data.mappings = {};

      return importMapping.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.false();
        });
    });

    it('should return a rejected promise if the mapping file is not properly formatted', () => {
      context.data.mappings.index.collection = { foo: 'bar' };
      return should(importMapping.call(context)).be.rejectedWith(InternalError);
    });

    it('should call the write worker with the right arguments to import mappings', () => {
      importMapping.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(mappingCreated).be.eql(context.data.mappings.index.collection);
        });
    });

    it('should return a rejected promise if the mapping creation fails', () => {
      workerPromise = Promise.reject(new Error('rejected'));
      return should(importMapping.call(context)).be.rejectedWith(InternalError);
    });
  });

  describe('#importFixtures', () => {
    var
      context,
      stubIndex = 'index',
      stubCollection = 'collection',
      importFixtures,
      workerCalled,
      workerPromise;

    before(() => {
      importFixtures = prepareDb.__get__('importFixtures');
    });

    beforeEach(() => {
      workerCalled = false;
      workerPromise = Promise.resolve();
      fixturesImported = null;

      context = {
        kuzzle: {
          pluginsManager: {
            trigger: (event, data) => Promise.resolve(data)
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

    it('should do nothing if there is no fixtures to import', () => {
      context.data.fixtures = {};
      return importFixtures.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.false();
        });
    });

    it('should call the write worker with the right request object', () => {
      return importFixtures.call(context)
        .then(data => {
          should(data).be.undefined();
          should(workerCalled).be.true();
          should(fixturesImported).be.eql(context.data.fixtures.index.collection);
        });
    });

    it('should return a rejected promise if a fixture import fails', () => {
      workerPromise = Promise.reject(new Error('rejected'));
      return should(importFixtures.call(context)).be.rejectedWith(InternalError);
    });

    it('should filter errors when they are about documents that already exist', () => {
      workerPromise = Promise.reject(new PartialError('rejected', [{status: 409}]));
      return should(importFixtures.call(context)).be.fulfilled();
    });
  });

  describe('#createInternalStructure', () => {
    var
      context,
      workerCalled,
      indexAdded,
      requests,
      createInternalStructure,
      roleWithoutAdmin = rc('kuzzle').roleWithoutAdmin;

    before(() => {
      createInternalStructure = prepareDb.__get__('createInternalStructure');
    });

    beforeEach(() => {
      workerCalled = false;
      indexAdded = [];
      requests = [];

      context = {
        defaultRoleDefinition: roleWithoutAdmin,
        kuzzle: {
          indexCache: {
            indexes: {}
          },
          pluginsManager: {
            trigger: (event, data) => Promise.resolve(data)
          },
          workerListener: {
            add: (rq) => {
              requests.push(rq);
              workerCalled = true;
              return Promise.resolve();
            }
          },
          config: {
            internalIndex: 'foobar'
          },
          funnel: {
            controllers: {
              security: {
                createOrReplaceRole: requestObject => {
                  requests.push(requestObject);
                },
                createOrReplaceProfile: requestObject => {
                  requests.push(requestObject);
                }
              }
            }
          }
        }
      };

      context.kuzzle.indexCache.add = (idx, collection) => {
        should(idx).be.eql(context.kuzzle.config.internalIndex);
        indexAdded.push({index: idx, collection});

        if (!context.kuzzle.indexCache.indexes[idx]) {
          context.kuzzle.indexCache.indexes[idx] = [];
        }
        context.kuzzle.indexCache.indexes[idx].push(collection);
      };
    });

    it('should create a proper internal structure', () => {
      return createInternalStructure.call(context)
        .then(() => {
          should(workerCalled).be.true();

          /*
            We expect these 9 request objects, in this order:
              - internal index creation
              - roles creation
              - profiles creation
              - users creation
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

          should(requests[2].controller).be.eql('security');
          should(requests[2].action).be.eql('createOrReplaceRole');

          should(requests[3].controller).be.eql('security');
          should(requests[3].action).be.eql('createOrReplaceRole');

          should(requests[4].controller).be.eql('security');
          should(requests[4].action).be.eql('createOrReplaceRole');

          should(requests[5].controller).be.eql('admin');
          should(requests[5].action).be.eql('updateMapping');
          should(requests[5].index).be.eql(context.kuzzle.config.internalIndex);
          should(requests[5].collection).be.eql('profiles');
          should(indexAdded[3].index).be.eql(context.kuzzle.config.internalIndex);
          should(indexAdded[3].collection).be.eql('profiles');

          should(requests[6].controller).be.eql('security');
          should(requests[6].action).be.eql('createOrReplaceProfile');

          should(requests[7].controller).be.eql('security');
          should(requests[7].action).be.eql('createOrReplaceProfile');

          should(requests[8].controller).be.eql('security');
          should(requests[8].action).be.eql('createOrReplaceProfile');

          should(requests[9].controller).be.eql('admin');
          should(requests[9].action).be.eql('updateMapping');
          should(requests[9].index).be.eql(context.kuzzle.config.internalIndex);
          should(requests[9].collection).be.eql('users');
          should(indexAdded[4].index).be.eql(context.kuzzle.config.internalIndex);
          should(indexAdded[4].collection).be.eql('users');

        });
    });

    it('should not do anything if the index already exists', () => {
      context.kuzzle.indexCache.indexes[context.kuzzle.config.internalIndex] = ['roles', 'profiles', 'users'];
      return createInternalStructure.call(context)
        .then(() => {
          should(workerCalled).be.false();
          should(requests.length).be.eql(0);
          should(indexAdded.length).be.eql(0);
        });
    });
  });
});