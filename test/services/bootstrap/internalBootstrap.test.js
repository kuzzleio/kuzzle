'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  SafeBootstrap = require('../../../lib/services/bootstrap/safeBootstrap'),
  Bootstrap = require('../../../lib/services/bootstrap/internalBootstrap');

describe('InternalBootstrap', () => {
  let
    internalBootstrap,
    kuzzle,
    jwtSecret;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.indexCache.exists.resolves(false);
    kuzzle.config.services.internalEngine.bootstrapLockTimeout = 42000;

    internalBootstrap = new Bootstrap(kuzzle);

    jwtSecret = 'i-am-the-secret-now';
  });

  describe('#_bootstrapSequence', () => {
    beforeEach(() => {
      internalBootstrap._persistJWTSecret = sinon.stub().resolves();
      internalBootstrap.createInitialSecurities = sinon.stub().resolves();
      internalBootstrap.createInitialValidations = sinon.stub().resolves();
    });

    it('should call the initialization methods', async () => {
      await internalBootstrap._bootstrapSequence();

      sinon.assert.callOrder(
        internalBootstrap.createInitialSecurities,
        internalBootstrap.createInitialValidations,
        internalBootstrap._persistJWTSecret,
        internalBootstrap.engine.create
      );
    });
  });

  describe('#createInternalIndex', () => {
    it('should create internal collections', async () => {
      await internalBootstrap.createInternalIndex();

      should(internalBootstrap.engine.createCollection.callCount).be.eql(6);
      should(internalBootstrap.engine.createCollection.getCall(0).args[0]).be.eql('users');
      should(internalBootstrap.engine.createCollection.getCall(5).args).be.eql([
        'config',
        { dynamic: false, properties: {} }]);
    });
  });

  describe('#createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await internalBootstrap.createInitialSecurities();

      should(internalBootstrap.engine.createOrReplace.callCount).be.eql(6);
      should(internalBootstrap.engine.createOrReplace.getCall(0).args[0]).be.eql('roles');
      should(internalBootstrap.engine.createOrReplace.getCall(3).args[0]).be.eql('profiles');
    });
  });

  describe('#createInitialValidations', () => {
    it('should create initial validations from kuzzlerc', async () => {
      kuzzle.config.validation = {
        nepali: {
          liia: {
            index: 'nepali',
            collection: 'liia',
            validations: { some: 'validation' }
          },
          bandipur: {
            index: 'nepali',
            collection: 'bandipur',
            validations: { other: 'validation' }
          }
        }
      };

      await internalBootstrap.createInitialValidations();

      should(internalBootstrap.engine.createOrReplace.callCount).be.eql(2);
      should(internalBootstrap.engine.createOrReplace.getCall(0).args).be.eql([
        'validations',
        'nepali#liia',
        {
          index: 'nepali',
          collection: 'liia',
          validations: { some: 'validation' }
        }
      ]);
    });
  });

  describe('#_getJWTSecret', () => {
    it('should return the secret if it\'s already present in memory', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-the-secret');
      should(internalBootstrap.engine.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalBootstrap.engine.get.resolves({ _source: { seed: 'i-am-another-secret' } });

      const jwt = await internalBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
      should(internalBootstrap.engine.get).be.calledWith('config', internalBootstrap._JWT_SECRET_ID);
    });

    it('should reject if the JWT does not exists', () => {
      internalBootstrap.engine.get.rejects({ status: 404 });

      const promise = internalBootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
          should(internalBootstrap.engine.get).be.calledWith('config', internalBootstrap._JWT_SECRET_ID);
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalBootstrap._persistJWTSecret();

      should(internalBootstrap.engine.create).be.calledWith(
        'config',
        internalBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await internalBootstrap._persistJWTSecret();

      should(internalBootstrap.engine.create).be.called();
    });
  });
});