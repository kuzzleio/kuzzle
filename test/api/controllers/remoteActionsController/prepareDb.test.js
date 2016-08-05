var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  PartialError = require('kuzzle-common-objects').Errors.partialError,
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  PrepareDb = rewire('../../../../lib/api/controllers/remoteActions/prepareDb');

describe('Test: Prepare database', () => {
  var
    kuzzle;

  beforeEach(() => {
    kuzzle = {
      funnel: {
        controllers: {
          admin: {
            createIndex: sandbox.stub().resolves(new ResponseObject()),
            updateMapping: sandbox.stub().resolves(new ResponseObject())
          },
          bulk: {
            import: sandbox.stub().resolves(new ResponseObject())
          }
        }
      },
      indexCache: {
        add: sandbox.spy(),
        indexes: {}
      },
      internalEngine: {
        index: 'testIndex',
        createIndex: sandbox.stub().resolves(),
        createInternalIndex: sandbox.stub().resolves(),
        createOrReplace: sandbox.stub().resolves(),
        updateMapping: sandbox.stub().resolves()
      },
      isServer: true,
      pluginsManager: {
        trigger: sandbox.spy()
      },
      rawParams: {
        roleWithoutAdmin: {
          foo: 'bar'
        }
      }
    };

    PrepareDb.__set__({
      _data: {
        fixtures: {},
        mappings: {}
      },
      _files: {
        fixtures: null,
        mappings: null
      }
    });

    PrepareDb(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#prepareDb', () => {
    var
      prepareDb = PrepareDb.__get__('prepareDb'),
      createInternalStructureStub,
      readFileStub,
      createIndexesStub,
      importMappingStub,
      importFixturesStub,
      reset;

    beforeEach(() => {
      reset = PrepareDb.__set__({
        createInternalStructure: sandbox.stub().resolves(),
        readFile: sandbox.stub().resolves(),
        createIndexes: sandbox.stub().resolves(),
        importMapping: sandbox.stub().resolves(),
        importFixtures: sandbox.stub().resolves()
      });

      createInternalStructureStub = PrepareDb.__get__('createInternalStructure');
      readFileStub = PrepareDb.__get__('readFile');
      createIndexesStub = PrepareDb.__get__('createIndexes');
      importMappingStub = PrepareDb.__get__('importMapping');
      importFixturesStub = PrepareDb.__get__('importFixtures');
    });

    afterEach(() => {
      reset();
    });

    it('should store fixtures and mappings filename if provided', () => {
      var request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {fixtures: 'fixtures.json', mappings: 'mappings.json'}});

      return prepareDb(request)
        .then(() => {
          var files = PrepareDb.__get__('_files');
          should(files.fixtures).be.eql('fixtures.json');
          should(files.mappings).be.eql('mappings.json');
        });
    });

    it('should execute the right call chain', () => {
      var request = new RequestObject({controller: 'remoteActions', action: 'prepareDb', body: {}});

      return prepareDb(request)
        .then(() => {
          should(createInternalStructureStub).be.calledOnce();
          should(readFileStub).be.calledTwice();
          should(createIndexesStub).be.calledOnce();
          should(importMappingStub).be.calledOnce();
          should(importFixturesStub).be.calledOnce();
        });
    });

    it('should reject the promise if something goes wrong', () => {
      var
        error = new Error('test'),
        request = new RequestObject({});

      return PrepareDb.__with__({
        createInternalStructure: sandbox.stub().rejects(error)
      })(() => {
        return should(prepareDb(request)).be.rejectedWith('test');
      });
    });

  });

  describe('#readFile', () => {
    var
      readFile = PrepareDb.__get__('readFile'),
      reset,
      readFileSyncStub;

    beforeEach(() => {
      reset = PrepareDb.__set__({
        fs: {
          readFileSync: sandbox.stub()
        }
      });

      readFileSyncStub = PrepareDb.__get__('fs').readFileSync;
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if the corresponding env variable is not set', () => {
      return PrepareDb.__with__({
        _data: {foo: 'bar'},
        _files: {foo: null}
      })(() => {
        return readFile('foo')
          .then(() => {
            should(kuzzle.pluginsManager.trigger).be.calledOnce();
            should(kuzzle.pluginsManager.trigger).be.calledWithExactly('log:info', '== No default foo file specified in env vars: continue.');
            should(PrepareDb.__get__('_data').foo).be.eql({});
          });
      });
    });

    it('should return the parsed content of the file', () => {
      readFileSyncStub.returns('{"foo": "bar"}');

      return PrepareDb.__with__({
        _files: {fixtures: 'fixtures'}
      })(() => {
        return readFile('fixtures')
          .then(() => {
            var data = PrepareDb.__get__('_data');

            should(data).be.eql({
              fixtures: {foo: 'bar'},
              mappings: {}
            });
          });
      });
    });

    it('should return a rejected promise if the file content is not a valid JSON object', () => {
      readFileSyncStub.returns('Invalid JSON');

      return PrepareDb.__with__({
        _files: {fixtures: 'fixtures'}
      })(() => {
        return should(readFile('fixtures'))
          .be.rejectedWith('Error while loading the file fixtures');
      });
    });

  });

  describe('#createIndexes', () => {
    var
      createIndexes = PrepareDb.__get__('createIndexes');

    it('should do nothing if there is no data mapping and no data fixtures', () => {
      return createIndexes()
        .then(() => {
          should(kuzzle.internalEngine.createIndex).have.callCount(0);
        });
    });

    it('should create indexes', () => {
      return PrepareDb.__with__({
        _data: {
          mappings: {
            foo: 'foo',
            bar: 'bar'
          },
          fixtures: {
            baz: 'baz'
          }
        }
      })(() => {
        return createIndexes()
          .then(() => {
            var createIndex = kuzzle.funnel.controllers.admin.createIndex;
            should(createIndex).be.calledThrice();
            should(createIndex.firstCall.args[0]).match({
              index: 'foo',
              controller: 'admin',
              action: 'createIndex'
            });
            should(createIndex.secondCall.args[0]).match({
              index: 'bar',
              controller: 'admin',
              action: 'createIndex'
            });
            should(createIndex.thirdCall.args[0]).match({
              index: 'baz',
              controller: 'admin',
              action: 'createIndex'
            });
          });
      });
    });

    it('should not try to create index that already exists', () => {
      kuzzle.indexCache.indexes.bar = true;

      return PrepareDb.__with__({
        _data: {
          mappings: {
            foo: 'foo',
            bar: 'bar'
          },
          fixtures: {
            baz: 'baz'
          }
        }
      })(() => {
        return createIndexes()
          .then(() => {
            var createIndex = kuzzle.funnel.controllers.admin.createIndex;

            should(createIndex).be.calledTwice();
            should(createIndex.firstCall.args[0]).match({
              index: 'foo',
              controller: 'admin',
              action: 'createIndex'
            });
            should(createIndex.secondCall.args[0]).match({
              index: 'baz',
              controller: 'admin',
              action: 'createIndex'
            });
          });
      });
    });

    it('should return a rejected promise if an index creation fails', () => {
      var error = new Error('test');

      kuzzle.funnel.controllers.admin.createIndex.rejects(error);

      return PrepareDb.__with__({
        _data: {
          fixtures: {
            foo: 'foo'
          },
          mappings: {}
        }
      })(() => {
        return should(createIndexes())
          .be.rejectedWith(InternalError);
      });
    });
  });

  describe('#importMapping', () => {
    var
      importMapping = PrepareDb.__get__('importMapping'),
      reset;

    beforeEach(() => {
      reset = PrepareDb.__set__({
        _data: {
          fixtures: {},
          mappings: {
            index: {
              collection: {
                properties: {
                  foo: {type: 'string'}
                }
              }
            }
          }
        }
      });
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if there is no mapping to import', () => {
      return PrepareDb.__with__({
        _data: {
          fixtures: {},
          mappings: {}
        }
      })(() => {
        return importMapping()
          .then(() => {
            should(kuzzle.funnel.controllers.admin.updateMapping).have.callCount(0);
          });
      });
    });

    it('should return a rejected promise if the mapping file is not properly formatted', () => {
      return PrepareDb.__with__({
        _data: {
          fixtures: {},
          mappings: {foo: 'bar'}
        }
      })(() => {
        return should(importMapping()).be.rejectedWith(InternalError);
      });
    });

    it('should call the write worker with the right arguments to import mappings', () => {
      return importMapping()
        .then(() => {
          var updateMapping = kuzzle.funnel.controllers.admin.updateMapping;

          should(updateMapping).be.calledOnce();
          should(updateMapping.firstCall.args[0]).match({
            controller: 'admin',
            action: 'updateMapping',
            index: 'index',
            collection: 'collection',
            data: {
              body: {
                properties: {
                  foo: {
                    type: 'string'
                  }
                }
              }
            }
          });
        });
    });

    it('should return a rejected promise if the mapping creation fails', () => {
      var error = new Error(error);

      kuzzle.funnel.controllers.admin.updateMapping.rejects(error);
    });
  });

  describe('#importFixtures', () => {
    var
      importFixtures = PrepareDb.__get__('importFixtures'),
      reset;

    beforeEach(() => {
      reset = PrepareDb.__set__({
        _data: {
          fixtures: {
            index: {
              collection: {
                foo: 'bar'
              }
            }
          }
        }
      });
    });

    afterEach(() => {
      reset();
    });

    it('should do nothing if there is no fixtures to import', () => {
      return PrepareDb.__with__({
        _data: {
          fixtures: {}
        }
      })(() => {
        return importFixtures()
          .then(() => {
            should(kuzzle.funnel.controllers.bulk.import).have.callCount(0);
          });

      });
    });

    it('should call the write worker with the right request object', () => {
      return importFixtures()
        .then(() => {
          var importAction = kuzzle.funnel.controllers.bulk.import;

          should(importAction).be.calledOnce();
          should(importAction.firstCall.args[0]).match({
            controller: 'bulk',
            action: 'import',
            index: 'index',
            collection: 'collection',
            data: {
              body: {
                foo: 'bar'
              }
            }
          });
        });
    });

    it('should return a rejected promise if a fixture import fails', () => {
      var error = new Error('test');

      kuzzle.funnel.controllers.bulk.import.rejects(error);

      return should(importFixtures()).be.rejectedWith(error);
    });

    it('should return a rejected promise if the controller returned an error', () => {
      var response = new ResponseObject({}, new InternalError('test'));

      kuzzle.funnel.controllers.bulk.import.resolves(response);

      return should(importFixtures()).be.rejectedWith(response.error);
    });

    it('should return a rejected promise if a partial error containing serious errors was raised', () => {
      var response = new ResponseObject({}, new PartialError('test', [
        {status: 409},
        {status: 500}
      ]));

      kuzzle.funnel.controllers.bulk.import.resolves(response);

      return should(importFixtures()).be.rejectedWith(PartialError);
    });

    it('should filter errors when they are about documents that already exist', () => {
      var response = new ResponseObject({}, new PartialError('test', [
        {status: 409},
        {status: 409}
      ]));

      kuzzle.funnel.controllers.bulk.import.resolves(response);

      return should(importFixtures()).be.fulfilled();
    });
  });

  describe('#createInternalStructure', () => {
    var
      createInternalStructure = PrepareDb.__get__('createInternalStructure'),
      reset,
      createInternalIndexStub,
      createRolleCollectionStub,
      createProfileCollecitonStub,
      createUserCollectionStub;

    beforeEach(() => {
      reset = PrepareDb.__set__({
        createInternalIndex: sandbox.stub().resolves(),
        createRoleCollection: sandbox.stub().resolves(),
        createProfileCollection: sandbox.stub().resolves(),
        createUserCollection: sandbox.stub().resolves()
      });

      createInternalIndexStub = PrepareDb.__get__('createInternalIndex');
      createRolleCollectionStub = PrepareDb.__get__('createRoleCollection');
      createProfileCollecitonStub = PrepareDb.__get__('createProfileCollection');
      createUserCollectionStub = PrepareDb.__get__('createUserCollection');
    });

    afterEach(() => {
      reset();
    });

    it('should create a proper internal structure', () => {
      return createInternalStructure()
        .then(() => {
          should(createInternalIndexStub).be.calledOnce();
          should(createRolleCollectionStub).be.calledOnce();
          should(createProfileCollecitonStub).be.calledOnce();
          should(createUserCollectionStub).be.calledOnce();
        });
    });

  });

  describe('#createInternalIndex', () => {
    var
      createInternalIndex = PrepareDb.__get__('createInternalIndex');

    it('should do nothing if the index already exists', () => {
      kuzzle.indexCache.indexes.testIndex = true;

      return createInternalIndex()
        .then(() => {
          should(kuzzle.internalEngine.createInternalIndex).have.callCount(0);
        });
    });

    it('should create the index and populate the index cache', () => {
      return createInternalIndex()
        .then(() => {
          should(kuzzle.internalEngine.createInternalIndex).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWithExactly('testIndex');
        });
    });

  });

  describe('#createRoleCollection', () => {
    var
      role = 'role',
      createRoleCollection = PrepareDb.__get__('createRoleCollection');

    it('should do nothing if the roles collection already exists', () => {
      kuzzle.indexCache.indexes.testIndex = ['roles'];

      return createRoleCollection(role)
        .then(() => {
          should(kuzzle.internalEngine.createOrReplace).have.callCount(0);
        });
    });

    it('should create the roles collection and the default roles', () => {
      kuzzle.indexCache.indexes = {testIndex: []};

      return createRoleCollection(role)
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('roles', {
            properties: {
              controllers: {
                enabled: false
              }
            }
          });
          should(kuzzle.internalEngine.createOrReplace).be.calledThrice();
          should(kuzzle.internalEngine.createOrReplace.firstCall).be.calledWithExactly('roles', 'anonymous', role);
          should(kuzzle.internalEngine.createOrReplace.secondCall).be.calledWithExactly('roles', 'default', role);
          should(kuzzle.internalEngine.createOrReplace.thirdCall).be.calledWithExactly('roles', 'admin', role);
        });
    });

  });

  describe('#createProfileCollection', () => {
    var
      createProfileCollection = PrepareDb.__get__('createProfileCollection');

    it('should do nothing if the collection already exists', () => {
      kuzzle.indexCache.indexes.testIndex = ['profiles'];

      return createProfileCollection()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).have.callCount(0);
          should(kuzzle.internalEngine.createOrReplace).have.callCount(0);
        });

    });

    it('should create the mapping, update the index cache and set the default profiles', () => {
      kuzzle.indexCache.indexes.testIndex = [];

      return createProfileCollection()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('profiles', {
            properties: {
              policies: {
                properties: {
                  _id: {
                    index: 'not_analyzed',
                    type: 'string'
                  }
                }
              }
            }
          });
          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWithExactly(kuzzle.internalEngine.index, 'profiles');
          should(kuzzle.internalEngine.createOrReplace).be.calledThrice();
          should(kuzzle.internalEngine.createOrReplace.firstCall).be.calledWith('profiles', 'default', {
            policies: [{roleId: 'default', allowInternalIndex: true}]
          });
          should(kuzzle.internalEngine.createOrReplace.secondCall).be.calledWith('profiles', 'anonymous', {
            policies: [{roleId: 'anonymous', allowInternalIndex: true}]
          });
          should(kuzzle.internalEngine.createOrReplace.thirdCall).be.calledWith('profiles', 'admin', {
            policies: [{roleId: 'admin', allowInternalIndex: true}]
          });
        });
    });

  });

  describe('#createUserCollection', () => {
    var
      createUserCollection = PrepareDb.__get__('createUserCollection');

    it('should do nothing if the mapping is already set', () => {
      kuzzle.indexCache.indexes.testIndex = ['users'];

      return createUserCollection()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).have.callCount(0);
          should(kuzzle.internalEngine.createOrReplace).have.callCount(0);
        });
    });

    it('should create the mapping and update the index cache', () => {
      kuzzle.indexCache.indexes.testIndex = [];

      return createUserCollection()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('users', {
            properties: {
              profileId: {
                index: 'not_analyzed',
                type: 'string'
              },
              password: {
                index: 'no',
                type: 'string'
              }
            }
          });
          should(kuzzle.indexCache.add).be.calledOnce();
          should(kuzzle.indexCache.add).be.calledWithExactly(kuzzle.internalEngine.index, 'users');
        });
    });


  });

});
