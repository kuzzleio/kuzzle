'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const NativeController = require('../../../../lib/api/controllers/base/nativeController');
const { BadRequestError } = require('../../../../index');

describe('NativeController', () => {
  let kuzzle;
  let actions;
  let nativeController;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    actions = ['speak', 'fight'];

    request = {
      input: {}
    };

    nativeController = new NativeController(actions);
  });

  it('should initialize its actions list from the constructor', () => {
    nativeController.privateAction = () => {};

    should(nativeController._isAction('speak')).be.true();
    should(nativeController._isAction('fight')).be.true();
    should(nativeController._isAction('privateAction')).be.false();
  });

  describe('translateKoncorde', () => {
    let koncordeFilters;

    beforeEach(() => {
      koncordeFilters = {
        equals: { name: 'Melis' }
      };

      kuzzle.ask
        .withArgs('core:storage:public:translate')
        .resolves({
          term: { name: 'Melis' }
        });
    });

    it('should translate the filter before passing it to the storage engine', async () => {
      const esQuery = await nativeController.translateKoncorde(koncordeFilters);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:translate',
        { equals: { name: 'Melis' } });

      should(esQuery).be.eql({ term: { name: 'Melis' } });
    });

    it('should validate the filter syntax with Koncorde', async () => {
      await nativeController.translateKoncorde(koncordeFilters);

      should(kuzzle.koncorde.validate)
        .be.calledWith({ equals: { name: 'Melis' } });
    });

    it('should reject if the query is not an object', () => {
      koncordeFilters = 'not an object';

      return should(nativeController.translateKoncorde(koncordeFilters)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.invalid_type' });
    });

    it('should reject when translation fail', () => {
      const error = new Error('message');
      error.keyword = { type: 'operator', name: 'n0t' };

      kuzzle.ask
        .withArgs('core:storage:public:translate')
        .rejects(error);

      return should(nativeController.translateKoncorde(koncordeFilters)).rejectedWith(
        BadRequestError,
        { id: 'api.assert.koncorde_restricted_keyword' });
    });

    it('should return an empty object if the filters are empty', async () => {
      const esQuery = await nativeController.translateKoncorde({});

      should(kuzzle.ask).not.be.called();

      should(esQuery).be.eql({});
    });
  });

  describe('#assertBodyHasNotAttributes', () => {
    beforeEach(() => {
      request.input.body = {
        invalid: '42'
      };
    });

    it('should throw', () => {
      should(() => {
        nativeController.assertBodyHasNotAttributes(request, ['invalid']);
      }).throw({ id: 'api.assert.forbidden_argument' });
    });
  });

  describe('#assertIsStrategyRegistered', () => {
    it('should throw', () => {
      kuzzle.pluginsManager.listStrategies = sinon.stub().returns(['local', 'oauth']);

      should(() => {
        nativeController.assertIsStrategyRegistered('glob');
      }).throw({ id: 'security.credentials.unknown_strategy' });
    });
  });

  describe('#assertNotExceedMaxFetch', () => {
    it('should throw', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      should(() => {
        nativeController.assertNotExceedMaxFetch(3);
      }).throw({ id: 'services.storage.get_limit_exceeded' });
    });
  });

});
