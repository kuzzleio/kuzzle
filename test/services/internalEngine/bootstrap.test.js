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
    bootstrap,
    jwtSecret;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.indexCache.exists.resolves(false);

    bootstrap = new Bootstrap(kuzzle);
    bootstrap.config = {};

    jwtSecret = 'i-am-the-secret-now';
  });

  describe('#constructor', () => {
    it('should set the engine to kuzzle internal engine', () => {
      should(bootstrap.storage).be.exactly(kuzzle.internalEngine);
    });
  });

  describe('#startOrWait', () => {
    beforeEach(() => {
      bootstrap._bootstrap = sinon.stub().resolves();
      bootstrap._getLock = sinon.stub().resolves(true);
      bootstrap._checkTimeout = sinon.stub().resolves();
      bootstrap._getJWTSecret = sinon.stub().resolves(jwtSecret);
      bootstrap.storage.exists = sinon.stub().resolves(false);
    });

    it('should play the bootstrap sequence if it\'s the first node to start', async () => {
      await bootstrap.startOrWait();

      should(bootstrap._bootstrap).be.calledOnce();
      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
    });

    it('should reject if bootstrap on this node takes too long', async () => {
      bootstrap._bootstrap = () => new Promise(() => {});
      bootstrap._checkTimeout = () => {
        return new Promise((_, reject) => setTimeout(
          () => reject(new Error('timeout')), 50));
      };

      const promise = bootstrap.startOrWait()

      should(promise).be.rejected();
      should(kuzzle.config.security.jwt.secret).be.null();
    });

    it('should wait for bootstrap to be finish if it\' currently playing on another node', async () => {
      bootstrap._getLock.resolves(false);

      await bootstrap.startOrWait();

      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
    });

    it('should throw if bootstrap on another node takes too long', async () => {
      bootstrap._getLock.resolves(false);
      bootstrap._checkTimeout.rejects(new Error('timeout'));

      const promise = bootstrap.startOrWait()

      should(promise).be.rejected();
      should(kuzzle.config.security.jwt.secret).be.null();
    });

    it('should get JWT secret and return if bootstrap is already done', async () => {
      bootstrap.storage.exists.resolves(true);

      await bootstrap.startOrWait();

      should(bootstrap._getLock).not.be.called();
      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
    });

  });

  describe('#_bootstrap', () => {
    beforeEach(() => {
      bootstrap._persistJWTSecret = sinon.stub().resolves();
      bootstrap._createInternalIndex = sinon.stub().resolves();
      bootstrap._createInitialSecurities = sinon.stub().resolves();
      bootstrap._createInitialValidations = sinon.stub().resolves();
  });

    it('should call the initialization methods and then unlock the lock', async () => {
      await bootstrap._bootstrap();

      sinon.assert.callOrder(
        bootstrap._createInternalIndex,
        bootstrap._createInitialSecurities,
        bootstrap._createInitialValidations,
        bootstrap.storage.create,
        bootstrap._persistJWTSecret,
        bootstrap.storage.create,
        bootstrap._unlock
      );
    });
  })



  describe('#_constructValidationFixtures', () => {
    it('construct validation fixtures from kuzzlerc config', () => {
      bootstrap.config.validation = {
        nepali: {
          liia: {
            strict: true,
            fields: {}
          },
          mehry: {
            strict: false,
            fields: {}
          }
        }
      };

      const fixtures = bootstrap._constructValidationFixtures();

      should(fixtures['nepali#liia']).match({
        index: 'nepali',
        collection: 'liia',
        validation: {
          strict: true,
          fields: {}
        }
      });
      should(fixtures['nepali#mehry']).match({
        index: 'nepali',
        collection: 'mehry',
        validation: {
          strict: false,
          fields: {}
        }
      });
    })
  });
});
