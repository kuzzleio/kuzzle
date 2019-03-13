const
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  IndexCache = require.main.require('lib/api/core/indexCache');

describe('Test: core/indexCache', () => {
  var
    listAliasesStub,
    listIndexesStub,
    listCollectionsStub,
    getMappingStub,
    indexCache,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    const internalMapping = {
      properties: {
        foo: {
          mappings: {
            bar: 'first',
            baz: 'second',
            qux: 'third'
          }
        }
      }
    };

    listAliasesStub = kuzzle.internalEngine.listAliases.resolves({alias: 'foo', alias2: 'foo'});
    listIndexesStub = kuzzle.internalEngine.listIndexes.resolves(['foo']);
    listCollectionsStub = kuzzle.internalEngine.listCollections.resolves(['bar', 'baz', 'qux']);
    getMappingStub = kuzzle.internalEngine.getMapping.resolves(internalMapping);
    kuzzle.internalEngine.getFieldMapping.resolves({});
    indexCache = new IndexCache(kuzzle);
  });

  describe('#init', () => {
    it.only('should initialize the index cache properly', () => {
      kuzzle.internalEngine.getFieldMapping.resolves({});

      return indexCache.init()
        .then(() => {
          should(listAliasesStub).be.calledOnce();
          should(listIndexesStub).be.calledOnce();
          should(listCollectionsStub).be.calledOnce();
          should(indexCache.indexes).be.an.Object().and.have.keys('alias', 'alias2', 'foo');
          should(indexCache.indexes.foo).be.an.Array().and.match(['bar', 'baz', 'qux']);
          should(indexCache.indexes.alias).be.exactly(indexCache.indexes.foo);
          should(indexCache.indexes.alias2).be.exactly(indexCache.indexes.foo);
        });
    });

    it('should inject the default mapping if none found', () => {
      return indexCache.init()
        .then(() => {
          should(kuzzle.internalEngine.updateMapping)
            .be.calledThrice();

          should(indexCache.defaultMappings.foo)
            .eql(indexCache.commonMapping);
        });
    });

    it('should re-inject the existing mapping if one found', () => {
      kuzzle.internalEngine.getFieldMapping
        .resolves({
          foo: {
            mappings: {
              baz: {
                '_kuzzle_info.updater': {
                  mapping: {
                    some: 'mapping'
                  }
                }
              }
            }
          }
        });

      return indexCache.init()
        .then(() => {
          should(indexCache.defaultMappings.foo).eql({
            _kuzzle_info: {
              properties: Object.assign({}, indexCache.commonMapping._kuzzle_info.properties, {some: 'mapping'})
            }
          });

          for (const collection of ['bar', 'baz', 'qux']) {
            should(kuzzle.internalEngine.updateMapping)
              .be.calledWithMatch(collection, {
                properties: {
                  _kuzzle_info: {
                    properties: {
                      some: 'mapping'
                    }
                  }
                }
              });
          }
        });
    });

    it('should inject kuzzle_info mapping for known fields only', () => {
      kuzzle.internalEngine.getFieldMapping
        .resolves({
          foo: {
            mappings: {
              baz: {
                '_kuzzle_info.unknown': {
                  mapping: {
                    some: 'mapping'
                  }
                }
              }
            }
          }
        });

      return indexCache.init()
        .then(() => {
          should(indexCache.defaultMappings.foo).eql(indexCache.commonMapping);

          for (const collection of ['bar', 'baz', 'qux']) {
            should(kuzzle.internalEngine.updateMapping)
              .be.calledWithMatch(collection, {
                properties: indexCache.commonMapping
              });
          }
        });
    });

  });

  describe('#initInternal', () => {
    it('should initialize the internal index cache properly', () => {
      return indexCache.initInternal(kuzzle.internalEngine)
        .then(() => {
          should(getMappingStub.calledOnce).be.true();
          should(indexCache.indexes).be.an.Object().and.have.keys('foo');
          should(indexCache.indexes.foo).be.an.Array().and.match(['bar', 'baz', 'qux']);
        });
    });
  });

  describe('#add', () => {
    it('should add a single index to the index cache', () => {
      indexCache.add('foobar');
      should(indexCache.indexes).have.keys('foobar');
      should(indexCache.indexes.foobar).be.an.Array().and.be.empty();
    });

    it('should add a new collection to the index cache', () => {
      indexCache.add('index', 'collection');
      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection']);
    });

    it('should not add a collection if it is already in cache', () => {
      indexCache.add('index', 'collection');
      indexCache.add('index', 'collection');

      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection']);
    });

    it('should do nothing if no index is provided', () => {
      indexCache.add();
      should(indexCache.indexes).be.empty();
    });
  });

  describe('#remove', () => {
    it('should remove an index from the cache', () => {
      indexCache.add('index', 'collection');
      indexCache.remove('index');
      should(indexCache.indexes).be.empty();
    });

    it('should remove a single collection from the cache', () => {
      indexCache.add('index', 'collection1');
      indexCache.add('index', 'collection2');
      indexCache.remove('index', 'collection1');
      should(indexCache.indexes).have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.match(['collection2']);
    });

    it('should do nothing if the index does not exist', () => {
      indexCache.add('index', 'collection');
      indexCache.remove('foo');
      should(indexCache.indexes).match({index: ['collection']});
    });

    it('should do nothing if the collection does not exist', () => {
      indexCache.add('index', 'collection');
      indexCache.remove('index', 'foo');
      should(indexCache.indexes).match({index: ['collection']});
    });
  });

  describe('#reset', () => {
    it('should empty the index cache if invoked with no argument', () => {
      indexCache.add('index1', 'collection');
      indexCache.add('index2', 'collection');
      indexCache.reset();
      should(indexCache.indexes).be.an.Object().and.be.empty();
    });

    it('should remove all collections of an index', () => {
      indexCache.add('index', 'collection1');
      indexCache.add('index', 'collection2');
      indexCache.reset('index');
      should(indexCache.indexes).be.an.Object().and.have.keys('index');
      should(indexCache.indexes.index).be.an.Array().and.be.empty();
    });
  });

  describe('#exists', () => {
    it('should resolve with true if the index exists in Kuzzle', done => {
      indexCache.add('index1');

      indexCache.exists('index1')
        .then(result => {
          should(result).be.true();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with true if the collection exists in Kuzzle', done => {
      indexCache.add('index1', 'collection1');

      indexCache.exists('index1', 'collection1')
        .then(result => {
          should(result).be.true();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with true and update the cache if the index exists in ES but not in Kuzzle', done => {
      kuzzle.services.list.storageEngine.indexExists.resolves(true);

      indexCache.exists('index1')
        .then(result => {
          should(result).be.true();
          should(indexCache.indexes).have.keys('index1');
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with true and update the cache and apply mapping if the collection exists in ES but not in Kuzzle', done => {
      kuzzle.services.list.storageEngine.collectionExists.resolves(true);
      kuzzle.internalEngine.updateMapping.reset();
      kuzzle.internalEngine.updateMapping.resolves();
      indexCache.add('index1');

      indexCache.exists('index1', 'collection1')
        .then(result => {
          should(result).be.true();
          should(indexCache.indexes.index1).be.eql(['collection1']);
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with false if the index does not exists in ES', done => {
      kuzzle.services.list.storageEngine.indexExists.resolves(false);

      indexCache.exists('index1')
        .then(result => {
          should(result).be.false();
          done();
        })
        .catch(error => done(error));
    });

    it('should resolve with false if the collection does not exists in ES', done => {
      kuzzle.services.list.storageEngine.collectionExists.resolves(false);
      indexCache.add('index1');

      indexCache.exists('index1', 'collection1')
        .then(result => {
          should(result).be.false();
          done();
        })
        .catch(error => done(error));
    });

    it('should not send a request to elastic with hotReload to false', done => {
      kuzzle.services.list.storageEngine.indexExists.reset();
      kuzzle.services.list.storageEngine.collectionExists.reset();

      indexCache.exists('index1', undefined, false)
        .then(result => {
          should(result).be.false();
          should(kuzzle.services.list.storageEngine.indexExists).not.be.called();
          should(kuzzle.services.list.storageEngine.collectionExists).not.be.called();
          done();
        })
        .catch(error => done(error));
    });

    it('should propagate other errors', () => {
      const serviceUnavailableError = new ServiceUnavailableError();
      kuzzle.services.list.storageEngine.indexExists.rejects(serviceUnavailableError);

      return should(indexCache.exists('index1')).be.rejectedWith(serviceUnavailableError);
    });
  });
});
