'use strict';

const rewire = require('rewire');
const sinon = require('sinon');
const should = require('should');
const Bluebird = require('bluebird');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const { NativeController } = require('../../../../lib/api/controller/base');
const SecurityController = rewire('../../../../lib/api/controller/security');
const {
  Request,
  errors: {
    BadRequestError,
    ServiceUnavailableError,
    InternalError: KuzzleInternalError,
    PartialError,
    SizeLimitError
  }
} = require('kuzzle-common-objects');
const kerror = require('../../../../lib/kerror');

describe('/api/controller/security', () => {
  let kuzzle;
  let request;
  let securityController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    sinon.spy(kerror, 'get');
    securityController = new SecurityController(kuzzle);
    request = new Request({ controller: 'security' });
  });

  afterEach(() => {
    kerror.get.restore();
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(new SecurityController(kuzzle)).instanceOf(NativeController);
    });
  });

  describe('#refresh', () => {
    it('should call refresh the allowed collections', async () => {
      for (const collection of ['users', 'roles', 'profiles']) {
        request.input.resource.collection = collection;

        const response = await securityController.refresh(request);

        should(response).be.null();
        should(kuzzle.storageEngine.internal.refreshCollection).calledWith(
          kuzzle.config.services.storageEngine.internalIndex.name,
          collection);
      }
    });

    it('should raise an error with unknown collection', async () => {
      request.input.resource.collection = 'frontend-security';

      const promise = securityController.refresh(request);

      return should(promise).be.rejectedWith({ id: 'api.assert.unexpected_argument' })
        .then(() => {
          should(securityController.publicStorage.refreshCollection)
            .not.be.called();
        });
    });
  });


  describe('#mDelete', () => {

    it('should fail if the request has no body', () => {
      should(() => securityController.mDelete('type', new Request({controller: 'security', action: 'type'}))
        .throw(BadRequestError, {message: 'The request must specify a body.'}));
    });

    it('should fail if the request has no id', () => {
      const request = new Request({
        body: {}
      });

      should(() => securityController.mDelete('type', request)
        .throw(BadRequestError, { id: 'api.assert.missing_argument'}));

    });

    it('should fail if ids is not an array', () => {
      const request = new Request({
        body: {
          ids: {}
        }
      });

      should(() => securityController.mDelete('type', request)
        .throw(BadRequestError, { id: 'api.assert.invalid_type' }));
    });

    it('should fail if kuzzle is overloaded', async () => {
      const request = new Request({
        body: {
          ids: [
            'foo',
            'bar',
            'baz'
          ]
        }
      });

      kuzzle.funnel.mExecute = funnelController.mExecute.bind(kuzzle.funnel);
      kuzzle.funnel.processRequest = req => Bluebird.resolve(req);

      let callCount = 0;
      kuzzle.funnel.getRequestSlot = (executor, req) => {
        if (callCount++ === 1) {
          req.setError(new ServiceUnavailableError('overloaded'));
          return false;
        }

        return true;
      };

      const result = await securityController.mDelete('type', request);
      should(result.length).be.eql(2, 'Only 1 document should have been deleted');
      should(request.status).be.eql(206);
      should(request.error).be.instanceof(PartialError);
    });

    it('should throw an error if the number of documents to get exceeds server configuration', async () => {
      const request = new Request({
        body: {
          ids: [
            'foo',
            'bar',
            'baz'
          ]
        },
        controller: 'security',
        action: 'mDeleteUsers'
      });

      kuzzle.config.limits.documentsWriteCount = 1;
      should(() => securityController.mDelete('type', request)
        .throw(SizeLimitError, { id: 'services.storage.write_limit_exceeded' }));
    });

    it('should return the input ids if everything went fine', async () => {
      const request = new Request({
        body: {
          ids: [
            'foo',
            'bar',
            'baz'
          ]
        }
      });

      kuzzle.funnel.mExecute = (req, cb) => cb(null, req);

      const ids = await securityController.mDelete('type', request);
      should(ids)
        .match([
          'foo',
          'bar',
          'baz'
        ]);
    });

    it('should set a partial error if something went wrong', async () => {
      const
        error = new Error('test'),
        request = new Request({
          body: {
            ids: ['foo', 'bar', 'baz']
          }
        });

      kuzzle.funnel.mExecute.yields(null, new Request({_id: 'test'}));
      kuzzle.funnel.mExecute
        .onSecondCall().yields(null, (() => {
          const req = new Request({_id: 'bar'});
          req.setError(error);
          return req;
        })());

      await securityController.mDelete('type', request);
      should(request.error)
        .be.an.instanceOf(PartialError);
      should(request.error.errors)
        .be.an.Array()
        .and.have.length(1);
      should(request.error.errors[0])
        .match(new KuzzleInternalError(error));
    });
  });
});
