const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  Service = require('../../lib/services/service');

describe('Service', () => {
  let
    name,
    config,
    kuzzle,
    service;

  beforeEach(() => {
    name = 'dummyService';

    config = {
      some: 'configuration'
    };

    kuzzle = new KuzzleMock();

    service = new Service(name, kuzzle, config);
  });

  describe('#constructor', () => {
    it('should use provided timeout or service default timeout', () => {
      const service2 = new Service(name, kuzzle, { initTimeout: 1000 });

      should(service.initTimeout)
        .be.eql(kuzzle.config.services.common.defaultInitTimeout);
      should(service2.initTimeout)
        .be.eql(1000);
    });
  });

  describe('#init', () => {
    beforeEach(() => {
      service._initSequence = sinon.stub().resolves();
    });

    it('should call _initSequence', async () => {
      await service.init();

      should(service._initSequence).be.called();
    });

    it('should rejects if _initSequence take too long to resolve', () => {
      service.initTimeout = 10;
      service._initSequence = () => new Promise(() => {});

      const promise = service.init();

      return should(promise).be.rejectedWith({
        errorName: 'external.common.service_initialization_timeout'
      });
    });
  });
});
