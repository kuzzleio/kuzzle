'use strict';

const
  Bluebird = require('bluebird'),
  mockrequire = require('mock-require'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Bootstrap = require('../../../lib/services/internalEngine/bootstrap');

describe('services/internalEngine/bootstrap.js', () => {
  let
    kuzzle,
    bootstrap;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.indexCache.exists.resolves(false);

    bootstrap = new Bootstrap(kuzzle);
  });

  describe('#constructor', () => {
    it('should set the engine to kuzzle internal engine', () => {
      should(bootstrap.db).be.exactly(kuzzle.internalEngine);
    });
  });

  describe('#all', () => {
    it('should call the proper submethods in proper order', () => {
      sinon.stub(bootstrap, 'createCollections').returns(Promise.resolve());

      return bootstrap.all()
        .then(() => {

          try {
            should(bootstrap.db.createInternalIndex)
              .be.calledOnce();

            should(bootstrap.createCollections)
              .be.calledOnce();

            should(bootstrap.db.refresh)
              .be.calledOnce();

            should(kuzzle.indexCache.add)
              .be.calledOnce()
              .be.calledWithExactly(bootstrap.db.index);

            sinon.assert.callOrder(
              bootstrap.db.createInternalIndex,
              bootstrap.createCollections,
              bootstrap.db.refresh,
              kuzzle.indexCache.add
            );

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should respect lock', () => {
      const lockStub = sinon.stub(bootstrap, 'lock');
      lockStub.returns(Bluebird.resolve(false));
      lockStub.onSecondCall().returns(Bluebird.resolve(true));

      return Bluebird.all([
        bootstrap.all(),
        bootstrap.all()
      ])
        .then(() => {
          should(kuzzle.internalEngine.createInternalIndex)
            .be.calledOnce();
          should(kuzzle.config.security.jwt.secret)
            .be.String()
            .not.be.empty();
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
      ].forEach(m => sinon.stub(bootstrap, m).returns(Promise.resolve()));

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
            should(bootstrap.db.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('roles', {
                properties: {
                  controllers: { enabled: false }
                }
              });

            should(bootstrap.db.createOrReplace)
              .be.calledThrice();
            should(bootstrap.db.createOrReplace)
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
      kuzzle.indexCache.exists.resolves(true);

      return bootstrap.createRolesCollection()
        .then(() => {
          try {
            should(bootstrap.db.updateMapping)
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
            should(bootstrap.db.updateMapping)
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
      kuzzle.indexCache.exists.resolves(true);

      return bootstrap.createPluginsCollection()
        .then(() => {
          try {
            should(bootstrap.db.updateMapping)
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
            should(bootstrap.db.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('profiles', {
                properties: {
                  policies: {
                    properties: {
                      roleId: {
                        type: 'keyword'
                      }
                    }
                  }
                }
              });

            should(bootstrap.db.createOrReplace)
              .be.calledThrice()
              .be.calledWithMatch('profiles', 'admin', {
                policies: [{roleId: 'admin'}]
              })
              .be.calledWithMatch('profiles', 'default', {
                policies: [{roleId: 'default'}]
              })
              .be.calledWithMatch('profiles', 'anonymous', {
                policies: [{roleId: 'anonymous'}]
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
      kuzzle.indexCache.exists.resolves(true);

      return bootstrap.createProfilesCollection()
        .then(() => {
          try {
            should(bootstrap.db.updateMapping)
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
            should(bootstrap.db.updateMapping)
              .be.calledOnce()
              .be.calledWithMatch('users', {
                properties: {
                  profileIds: {
                    type: 'keyword'
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
      kuzzle.indexCache.exists.resolves(true);

      return bootstrap.createUsersCollection()
        .then(() => {
          try {
            should(bootstrap.db.updateMapping)
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
      bootstrap.db.search.returns(Promise.resolve({total: 1}));

      return bootstrap.adminExists()
        .then(result => {
          try {
            should(bootstrap.db.search)
              .be.calledOnce()
              .be.calledWithMatch('users', {
                query: {
                  terms: {
                    profileIds: ['admin']
                  }
                }
              }, {from: 0, size: 0});

            should(result).be.true();

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should return false if no admin exists', () => {
      bootstrap.db.search.returns(Promise.resolve({hits: {total: 0}}));

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

  describe('#jwtSecret', () => {
    it('should use given config if any', () => {
      kuzzle.config.security.jwt.secret = 'mysecret';

      return bootstrap.all()
        .then(() => {
          should(kuzzle.config.security.jwt.secret)
            .be.eql('mysecret');
        });
    });

    it('should take an existing seed from the db', () => {
      kuzzle.internalEngine.create
        .withArgs('config', 'security.jwt.secret')
        .rejects(new Error('test'));
      kuzzle.internalEngine.get
        .withArgs('config', 'security.jwt.secret')
        .resolves({
          _source: {
            seed: '42'
          }
        });

      return bootstrap.all()
        .then(() => {
          should(kuzzle.config.security.jwt.secret)
            .be.eql('42');
        });
    });

    it('should autogenerate a jwt secret if none found', () => {
      kuzzle.internalEngine.create
        .withArgs('config', 'security.jwt.secret')
        .returns(Bluebird.resolve());

      return bootstrap.all()
        .then(() => {
          should(kuzzle.config.security.jwt.secret)
            .be.a.String()
            .and.have.length(1024);
        });

    });
  });

  describe('#_waitTillUnlocked', () => {
    it('should throw if locked for too long', () => {
      bootstrap.db.exists.returns(Bluebird.resolve(true));
      mockrequire('bluebird', Object.assign({}, require('bluebird'), {delay: () => Bluebird.resolve()}));
      mockrequire.reRequire('../../../lib/services/internalEngine/bootstrap');

      return bootstrap._waitTillUnlocked()
        .then(() => { throw new Error('should not happen'); })
        .catch(error => {
          should(error.errorName).eql('services.storage.bootstrap_timeout');
        })
        .finally(() => {
          mockrequire.stop('bluebird');
          mockrequire.reRequire('../../../lib/services/internalEngine/bootstrap');
        });
    });
  });
});
