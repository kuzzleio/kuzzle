'use strict';

const
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  Bluebird = require('bluebird'),
  FunnelController = require('../../../../lib/api/controllers/funnelController'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  BaseController = require('../../../../lib/api/controllers/baseController'),
  SecurityController = rewire('../../../../lib/api/controllers/securityController'),
  {
    Request,
    errors: {
      BadRequestError,
      ServiceUnavailableError,
      InternalError: KuzzleInternalError,
      PartialError
    }
  } = require('kuzzle-common-objects'),
  errorsManager = require('../../../../lib/util/errors');

describe('/api/controllers/security', () => {
  let
    funnelController,
    sandbox = sinon.createSandbox(),
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    funnelController = new FunnelController(kuzzle);
    errorsManager.throw = sandbox.spy(errorsManager, 'throw');
  });

  afterEach(() => {
    errorsManager.throw.restore();
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(new SecurityController(kuzzle)).instanceOf(BaseController);
    });
  });

  describe('#mDelete', () => {
    const mDelete = SecurityController.__get__('mDelete');

    it('should fail if the request has no body', () => {
      should(() => mDelete(kuzzle, 'type', new Request({controller: 'security', action: 'type'})))
        .throw(BadRequestError, {message: 'The request must specify a body.'});
    });

    it('should fail if the request has no id', () => {
      const request = new Request({
        body: {}
      });

      should(() => mDelete(kuzzle, 'type', request))
        .throw(BadRequestError, {message: 'The request must specify a body attribute "ids".'});

    });

    it('should fail if ids is not an array', () => {
      const request = new Request({
        body: {
          ids: {}
        }
      });

      should(() => mDelete(kuzzle, 'type', request))
        .throw(BadRequestError, {message: 'The request must specify the body attribute "ids" of type "array".'});
    });

    it('should fail if kuzzle is overloaded', () => {
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

      return mDelete(kuzzle, 'type', request)
        .then(result => {
          should(result.length).be.eql(2, 'Only 1 document should have been deleted');
          should(request.status).be.eql(206);
          should(request.error).be.instanceof(PartialError);
        });
    });

    it('should throw an error if the number of documents to get exceeds server configuration', () => {
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
      return should(() => {
        mDelete(kuzzle, 'type', request);
      }).throw('The number of deletes to perform exceeds the server configured value 1.');
    });

    it('should return the input ids if everything went fine', () => {
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

      return mDelete(kuzzle, 'type', request)
        .then(ids => {
          should(ids)
            .match([
              'foo',
              'bar',
              'baz'
            ]);
        });
    });

    it('should set a partial error if something went wrong', () => {
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

      return mDelete(kuzzle, 'type', request)
        .then(() => {
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
});
