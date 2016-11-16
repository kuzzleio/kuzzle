var
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Bootstrap = rewire('../../../lib/services/internalEngine/bootstrap');

describe('services/internalEngine/bootstrap.js', () => {
  var
    kuzzle,
    bootstrap;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    Bootstrap.__set__({
      console: {error: sinon.spy()}
    });

    bootstrap = new Bootstrap(kuzzle);
  });

  describe('#constructor', () => {
    it('should set the engine to kuzzle internal engine', () => {
      should(bootstrap.engine).be.exactly(kuzzle.internalEngine);
    });
  });

  describe('#all', () => {
    it('should call the proper submethods in proper order', () => {
      sinon.stub(bootstrap, 'createCollections').resolves();

      return bootstrap.all()
        .then(() => {

          try {
            should(bootstrap.engine.createInternalIndex)
              .be.calledOnce();

            should(bootstrap.createCollections)
              .be.calledOnce();

            should(bootstrap.engine.refresh)
              .be.calledOnce();

            should(kuzzle.indexCache.add)
              .be.calledOnce()
              .be.calledWithExactly(bootstrap.engine.index);

            sinon.assert.callOrder(
              bootstrap.engine.createInternalIndex,
              bootstrap.createCollections,
              bootstrap.engine.refresh,
              kuzzle.indexCache.add
            );

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should print errors to the console', done => {
      var
        error = new Error('error message');

      bootstrap.engine.createInternalIndex.rejects(error);

      bootstrap.all()
        .catch(err => {
          var
            spy = Bootstrap.__get__('console.error');

          should(err).be.exactly(error);

          should(spy)
            .be.calledOnce()
            .be.calledWithExactly(error, error.stack);

          done();
        });

    });
  });

  describe('#createCollections', () => {
    it('should call proper sub methods in proper order', () => {
      [
        'createPluginsCollection',
        'createRolesCollection',
        'createProfilesCollection',
        'createUsersCollection'
      ].forEach(m => sinon.stub(bootstrap, m).resolves());

      return bootstrap.createCollections()
        .then(() => {
          try {
            should(bootstrap.createPluginsCollection)
              .be.calledOnce();
            should(bootstrap.createRolesCollection)
              .be.calledOnce();
            should(bootstrap.createProfilesCollection)
              .be.calledOnce();
            should(bootstrap.createUsersCollection)
              .be.calledOnce();

            sinon.assert.callOrder(
              bootstrap.createPluginsCollection,
              bootstrap.createRolesCollection,
              bootstrap.createProfilesCollection,
              bootstrap.createUsersCollection
            );

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#createRolesCollection', () => {
    it('should create mapping and add default roles', () => {
      return bootstrap.createRolesCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('roles', {
                properties: {
                  controllers: { enabled: false }
                }
              });

            should(bootstrap.engine.createOrReplace)
              .be.calledThrice();
            should(bootstrap.engine.createOrReplace)
              .be.calledWithExactly('roles', 'admin', kuzzle.config.security.default.role)
              .be.calledWithExactly('roles', 'default', kuzzle.config.security.default.role)
              .be.calledWithExactly('roles', 'anonymous', kuzzle.config.security.default.role);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should do nothing if the collection already exists', () => {
      kuzzle.indexCache.exists.returns(true);

      return bootstrap.createRolesCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .have.callCount(0);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#createPluginsCollection', () => {
    it('should create the mapping', () => {
      return bootstrap.createPluginsCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('plugins', {
                properties: {
                  config: {enabled: false}
                }
              });

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should do nothing if the collection exists', () => {
      kuzzle.indexCache.exists.returns(true);

      return bootstrap.createPluginsCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .have.callCount(0);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#createProfilesCollection', () => {
    it('should set the mapping and inject the default profiles', () => {
      return bootstrap.createProfilesCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('profiles', {
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

            should(bootstrap.engine.createOrReplace)
              .be.calledThrice()
              .be.calledWithMatch('profiles', 'admin', {
                policies: [{roleId: 'admin', allowInternalIndex: true}]
              })
              .be.calledWithMatch('profiles', 'default', {
                policies: [{roleId: 'default', allowInternalIndex: true}]
              })
              .be.calledWithMatch('profiles', 'anonymous', {
                policies: [{roleId: 'anonymous', allowInternalIndex: true}]
              });

            should(kuzzle.indexCache.add)
              .be.calledOnce()
              .be.calledWithExactly(kuzzle.internalEngine.index, 'profiles');
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should do nothing if the collection exists', () => {
      kuzzle.indexCache.exists.returns(true);

      return bootstrap.createProfilesCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .have.callCount(0);
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#createUsersCollection', () => {
    it('should set the mapping', () => {
      return bootstrap.createUsersCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('users', {
                properties: {
                  profileIds: {
                    index: 'not_analyzed',
                    type: 'string'
                  },
                  password: {
                    index: 'no',
                    type: 'string'
                  }
                }
              });

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should do nothing if the collection exists', () => {
      kuzzle.indexCache.exists.returns(true);

      return bootstrap.createUsersCollection()
        .then(() => {
          try {
            should(bootstrap.engine.updateMapping)
              .have.callCount(0);
            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#adminExists', () => {
    it('should return true if an admin exists', () => {
      bootstrap.engine.search.resolves({hits: {total: 1}});

      return bootstrap.adminExists()
        .then(result => {
          try {
            should(bootstrap.engine.search)
              .be.calledOnce()
              .be.calledWithMatch('users', {
                query: {
                  in: {
                    profileIds: ['admin']
                  }
                }
              }, 0, 0);

            should(result).be.true();

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should return false if no admin exists', () => {
      bootstrap.engine.search.resolves({hits: {total: 0}});

      return bootstrap.adminExists()
        .then(result => {
          try {
            should(result).be.false();

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

  });

});