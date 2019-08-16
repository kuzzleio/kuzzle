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
    bootstrap.config = {};
  });

  describe('#constructor', () => {
    it('should set the engine to kuzzle internal engine', () => {
      should(bootstrap.db).be.exactly(kuzzle.internalEngine);
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

  describe('#_constructValidationFixtures', () => {
    it.only('construct validation fixtures from kuzzlerc config', () => {
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
