'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const {
  NativeController,
  NativeSecurityController
} = require('../../../lib/api/controllers/baseController');
const {
  Request,
  BadRequestError,
  PartialError,
  SizeLimitError
} = require('../../../index');
const kerror = require('../../../lib/kerror');

describe('BaseController', () => {

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

  describe('NativeSecurityController', () => {
    let kuzzle;
    let nativeSecurityController;
    let request;

    beforeEach(() => {
      kuzzle = new KuzzleMock();
      sinon.spy(kerror, 'get');
      nativeSecurityController = new NativeSecurityController();
      request = new Request({});
    });

    afterEach(() => {
      kerror.get.restore();
    });

    describe('#constructor', () => {
      it('should inherit the base constructor', () => {
        should(new NativeSecurityController()).instanceOf(NativeController);
      });
    });

    describe('#_refresh', () => {
      it('should refresh the allowed collections', async () => {
        for (const collection of ['users', 'roles', 'profiles']) {
          request.input.args.collection = collection;

          const response = await nativeSecurityController._refresh(collection);

          should(response).be.null();
          should(kuzzle.ask).calledWith(
            'core:storage:private:collection:refresh',
            kuzzle.internalIndex.index,
            collection);
        }
      });

      it('should raise an error with unknown collection', async () => {
        await should(nativeSecurityController._refresh('frontend-security'))
          .rejectedWith({ id: 'api.assert.unexpected_argument' });

        should(kuzzle.ask.withArgs('core:storage:private:collection:refresh'))
          .not.be.called();
      });
    });

    describe('#mDelete', () => {
      let deleteStub;

      beforeEach(() => {
        deleteStub = kuzzle.ask
          .withArgs(sinon.match.string, sinon.match.string, sinon.match.object)
          .resolves();
        request.input.body = { ids: ['foo', 'bar', 'baz' ] };
      });

      it('should reject if the request has no body', () => {
        request.input.body = null;

        return should(nativeSecurityController._mDelete('type', request))
          .rejectedWith(BadRequestError, {id: 'api.assert.body_required'});
      });

      it('should fail if the request has no ids to delete', () => {
        request.input.body = {};

        return should(nativeSecurityController._mDelete('type', request))
          .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument'});
      });

      it('should fail if ids is not an array', () => {
        request.input.body = { ids: {} };

        return should(nativeSecurityController._mDelete('type', request))
          .rejectedWith(BadRequestError, { id: 'api.assert.invalid_type' });
      });

      it('should throw an error if the number of documents to get exceeds server configuration', () => {
        kuzzle.config.limits.documentsWriteCount = 1;

        return should(nativeSecurityController._mDelete('type', request))
          .rejectedWith(SizeLimitError, {
            id: 'services.storage.write_limit_exceeded'
          });
      });

      it('should return the input ids if everything went fine', async () => {
        for (const type of ['role', 'profile', 'user']) {
          let ids = await nativeSecurityController._mDelete(type, request);

          should(ids).match(request.input.body.ids);

          for (const id of ids) {
            should(deleteStub).calledWithMatch(
              `core:security:${type}:delete`,
              id,
              { refresh: 'wait_for' });
          }
        }
      });

      it('should handle request options', async () => {
        request.input.args.refresh = false;

        for (const type of ['role', 'profile', 'user']) {
          let ids = await nativeSecurityController._mDelete(type, request);

          should(ids).match(request.input.body.ids);

          for (const id of ids) {
            should(deleteStub).calledWithMatch(
              `core:security:${type}:delete`,
              id,
              { refresh: 'false' });
          }
        }
      });

      it('should set a partial error if something went wrong', async () => {
        const error = new Error('test');

        // Overwrite the kuzzle.ask stub with generic matchers.
        // We need to reject on only 1 argument to test partial errors, and there
        // is a bug with sinon.withArgs and generic matchers, that forces us to
        // detail every parameter sequences we need to stub:
        // https://github.com/sinonjs/sinon/issues/1572
        nativeSecurityController.ask = sinon.stub();

        nativeSecurityController.ask
          .withArgs('core:security:profile:delete', 'foo', sinon.match.object)
          .resolves();
        nativeSecurityController.ask
          .withArgs('core:security:profile:delete', 'bar', sinon.match.object)
          .rejects(error);
        nativeSecurityController.ask
          .withArgs('core:security:profile:delete', 'baz', sinon.match.object)
          .resolves();

        const ids = await nativeSecurityController._mDelete('profile', request);

        should(ids).match(['foo', 'baz']);
        should(request.error).be.an.instanceOf(PartialError);
        should(request.error.id).eql('services.storage.incomplete_delete');
        should(request.error.errors).be.an.Array().and.have.length(1);
        should(request.error.errors[0]).eql(error);
      });
    });

  });

});
